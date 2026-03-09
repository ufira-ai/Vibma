import { batchHandler, appendToParent, applyFillWithAutoBind, applyStrokeWithAutoBind, applyCornerRadius, applyTokens } from "./helpers";
import { looksInteractive } from "@ufira/vibma/utils/wcag";

/**
 * Shared setup for frame-like nodes (Frame, Component).
 * Applies layout, fill, stroke, corner radius, opacity, min/max, WCAG checks.
 * Returns { parent, hints } so the caller can add type-specific logic.
 */
export async function setupFrameNode(
  node: FrameNode | ComponentNode,
  p: any,
): Promise<{ parent: BaseNode | null; hints: string[] }> {
  // Expand padding shorthand → per-edge (token values preserved)
  if (p.padding !== undefined) {
    p.paddingTop ??= p.padding;
    p.paddingRight ??= p.padding;
    p.paddingBottom ??= p.padding;
    p.paddingLeft ??= p.padding;
  }

  const {
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    parentId,
  } = p;

  const hints: string[] = [];

  // Corner radius
  await applyCornerRadius(node, p, hints);
  // Opacity
  await applyTokens(node, { opacity: p.opacity }, hints);

  const deferH = parentId && layoutSizingHorizontal === "FILL";
  const deferV = parentId && layoutSizingVertical === "FILL";

  // Auto-layout
  if (layoutMode !== "NONE") {
    node.layoutMode = layoutMode;
    node.layoutWrap = layoutWrap;
    for (const f of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"] as const) {
      if (p[f] === undefined) (node as any)[f] = 0;
    }
    await applyTokens(node, {
      paddingTop: p.paddingTop, paddingRight: p.paddingRight,
      paddingBottom: p.paddingBottom, paddingLeft: p.paddingLeft,
      itemSpacing: p.itemSpacing,
    }, hints);
    node.primaryAxisAlignItems = primaryAxisAlignItems;
    node.counterAxisAlignItems = counterAxisAlignItems;
    node.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
    node.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
    if (p.counterAxisSpacing !== undefined && layoutWrap === "WRAP") {
      await applyTokens(node, { counterAxisSpacing: p.counterAxisSpacing }, hints);
    }
  }

  // Fill & stroke
  await applyFillWithAutoBind(node, p, hints);
  await applyStrokeWithAutoBind(node, p, hints);

  // Min/max dimensions
  if (p.minWidth !== undefined) (node as any).minWidth = p.minWidth;
  if (p.maxWidth !== undefined) (node as any).maxWidth = p.maxWidth;
  if (p.minHeight !== undefined) (node as any).minHeight = p.minHeight;
  if (p.maxHeight !== undefined) (node as any).maxHeight = p.maxHeight;

  // Append to parent (with deferred FILL sizing)
  const parent = await appendToParent(node, parentId);
  const parentIsAL = parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  if (parent) {
    if (deferH) {
      if (parentIsAL) { node.layoutSizingHorizontal = "FILL"; }
      else { hints.push("layoutSizingHorizontal 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first."); }
    }
    if (deferV) {
      if (parentIsAL) { node.layoutSizingVertical = "FILL"; }
      else { hints.push("layoutSizingVertical 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first."); }
    }
    if (!deferH && !deferV && parentIsAL) {
      if (layoutSizingHorizontal === "FIXED" && layoutSizingVertical === "FIXED" && layoutMode === "NONE") {
        hints.push("Child has FIXED sizing inside auto-layout parent. Consider layoutSizingHorizontal/Vertical: 'FILL' or 'HUG' for responsive layout.");
      }
    }
  }

  // WCAG 2.5.8: target size recommendation for interactive elements
  if (looksInteractive(node) && (node.width < 24 || node.height < 24)) {
    hints.push("WCAG: Min 24x24px for touch targets.");
  }

  return { parent, hints };
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleFrame(p: any) {
  const frame = figma.createFrame();
  frame.x = p.x ?? 0;
  frame.y = p.y ?? 0;
  frame.resize(p.width ?? 100, p.height ?? 100);
  frame.name = p.name || "Frame";
  frame.fills = [];

  const { hints } = await setupFrameNode(frame, p);

  const result: any = { id: frame.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function createSingleAutoLayout(p: any) {
  // Expand padding shorthand → per-edge (token values preserved)
  if (p.padding !== undefined) {
    p.paddingTop ??= p.padding;
    p.paddingRight ??= p.padding;
    p.paddingBottom ??= p.padding;
    p.paddingLeft ??= p.padding;
  }

  // If no nodeIds, create a fresh auto-layout frame (matching YAML schema)
  if (!p.nodeIds?.length) {
    return createSingleFrame({
      ...p,
      name: p.name || "Auto Layout",
      layoutMode: p.layoutMode || "VERTICAL",
      layoutSizingHorizontal: p.layoutSizingHorizontal || "HUG",
      layoutSizingVertical: p.layoutSizingVertical || "HUG",
    });
  }

  // Wrap existing nodes into an auto-layout frame
  const nodes: SceneNode[] = [];
  for (const id of p.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node as SceneNode);
  }

  const originalParent = nodes[0].parent || figma.currentPage;

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if ("x" in n && "y" in n && "width" in n && "height" in n) {
      const nx = (n as any).x, ny = (n as any).y, nw = (n as any).width, nh = (n as any).height;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    }
  }

  const frame = figma.createFrame();
  frame.name = p.name || "Auto Layout";
  frame.fills = [];
  if (minX !== Infinity) {
    frame.x = minX;
    frame.y = minY;
    frame.resize(maxX - minX, maxY - minY);
  }

  if ("appendChild" in originalParent) (originalParent as any).appendChild(frame);
  for (const node of nodes) frame.appendChild(node);

  // Apply all frame properties (layout, fill, stroke, etc.)
  const hints: string[] = [];
  await applyTokens(frame, { opacity: p.opacity }, hints);

  frame.layoutMode = p.layoutMode || "VERTICAL";
  for (const f of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"] as const) {
    if (p[f] === undefined) (frame as any)[f] = 0;
  }
  await applyTokens(frame, {
    paddingTop: p.paddingTop, paddingRight: p.paddingRight,
    paddingBottom: p.paddingBottom, paddingLeft: p.paddingLeft,
    itemSpacing: p.itemSpacing,
  }, hints);
  if (p.primaryAxisAlignItems) frame.primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems) frame.counterAxisAlignItems = p.counterAxisAlignItems;
  frame.layoutSizingHorizontal = p.layoutSizingHorizontal || "HUG";
  frame.layoutSizingVertical = p.layoutSizingVertical || "HUG";
  if (p.layoutWrap) frame.layoutWrap = p.layoutWrap;
  if (p.counterAxisSpacing !== undefined && p.layoutWrap === "WRAP") {
    await applyTokens(frame, { counterAxisSpacing: p.counterAxisSpacing }, hints);
  }

  await applyFillWithAutoBind(frame, p, hints);
  await applyStrokeWithAutoBind(frame, p, hints);

  const result: any = { id: frame.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_frame: (p) => batchHandler(p, createSingleFrame),
  create_auto_layout: (p) => batchHandler(p, createSingleAutoLayout),
};
