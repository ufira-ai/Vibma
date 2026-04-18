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
  const savedH = "layoutSizingHorizontal" in node ? (node as any).layoutSizingHorizontal : undefined;
  const savedV = "layoutSizingVertical" in node ? (node as any).layoutSizingVertical : undefined;
  if ("resize" in node) (node as any).resize(p.width, p.height);
  else if ("resizeWithoutConstraints" in node) (node as any).resizeWithoutConstraints(p.width, p.height);
  else throw new Error(`Node does not support resize: ${p.nodeId}`);
  if (savedH === "HUG") (node as any).layoutSizingHorizontal = "HUG";
  if (savedV === "HUG") (node as any).layoutSizingVertical = "HUG";
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
  // Clone the node as-is. InstanceNode.clone() produces a new INSTANCE referencing
  // the same component — no need to resolve to the main component first.
  const clone = (node as any).clone();
  if (p.name) clone.name = p.name;
  if (p.x !== undefined && "x" in clone) { clone.x = p.x; clone.y = p.y; }
  if (p.parentId) {
    const parent = await figma.getNodeByIdAsync(p.parentId);
    if (!parent || !("appendChild" in parent)) throw new Error(`Invalid parent: ${p.parentId}`);

    // Cross-page clone: Figma requires the target page to be loaded before appendChild.
    // Without loadAsync, the clone silently stays on the source page.
    if (parent.type === "PAGE") {
      await (parent as PageNode).loadAsync();
    } else {
      let targetPage: BaseNode | null = parent;
      while (targetPage && targetPage.type !== "PAGE") targetPage = targetPage.parent;
      if (targetPage?.type === "PAGE") await (targetPage as PageNode).loadAsync();
    }

    // Pre-validate: cloning a component into a component set with a duplicate name silently
    // corrupts the set (Figma accepts the append but properties become unreadable).
    if (parent.type === "COMPONENT_SET" && clone.type === "COMPONENT") {
      const siblings = (parent as any).children as any[] || [];
      const duplicate = siblings.find((c: any) => c.type === "COMPONENT" && c.name === clone.name);
      if (duplicate) {
        clone.remove();
        throw new Error(`Variant "${clone.name}" already exists in "${(parent as any).name}". Pass name to rename the clone before appending. Example: components(method:"clone", id:"${node.id}", name:"State=Hover", parentId:"${p.parentId}")`);
      }
    }

    try {
      (parent as any).appendChild(clone);
    } catch (e: any) {
      clone.remove();
      const isComponent = node.type === "COMPONENT" || node.type === "COMPONENT_SET";
      const parentIsComponent = parent.type === "COMPONENT" || parent.type === "COMPONENT_SET";
      if (isComponent && parentIsComponent) {
        throw new Error(`Cannot nest component "${(node as any).name}" inside component "${(parent as any).name}". Use instances(method: "create", items: [{componentId: "${node.id}", parentId: "${p.parentId}"}]) to create an instance instead.`);
      }
      throw new Error(`Cannot append "${(node as any).name}" to "${(parent as any).name}": ${e.message}`);
    }

    // Re-bind component property references on cloned variant children.
    // Figma drops componentPropertyReferences when cloning a COMPONENT into a COMPONENT_SET.
    // Walk the source and clone trees in parallel, copying bindings.
    if (parent.type === "COMPONENT_SET" && clone.type === "COMPONENT") {
      const copyRefs = (src: any, dst: any) => {
        if (src.componentPropertyReferences) {
          dst.componentPropertyReferences = { ...src.componentPropertyReferences };
        }
        if ("children" in src && "children" in dst) {
          const srcKids = src.children as any[];
          const dstKids = dst.children as any[];
          for (let i = 0; i < Math.min(srcKids.length, dstKids.length); i++) {
            copyRefs(srcKids[i], dstKids[i]);
          }
        }
      };
      copyRefs(node, clone);
    }

  } else {
    // No parentId: place on current page (not source's page).
    // clone() attaches to source's parent — reparent to current page.
    figma.currentPage.appendChild(clone);
  }
  return { id: clone.id };
}

async function insertSingle(p: any) {
  const parent = await figma.getNodeByIdAsync(p.parentId);
  if (!parent) throw new Error(`Parent not found: ${p.parentId}`);
  if (!("insertChild" in parent)) throw new Error(`Parent does not support children: ${p.parentId}. Only FRAME, COMPONENT, GROUP, SECTION, SLOT, and PAGE nodes can have children.`);
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
