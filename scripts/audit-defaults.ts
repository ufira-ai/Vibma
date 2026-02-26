#!/usr/bin/env bun
/**
 * Audit all optional fields across all tools to check
 * if they have default value information in their description.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { registerAllTools } from "../src/tools/mcp-registry";
import { z } from "zod";

const server = new McpServer({ name: "TalkToFigmaMCP", version: "1.0.0" });
registerAllTools(server, async () => ({}));
server.tool(
  "join_channel",
  "Join a specific channel to communicate with Figma",
  { channel: z.string().describe("The name of the channel to join").default("") },
  async () => ({ content: [{ type: "text" as const, text: "" }] })
);

const [ct, st] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "audit", version: "1.0.0" });
await Promise.all([client.connect(ct), server.connect(st)]);

const { tools } = await client.listTools();

let missing = 0;
let total = 0;

for (const tool of tools) {
  // Get the item-level properties (batch tools) or top-level properties
  const topProps = tool.inputSchema.properties as Record<string, any>;
  const topRequired = new Set((tool.inputSchema.required as string[]) || []);

  // Check if it's a batch tool with items array
  const itemsSchema = topProps?.items;
  let props: Record<string, any>;
  let required: Set<string>;

  if (itemsSchema?.type === "array" && itemsSchema.items?.properties) {
    props = itemsSchema.items.properties;
    required = new Set((itemsSchema.items.required as string[]) || []);
  } else {
    props = topProps;
    required = topRequired;
  }

  if (!props) continue;

  for (const [key, schema] of Object.entries(props) as [string, any][]) {
    if (required.has(key)) continue; // skip required fields
    total++;

    const desc = schema.description || "";
    const hasDefault = desc.toLowerCase().includes("default") || schema.default !== undefined;
    const hasEnum = schema.enum || schema.type === "boolean";

    if (!hasDefault && !hasEnum) {
      console.log(`${tool.name}.${key}: MISSING DEFAULT — desc: "${desc || "(none)"}"`);
      missing++;
    }
  }
}

console.log(`\n--- ${missing} optional fields missing default info out of ${total} total ---`);

await client.close();
process.exit(0);
