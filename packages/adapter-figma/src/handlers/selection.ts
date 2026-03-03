// ─── Figma Handlers ──────────────────────────────────────────────

async function getSelection(params: any) {
  const sel = figma.currentPage.selection;
  if (sel.length === 0) {
    return { selectionCount: 0, selection: [] };
  }

  const depth = params?.depth;

  // No depth -> return stubs
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

  // With depth -> return full serialized trees
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

async function setSelection(params: any) {
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
