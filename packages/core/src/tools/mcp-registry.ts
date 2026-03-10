import { z } from "zod";
import type { McpServer, SendCommandFn, Capabilities } from "./types";
import { registerTools } from "./registry";

// Generated endpoint tools (schema compiler output)
import { tools as generatedTools } from "./generated/defs";
import { resolveHelp } from "./generated/help";

import { registerPrompts } from "./prompts";

// Connection endpoint is registered directly in mcp.ts (has inline methods)
const endpointTools = generatedTools.filter(t => t.name !== "connection");

// Wire per-method response formatter for frames.export (returns binary image, not JSON)
const framesTool = endpointTools.find(t => t.name === "frames");
if (framesTool) {
  framesTool.methodFormatters = {
    export: (result: unknown) => {
      const r = result as any;
      // SVG_STRING returns raw text, not binary
      if (r.isString) {
        return { content: [{ type: "text" as const, text: r.imageData }] };
      }
      return {
        content: [{ type: "image" as const, data: r.imageData, mimeType: r.mimeType || "image/png" }],
      };
    },
  };
}

export const allTools = [...endpointTools];

/** Register all MCP tools and prompts on the server */
export function registerAllTools(server: McpServer, sendCommand: SendCommandFn, caps: Capabilities) {
  // Standalone help tool — directory of all endpoints, handled locally
  server.registerTool("help", {
    description: 'Get help on any endpoint or method. Lists all endpoints, their methods, and detailed parameter docs.\nExamples: help() → directory, help(topic: "components") → endpoint details, help(topic: "components.create") → method params.',
    inputSchema: {
      topic: z.string().optional().describe('Endpoint or endpoint.method name, e.g. "components" or "components.create"'),
    },
  }, async (params: any) => {
    return { content: [{ type: "text" as const, text: resolveHelp(params.topic) }] };
  });

  registerTools(server, sendCommand, caps, allTools);
  registerPrompts(server);
}
