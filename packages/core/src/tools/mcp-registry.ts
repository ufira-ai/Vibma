import type { McpServer, SendCommandFn, Capabilities } from "./types";
import { registerTools } from "./registry";

// Import tool definitions from all modules
import { tools as connectionTools } from "./defs/connection";
import { tools as documentTools } from "./defs/document";
import { tools as selectionTools } from "./defs/selection";
import { tools as nodeInfoTools } from "./defs/node-info";
import { tools as createShapeTools } from "./defs/create-shape";
import { tools as createFrameTools } from "./defs/create-frame";
import { tools as createTextTools } from "./defs/create-text";
import { tools as modifyNodeTools } from "./defs/modify-node";
import { tools as patchNodesTools } from "./defs/patch-nodes";
import { tools as textTools } from "./defs/text";
import { tools as fontTools } from "./defs/fonts";
import { tools as lintTools } from "./defs/lint";
import { tools as styleTools } from "./defs/styles";
import { tools as variableTools } from "./defs/variables";
import { tools as componentTools } from "./defs/components";
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
