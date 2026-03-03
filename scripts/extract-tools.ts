#!/usr/bin/env tsx
/**
 * Extract all MCP tool registrations into a JSON manifest for the docs site.
 *
 * Strategy:
 * - Mock McpServer that captures server.tool() calls
 * - Import registerAllTools from the real codebase
 * - Hardcode the 3 inline tools from src/mcp.ts (they use local WS state)
 * - Convert Zod schemas → JSON Schema via z.toJSONSchema()
 * - Attach domain grouping from domain-config.ts
 * - Write docs/public/tools-manifest.json
 */

import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { registerAllTools, allTools } from "../packages/core/src/tools/mcp-registry";
import { domains, toolToDomain } from "./domain-config";
import { toolResponseSchemas } from "../packages/core/src/tools/response-types";
import type { ToolTier } from "../packages/core/src/tools/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ─── Types ───────────────────────────────────────────────────────

interface ToolEntry {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  responseExample?: unknown;
  domain: string;
  tier: ToolTier;
  endpoint: boolean;
}

interface PromptEntry {
  name: string;
  description: string;
}

interface Manifest {
  generatedAt: string;
  toolCount: number;
  domains: typeof domains;
  tools: ToolEntry[];
  prompts: PromptEntry[];
}

// ─── Tier lookup from ToolDef arrays ─────────────────────────────

const toolTierMap = new Map<string, ToolTier>();
const toolEndpointSet = new Set<string>();
for (const tool of allTools) {
  toolTierMap.set(tool.name, tool.tier);
  if (typeof tool.schema === "function") toolEndpointSet.add(tool.name);
}

// ─── Mock McpServer ──────────────────────────────────────────────

const capturedTools: ToolEntry[] = [];
const capturedPrompts: PromptEntry[] = [];

const mockServer = {
  registerTool(name: string, config: { description?: string; inputSchema?: Record<string, any> }, _handler: any) {
    const schema = config.inputSchema ?? {};
    let jsonSchema: Record<string, unknown> = {};
    try {
      if (schema && Object.keys(schema).length > 0) {
        jsonSchema = z.toJSONSchema(z.object(schema), {
          io: "input",
          unrepresentable: "any",
        });
        delete jsonSchema.$schema;
      }
    } catch (e) {
      console.warn(`  ⚠ Schema conversion failed for "${name}": ${e}`);
      jsonSchema = { error: "schema_conversion_failed" };
    }

    const domain = toolToDomain.get(name) ?? "uncategorized";
    const tier = toolTierMap.get(name) ?? "read";
    const endpoint = toolEndpointSet.has(name);
    capturedTools.push({ name, description: config.description ?? "", schema: jsonSchema, ...extractResponse(name), domain, tier, endpoint });
  },

  registerPrompt(name: string, config: { description?: string }, _handler: any) {
    capturedPrompts.push({ name, description: config.description ?? "" });
  },

  resource() {},
};

// ─── Inline tools (from src/mcp.ts — they reference local WS state) ────

function extractResponse(name: string) {
  const entry = toolResponseSchemas[name];
  if (!entry) return { responseSchema: undefined, responseExample: undefined };
  const schema = { ...entry };
  const example = schema.example;
  delete schema.example;
  return { responseSchema: schema, responseExample: example };
}

function addInlineTools() {
  capturedTools.push({
    name: "join_channel",
    description:
      "REQUIRED FIRST STEP: Join a channel before using any other tool. The channel name is shown in the Figma plugin UI (defaults to 'vibma' if not customised). After joining, call `ping` to verify the Figma plugin is connected.",
    schema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description:
            "The channel name displayed in the Figma plugin panel. Defaults to 'vibma' if omitted.",
          default: "vibma",
        },
      },
    },
    ...extractResponse("join_channel"),
    domain: "connection",
    tier: "read",
    endpoint: false,
  });

  capturedTools.push({
    name: "channel_info",
    description:
      "Debug: inspect which clients (MCP, plugin) are connected to each relay channel. Useful for diagnosing connection issues. Does not require an active channel.",
    schema: { type: "object", properties: {} },
    ...extractResponse("channel_info"),
    domain: "connection",
    tier: "read",
    endpoint: false,
  });

  capturedTools.push({
    name: "reset_tunnel",
    description:
      "DESTRUCTIVE: Factory-reset a channel on the relay, disconnecting ALL occupants. Only use when the channel is stuck or occupied by another MCP.",
    schema: {
      type: "object",
      properties: {
        channel: {
          type: "string",
          description: "Channel to reset. Defaults to 'vibma'.",
          default: "vibma",
        },
      },
    },
    ...extractResponse("reset_tunnel"),
    domain: "connection",
    tier: "edit",
    endpoint: false,
  });
}

// ─── Main ────────────────────────────────────────────────────────

console.log("Extracting tool schemas...\n");

// 1. Add the 3 inline tools first
addInlineTools();

// 2. Run all registerMcpTools through the mock server (full caps → all tools)
const mockSendCommand = async () => ({});
registerAllTools(mockServer as any, mockSendCommand, { create: true, edit: true });

