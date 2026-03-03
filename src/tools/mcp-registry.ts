import type { McpServer, SendCommandFn, Capabilities } from "./types";
import { registerTools } from "./registry";

// Import tool definitions from all modules
import { tools as connectionTools } from "./connection";
import { tools as documentTools } from "./document";
import { tools as selectionTools } from "./selection";
import { tools as nodeInfoTools } from "./node-info";
import { tools as createShapeTools } from "./create-shape";
import { tools as createFrameTools } from "./create-frame";
import { tools as createTextTools } from "./create-text";
import { tools as modifyNodeTools } from "./modify-node";
import { tools as patchNodesTools } from "./patch-nodes";
import { tools as textTools } from "./text";
import { tools as fontTools } from "./fonts";
import { tools as lintTools } from "./lint";
import { tools as styleTools } from "./styles";
import { tools as variableTools } from "./variables";
import { tools as componentTools } from "./components";
import { registerPrompts } from "./prompts";

export const allTools = [
  ...connectionTools,
  ...documentTools,
  ...selectionTools,
  ...nodeInfoTools,
  ...createShapeTools,
  ...createFrameTools,
  ...createTextTools,
  ...modifyNodeTools,
  ...patchNodesTools,
  ...textTools,
  ...fontTools,
  ...lintTools,
  ...styleTools,
  ...variableTools,
  ...componentTools,
];

/** Register all MCP tools and prompts on the server */
export function registerAllTools(server: McpServer, sendCommand: SendCommandFn, caps: Capabilities) {
  registerTools(server, sendCommand, caps, allTools);
  registerPrompts(server);
}
