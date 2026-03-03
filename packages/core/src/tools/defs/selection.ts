import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import type { ToolDef } from "../types";

export const tools: ToolDef[] = [
  {
    name: "get_selection",
    description: "Get the current selection. Without depth, returns stubs (id/name/type). With depth, returns full serialized node trees.",
    schema: { depth: z.coerce.number().optional().describe("Child recursion depth. Omit for stubs only, 0=selected nodes' properties, -1=unlimited.") },
    tier: "read",
  },
  {
    name: "set_selection",
    description: "Set selection to nodes and scroll viewport to show them. Also works as focus (single node).",
    schema: {
      nodeIds: flexJson(z.array(z.string())).describe('Array of node IDs to select. Example: ["1:2","1:3"]'),
    },
    tier: "read",
  },
];
