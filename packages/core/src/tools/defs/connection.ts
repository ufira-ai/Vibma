import type { ToolDef } from "../types";

export const tools: ToolDef[] = [
  {
    name: "ping",
    description: "Verify end-to-end connection to Figma. Call this right after join_channel. Returns { status: 'pong', documentName, currentPage } if the full chain (MCP → relay → plugin → Figma) is working. If this times out, the Figma plugin is not connected — ask the user to check the plugin window for the correct port and channel name.",
    schema: {},
    tier: "read",
    timeout: 5000,
  },
];
