import type { McpServer, SendCommandFn, Capabilities, ToolDef } from "./types";
import { mcpJson, mcpError } from "./types";

/**
 * Batch-register declarative ToolDefs on the MCP server.
 *
 * 1. Filters by tier:  read → always,  create → caps.create,  edit → caps.edit
 * 2. Resolves dynamic schemas (endpoint tools pass caps-dependent functions)
 * 3. Generates a uniform handler: validate? → sendCommand → formatResponse ?? mcpJson
 */
export function registerTools(
  server: McpServer,
  sendCommand: SendCommandFn,
  caps: Capabilities,
  tools: ToolDef[],
): void {
  for (const tool of tools) {
    // Tier gate
    if (tool.tier === "create" && !caps.create) continue;
    if (tool.tier === "edit" && !caps.edit) continue;

    const schema = typeof tool.schema === "function" ? tool.schema(caps) : tool.schema;
    const command = tool.command ?? tool.name;
    const timeout = tool.timeout;
    const format = tool.formatResponse ?? mcpJson;

    server.registerTool(tool.name, { description: tool.description, inputSchema: schema }, async (params: any) => {
      try {
        if (tool.validate) tool.validate(params);
        const result = await sendCommand(command, params, timeout);
        return format(result);
      } catch (e) {
        return mcpError(`${tool.name} error`, e);
      }
    });
  }
}
