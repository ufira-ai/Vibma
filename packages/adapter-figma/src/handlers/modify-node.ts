import { batchHandler } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

export async function moveSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("x" in node)) throw new Error(`Node does not support position: ${p.nodeId}`);
  (node as any).x = p.x;
  (node as any).y = p.y;
  return {};
}

export async function resizeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if ("resize" in node) (node as any).resize(p.width, p.height);
  else if ("resizeWithoutConstraints" in node) (node as any).resizeWithoutConstraints(p.width, p.height);
  else throw new Error(`Node does not support resize: ${p.nodeId}`);
  return {};
}

async function deleteSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  node.remove();
  return {};
}

async function cloneSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  const clone = (node as any).clone();
  if (p.x !== undefined && "x" in clone) { clone.x = p.x; clone.y = p.y; }
  if (p.parentId) {
    const parent = await figma.getNodeByIdAsync(p.parentId);
    if (!parent || !("appendChild" in parent)) throw new Error(`Invalid parent: ${p.parentId}`);
    (parent as any).appendChild(clone);
  } else if (node.parent) {
    (node.parent as any).appendChild(clone);
  } else {
    figma.currentPage.appendChild(clone);
  }
  return { id: clone.id };
}

async function insertSingle(p: any) {
  const parent = await figma.getNodeByIdAsync(p.parentId);
  if (!parent) throw new Error(`Parent not found: ${p.parentId}`);
  if (!("insertChild" in parent)) throw new Error(`Parent does not support children: ${p.parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
  const child = await figma.getNodeByIdAsync(p.childId);
  if (!child) throw new Error(`Child not found: ${p.childId}`);
  if (p.index !== undefined) (parent as any).insertChild(p.index, child);
  else (parent as any).appendChild(child);
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  move_node: (p) => batchHandler(p, moveSingle),
  resize_node: (p) => batchHandler(p, resizeSingle),
  delete_node: (p) => batchHandler(p, deleteSingle),
  // Legacy alias
  delete_multiple_nodes: async (p) => batchHandler({ items: (p.nodeIds || []).map((id: string) => ({ nodeId: id })) }, deleteSingle),
  clone_node: (p) => batchHandler(p, cloneSingle),
  insert_child: (p) => batchHandler(p, insertSingle),
};
