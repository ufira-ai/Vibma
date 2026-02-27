import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/** Function signature for sending commands to Figma via WebSocket */
export type SendCommandFn = (command: string, params?: unknown, timeoutMs?: number) => Promise<unknown>;

/** Re-export McpServer type for tool files */
export type { McpServer };

/** Standard batch result from Figma handlers */
export interface BatchResult<T = any> {
  results: Array<T & { error?: string }>;
}

/** Max response size in characters (~12K tokens). Prevents LLM client-side truncation that corrupts JSON. */
const MAX_RESPONSE_CHARS = 50_000;

/** Format a successful MCP response (JSON). Returns a clean error if response exceeds safe size. */
export function mcpJson(data: unknown) {
  const text = JSON.stringify(data);
  if (text.length <= MAX_RESPONSE_CHARS) {
    return { content: [{ type: "text" as const, text }] };
  }
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        _error: "response_too_large",
        _sizeKB: Math.round(text.length / 1024),
        warning: "Response exceeds safe size. Use 'depth', 'fields', 'limit', or 'summaryOnly' parameters to reduce response size.",
      }),
    }],
  };
}

/** Format an error MCP response */
export function mcpError(prefix: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: `${prefix}: ${msg}` }] };
}
