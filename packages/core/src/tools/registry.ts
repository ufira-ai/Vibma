import { ZodError } from "zod";
import type { McpServer, SendCommandFn, Capabilities, ToolDef } from "./types";
import { mcpJson, mcpError } from "./types";

/**
 * Resolve the Figma command name for a tool call.
 *
 * - If tool has a commandMap, uses params.method to look up the command.
 *   Convention: command = "{toolName}.{method}"
 * - Otherwise falls back to tool.command or tool.name (legacy standalone tools).
 */
function resolveCommand(tool: ToolDef, params: any): string {
  if (tool.commandMap && params.method) {
    const cmd = tool.commandMap[params.method];
    if (cmd) return cmd;
  }
  return tool.command ?? tool.name;
}

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
    const timeout = tool.timeout;
    const defaultFormat = tool.formatResponse ?? mcpJson;

    server.registerTool(tool.name, { description: tool.description, inputSchema: schema }, async (params: any) => {
      try {
        if (tool.validate) tool.validate(params);
        const command = resolveCommand(tool, params);
        const result = await sendCommand(command, params, timeout);
        const format = (tool.methodFormatters?.[params.method]) ?? defaultFormat;
        return format(result);
      } catch (e) {
        if (e instanceof ZodError) {
          const hints = e.issues.map(i => {
            const path = i.path.join(".");
            return `[${path}] ${i.message}`;
          });
          return mcpError(`${tool.name} validation error`, hints.join("; "));
        }
        return mcpError(`${tool.name} error`, e);
      }
    });
  }
}
