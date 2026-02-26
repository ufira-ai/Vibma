#!/usr/bin/env bun
/**
 * Dumps all MCP tools and prompts as seen by agents via tools/list.
 * Schema-only — no hand-written response examples.
 * Use MCP Inspector (https://github.com/modelcontextprotocol/inspector) to verify actual responses.
 *
 * Usage: bun scripts/dump-tools.ts [--json] [--md]
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { registerAllTools } from "../src/tools/mcp-registry";

const format = process.argv.includes("--json") ? "json"
  : process.argv.includes("--md") ? "md"
  : "md";

// Create server with all tools registered
const server = new McpServer({ name: "TalkToFigmaMCP", version: "1.0.0" });

// Dummy sendCommand — tools are never called, just listed
const dummySend = async () => ({});
registerAllTools(server, dummySend);

// Also register join_channel like server.ts does
import { z } from "zod";
server.tool(
  "join_channel",
  "REQUIRED FIRST STEP: Join a channel before using any other tool. The channel name is shown in the Figma plugin UI. All subsequent commands are sent through this channel.",
  { channel: z.string().describe("The channel name displayed in the Figma plugin panel (e.g. 'channel-abc-123')").default("") },
  async () => ({ content: [{ type: "text" as const, text: "" }] })
);

// Connect via in-memory transport
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

const client = new Client({ name: "dump-client", version: "1.0.0" });
await Promise.all([
  client.connect(clientTransport),
  server.connect(serverTransport),
]);

// Fetch tools and prompts
const { tools } = await client.listTools();
let prompts: any[] = [];
try {
  const res = await client.listPrompts();
  prompts = res.prompts;
} catch {}

if (format === "json") {
  console.log(JSON.stringify({ tools, prompts }, null, 2));
} else {
  // Markdown output
  console.log(`# TalkToFigma MCP — Tool Reference\n`);
  console.log(`> ${tools.length} tools, ${prompts.length} prompts\n`);

  // Group tools by prefix
  const groups = new Map<string, typeof tools>();
  for (const tool of tools) {
    const category = categorize(tool.name);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(tool);
  }

  for (const [category, categoryTools] of groups) {
    console.log(`## ${category}\n`);
    for (const tool of categoryTools) {
      console.log(`### \`${tool.name}\`\n`);
      console.log(`${tool.description}\n`);
      if (tool.inputSchema && tool.inputSchema.properties) {
        const props = tool.inputSchema.properties as Record<string, any>;
        const required = new Set((tool.inputSchema.required as string[]) || []);
        console.log(`| Parameter | Type | Required | Description |`);
        console.log(`|-----------|------|----------|-------------|`);
        for (const [name, schema] of Object.entries(props)) {
          const type = formatType(schema);
          const req = required.has(name) ? "yes" : "no";
          const desc = schema.description || "";
          console.log(`| \`${name}\` | ${type} | ${req} | ${desc} |`);
        }
        console.log("");
      }
    }
  }

  if (prompts.length > 0) {
    console.log(`## Prompts\n`);
    for (const prompt of prompts) {
      console.log(`### \`${prompt.name}\`\n`);
      console.log(`${prompt.description}\n`);
    }
  }
}

await client.close();
process.exit(0);

// ─── Helpers ─────────────────────────────────────────────────────

function categorize(name: string): string {
  if (name.startsWith("get_") || name.startsWith("read_")) return "Read / Query";
  if (name.startsWith("create_")) return "Create";
  if (name.startsWith("set_")) return "Modify / Set";
  if (name.startsWith("scan_") || name.startsWith("search_") || name.startsWith("export_")) return "Search / Export";
  if (name === "move_node" || name === "resize_node" || name === "delete_node" || name === "clone_node" || name === "insert_child") return "Transform";
  if (name === "join_channel" || name === "zoom_into_view" || name === "set_viewport") return "Navigation";
  if (name.startsWith("lint_")) return "Lint";
  if (name.startsWith("combine_") || name.startsWith("add_") || name.startsWith("remove_") || name.startsWith("rename_") || name.startsWith("apply_")) return "Modify / Set";
  return "Other";
}

function formatType(schema: any): string {
  if (!schema) return "any";
  if (schema.type === "array") {
    const itemType = schema.items ? formatType(schema.items) : "any";
    return `${itemType}[]`;
  }
  if (schema.type === "object" && schema.properties) {
    const keys = Object.keys(schema.properties);
    if (keys.length <= 4) {
      return `{${keys.join(", ")}}`;
    }
    return `{${keys.slice(0, 3).join(", ")}, ...}`;
  }
  if (schema.enum) {
    return schema.enum.map((v: any) => `"${v}"`).join(" \\| ");
  }
  if (schema.anyOf) {
    return schema.anyOf.map((s: any) => formatType(s)).join(" \\| ");
  }
  return schema.type || "any";
}
