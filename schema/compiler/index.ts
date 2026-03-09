#!/usr/bin/env tsx
/**
 * Vibma Schema Compiler
 *
 * Reads YAML schema definitions, merges base methods, and generates:
 * 1. MCP ToolDef TypeScript (packages/core/src/tools/generated/)
 * 2. Response type schemas
 * 3. (Future) Figma handler registry, docs manifest, MDX pages
 *
 * Usage: npx tsx schema/compiler/index.ts
 */

import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseAll } from "./parse";
import { mergeEndpoints } from "./merge";
import { generateMcpDefs } from "./gen-mcp";
import { generateResponseTypes } from "./gen-response-types";
import { generateDescription } from "./gen-descriptions";
import { generateDocs } from "./gen-docs";
import { generatePromptsTs, generatePromptsDocs, loadPrompts } from "./gen-prompts";
import { generateHelpTs } from "./gen-help";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../..");

// ─── Parse ──────────────────────────────────────────────────────
console.log("Parsing YAML schemas...\n");
const { bases, endpoints: rawEndpoints } = parseAll();
console.log(`  Bases: ${[...bases.keys()].join(", ")}`);
console.log(`  Endpoints: ${rawEndpoints.map(e => e.endpoint).join(", ")}`);

// ─── Merge ──────────────────────────────────────────────────────
console.log("\nMerging base methods...");
const resolved = mergeEndpoints(bases, rawEndpoints);

for (const ep of resolved) {
  const own = ep.methods.filter(m => !m.inherited).length;
  const inherited = ep.methods.filter(m => m.inherited).length;
  console.log(`  ${ep.name}: ${own} own + ${inherited} inherited = ${ep.methods.length} methods`);
}

// ─── Generate Descriptions (preview) ────────────────────────────
console.log("\n--- Generated Descriptions ---\n");
for (const ep of resolved) {
  console.log(generateDescription(ep));
  console.log();
}

// ─── Generate MCP ToolDefs ──────────────────────────────────────
const outDir = join(ROOT, "packages/core/src/tools/generated");
mkdirSync(outDir, { recursive: true });

const mcpCode = generateMcpDefs(resolved);
const mcpPath = join(outDir, "defs.ts");
writeFileSync(mcpPath, mcpCode);
console.log(`Written: ${mcpPath}`);

// ─── Generate Help Data ─────────────────────────────────────────
const prompts = loadPrompts();
const helpTopics = prompts.filter(p => p.help);
const helpCode = generateHelpTs(resolved, helpTopics);
const helpPath = join(outDir, "help.ts");
writeFileSync(helpPath, helpCode);
console.log(`Written: ${helpPath}`);

// ─── Generate Response Types ────────────────────────────────────
const responseCode = generateResponseTypes(resolved);
const responsePath = join(outDir, "response-types.ts");
writeFileSync(responsePath, responseCode);
console.log(`Written: ${responsePath}`);

// ─── Generate Docs ──────────────────────────────────────────────
console.log("\nGenerating docs...");
const docsRoot = join(ROOT, "docs");
const { sidebarItems } = generateDocs(resolved, docsRoot);
console.log(`  Sidebar: ${sidebarItems.map(s => s.label).join(", ")}`);

// ─── Generate Prompts ───────────────────────────────────────────
console.log("\nGenerating prompts...");
const promptsOutDir = join(ROOT, "packages/core/src/tools");
generatePromptsTs(promptsOutDir);
generatePromptsDocs(docsRoot);

// ─── Summary ────────────────────────────────────────────────────
const totalMethods = resolved.reduce((sum, ep) => sum + ep.methods.length, 0);
console.log(`\nDone: ${resolved.length} endpoints, ${totalMethods} total methods`);
