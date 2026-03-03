import { z } from "zod";
import { flexJson } from "../utils/coercion";
import type { ToolDef } from "./types";
import type { GetSelectionResult, SetSelectionResult } from "./response-types";

// ─── Tool Definitions ───────────────────────────────────────────

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

// ─── Figma Handlers ──────────────────────────────────────────────

async function getSelection(params: any): Promise<GetSelectionResult> {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    return { selectionCount: 0, selection: [] };
  }

  const depth = params?.depth;

  // No depth → return stubs
  if (depth === undefined || depth === null) {
    return {
      selectionCount: sel.length,
      selection: sel.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
      })),
    };
  }

  // With depth → return full serialized trees
  const { serializeNode, DEFAULT_NODE_BUDGET } = await import("../utils/serialize-node");
  const budget = { remaining: DEFAULT_NODE_BUDGET };
  const selection: any[] = [];
  for (const node of sel) {
    selection.push(await serializeNode(node, depth !== undefined ? depth : -1, 0, budget));
  }
  const out: any = { selectionCount: selection.length, selection };
  if (budget.remaining <= 0) {
    out._truncated = true;
    out._notice = "Result was truncated (node budget exceeded). Nodes with _truncated: true are stubs. "
      + "To inspect them, call get_node_info with their IDs directly, or use a shallower depth.";
  }
  return out;
}

async function setSelection(params: any): Promise<SetSelectionResult> {
  const nodeIds = params?.nodeIds;
  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    throw new Error("Missing or empty nodeIds");
  }

  const nodes: SceneNode[] = [];
  const notFound: string[] = [];
  for (const id of nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (node) nodes.push(node as SceneNode);
    else notFound.push(id);
  }
  if (nodes.length === 0) throw new Error(`No valid nodes found: ${nodeIds.join(", ")}`);

  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);

  return {
    count: nodes.length,
    selectedNodes: nodes.map((n) => ({ name: n.name, id: n.id })),
    notFoundIds: notFound.length > 0 ? notFound : undefined,
  };
}


export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_selection: getSelection,
  set_selection: setSelection,
};
