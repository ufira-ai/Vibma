import { batchHandler, appendToParent, applyFillWithAutoBind, applyStrokeWithAutoBind, bindNumericVariable } from "./helpers";
import { looksInteractive } from "@ufira/vibma/utils/wcag";

async function createSingleFrame(p: any) {
  const {
    x = 0, y = 0, width = 100, height = 100, name = "Frame", parentId,
    cornerRadius,
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0,
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    itemSpacing = 0,
  } = p;

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;
  frame.fills = []; // no fill by default
  if (cornerRadius !== undefined) frame.cornerRadius = cornerRadius;

  // Bind numeric variables
  const hints: string[] = [];
  if (p.cornerRadiusVariableName) {
    await bindNumericVariable(frame, ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"], p.cornerRadiusVariableName, hints);
  }
  if (p.opacityVariableName) {
    await bindNumericVariable(frame, "opacity", p.opacityVariableName, hints);
  }
  if (p.itemSpacingVariableName) {
    await bindNumericVariable(frame, "itemSpacing", p.itemSpacingVariableName, hints);
  }

  const deferH = parentId && layoutSizingHorizontal === "FILL";
  const deferV = parentId && layoutSizingVertical === "FILL";

  if (layoutMode !== "NONE") {
    frame.layoutMode = layoutMode;
    frame.layoutWrap = layoutWrap;
    frame.paddingTop = paddingTop;
    frame.paddingRight = paddingRight;
    frame.paddingBottom = paddingBottom;
    frame.paddingLeft = paddingLeft;
    frame.primaryAxisAlignItems = primaryAxisAlignItems;
    frame.counterAxisAlignItems = counterAxisAlignItems;
    frame.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
    frame.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
    frame.itemSpacing = itemSpacing;
    if (p.counterAxisSpacing !== undefined && layoutWrap === "WRAP") {
      (frame as any).counterAxisSpacing = p.counterAxisSpacing;
    }
  }

  // Fill & stroke: shared helpers handle variableName > variableId > styleName > color (with auto-bind)
  await applyFillWithAutoBind(frame, p, hints);
  await applyStrokeWithAutoBind(frame, p, hints);

  // Min/max dimensions (responsive auto-layout constraints)
  if (p.minWidth !== undefined) (frame as any).minWidth = p.minWidth;
  if (p.maxWidth !== undefined) (frame as any).maxWidth = p.maxWidth;
  if (p.minHeight !== undefined) (frame as any).minHeight = p.minHeight;
  if (p.maxHeight !== undefined) (frame as any).maxHeight = p.maxHeight;

  // Append to parent or page (with deferred FILL sizing)
  const parent = await appendToParent(frame, parentId);
  const parentIsAL = parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  if (parent) {
    if (deferH) {
      if (parentIsAL) { frame.layoutSizingHorizontal = "FILL"; }
      else { hints.push("layoutSizingHorizontal 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first."); }
    }
    if (deferV) {
      if (parentIsAL) { frame.layoutSizingVertical = "FILL"; }
      else { hints.push("layoutSizingVertical 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first."); }
    }
    // Warn if child defaults to FIXED inside an auto-layout parent
    if (!deferH && !deferV && parentIsAL) {
      if (layoutSizingHorizontal === "FIXED" && layoutSizingVertical === "FIXED" && layoutMode === "NONE") {
        hints.push("Child has FIXED sizing inside auto-layout parent. Consider layoutSizingHorizontal/Vertical: 'FILL' or 'HUG' for responsive layout.");
      }
    }
  }

  // WCAG 2.5.8: target size recommendation for interactive elements
  if (looksInteractive(frame) && (frame.width < 24 || frame.height < 24)) {
    hints.push("WCAG: Min 24x24px for touch targets.");
  }

  const result: any = { id: frame.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function createSingleAutoLayout(p: any) {
  // Expand padding shorthand
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

  frame.layoutMode = p.layoutMode || "VERTICAL";
  frame.itemSpacing = p.itemSpacing ?? 0;
  frame.paddingTop = p.paddingTop ?? 0;
  frame.paddingRight = p.paddingRight ?? 0;
  frame.paddingBottom = p.paddingBottom ?? 0;
  frame.paddingLeft = p.paddingLeft ?? 0;
  if (p.primaryAxisAlignItems) frame.primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems) frame.counterAxisAlignItems = p.counterAxisAlignItems;
  frame.layoutSizingHorizontal = p.layoutSizingHorizontal || "HUG";
  frame.layoutSizingVertical = p.layoutSizingVertical || "HUG";
  if (p.layoutWrap) frame.layoutWrap = p.layoutWrap;

  return { id: frame.id };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_frame: (p) => batchHandler(p, createSingleFrame),
  create_auto_layout: (p) => batchHandler(p, createSingleAutoLayout),
};