// 3. Sort tools by domain order, then by position in domain config
const domainOrder = new Map(domains.map((d, i) => [d.id, i]));
capturedTools.sort((a, b) => {
  const da = domainOrder.get(a.domain) ?? 999;
  const db = domainOrder.get(b.domain) ?? 999;
  if (da !== db) return da - db;
  // Within same domain, keep order from domain config
  const domainA = domains.find((d) => d.id === a.domain);
  const domainB = domains.find((d) => d.id === b.domain);
  const ia = domainA?.tools.indexOf(a.name) ?? 999;
  const ib = domainB?.tools.indexOf(b.name) ?? 999;
  return ia - ib;
});

// 4. Check for uncategorized tools
const uncategorized = capturedTools.filter((t) => t.domain === "uncategorized");
if (uncategorized.length > 0) {
  console.warn("⚠ Uncategorized tools (add to domain-config.ts):");
  uncategorized.forEach((t) => console.warn(`  - ${t.name}`));
}

// 5. Build manifest
const manifest: Manifest = {
  generatedAt: new Date().toISOString(),
  toolCount: capturedTools.length,
  domains,
  tools: capturedTools,
  prompts: capturedPrompts,
};

// 6. Write manifest
const outDir = join(ROOT, "docs", "public");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "tools-manifest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2));

// 7. Generate domain MDX pages with real ### headings for Starlight TOC
const toolsDir = join(ROOT, "docs", "src", "content", "docs", "tools");
mkdirSync(toolsDir, { recursive: true });

// Clean stale MDX files from previous domains
const validIds = new Set(domains.map((d) => d.id));
for (const file of readdirSync(toolsDir)) {
  if (file.endsWith(".mdx") && !validIds.has(file.replace(".mdx", ""))) {
    unlinkSync(join(toolsDir, file));
    console.log(`✓ Removed stale ${file}`);
  }
}

for (const domain of domains) {
  const domainTools = capturedTools.filter((t) => t.domain === domain.id);
  const lines: string[] = [
    "---",
    `title: "${domain.label}"`,
    `description: "${domain.description}"`,
    "---",
    "",
    `import ToolReference from "../../../components/ToolReference.astro";`,
    "",
    `${domain.description}`,
    "",
    `${domainTools.length} tool${domainTools.length !== 1 ? "s" : ""} in this domain.`,
    "",
  ];

  for (const tool of domainTools) {
    // Real ### heading — Starlight picks this up for TOC
    lines.push(`### ${tool.name}`);
    lines.push("");
    const responseAttr = tool.responseSchema
      ? ` responseSchema={${JSON.stringify(tool.responseSchema)}}`
      : "";
    const exampleAttr = tool.responseExample !== undefined
      ? ` responseExample={${JSON.stringify(tool.responseExample)}}`
      : "";
    const endpointAttr = tool.endpoint ? ` endpoint` : "";
    lines.push(
      `<ToolReference name="${tool.name}" description={${JSON.stringify(tool.description)}} schema={${JSON.stringify(tool.schema)}} tier="${tool.tier}"${endpointAttr}${responseAttr}${exampleAttr} />`
    );
    lines.push("");
  }

  const mdxPath = join(toolsDir, `${domain.id}.mdx`);
  writeFileSync(mdxPath, lines.join("\n"));
}

// 8. Generate getting-started.mdx from CARRYME.md
const carryMePath = join(ROOT, "CARRYME.md");
const carryMe = readFileSync(carryMePath, "utf-8");
// Strip the H1 title line and the "> Prefer full source control?" blockquote
// Keep content up to (but not including) the "Instructions for AI Agents" section
const agentSectionIdx = carryMe.indexOf("\n---\n\n## Instructions for AI Agents");
const userContent = agentSectionIdx !== -1 ? carryMe.slice(0, agentSectionIdx) : carryMe;
// Remove the first H1 and the intro blockquote
const lines = userContent.split("\n");
let startIdx = 0;
// Skip H1 line
if (lines[0]?.startsWith("# ")) startIdx = 1;
// Skip blank line after H1
if (lines[startIdx]?.trim() === "") startIdx++;
// Skip blockquote lines ("> ...")
while (startIdx < lines.length && lines[startIdx]?.startsWith(">")) startIdx++;
// Skip trailing blank line after blockquote
if (lines[startIdx]?.trim() === "") startIdx++;
const body = lines.slice(startIdx).join("\n").trim();

const gettingStartedMdx = [
  "---",
  "title: Getting Started",
  "description: Set up Vibma and connect your AI agent to Figma",
  "slug: index",
  "---",
  "",
  `{/* Auto-generated from CARRYME.md by extract-tools.ts — do not edit manually */}`,
  "",
  body,
  "",
].join("\n");

const gettingStartedPath = join(ROOT, "docs", "src", "content", "docs", "getting-started.mdx");
writeFileSync(gettingStartedPath, gettingStartedMdx);

console.log(`✓ Extracted ${capturedTools.length} tools, ${capturedPrompts.length} prompts`);
console.log(`✓ Domains: ${domains.map((d) => `${d.label} (${d.tools.length})`).join(", ")}`);
console.log(`✓ Written manifest to ${outPath}`);
console.log(`✓ Generated ${domains.length} domain MDX pages in ${toolsDir}`);
console.log(`✓ Generated getting-started.mdx from CARRYME.md\n`);
