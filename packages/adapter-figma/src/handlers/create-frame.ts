import { batchHandler, appendToParent, solidPaint, styleNotFoundHint, suggestStyleForColor, findVariableById } from "./helpers";
import { looksInteractive } from "@ufira/vibma/utils/wcag";

// ─── Figma Handlers ──────────────────────────────────────────────

async function resolvePaintStyle(name: string): Promise<{ id: string | null, available: string[] }> {
  const styles = await figma.getLocalPaintStylesAsync();
  const available = styles.map(s => s.name);
  const exact = styles.find(s => s.name === name);
  if (exact) return { id: exact.id, available };
  const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  return { id: fuzzy?.id ?? null, available };
}

async function createSingleFrame(p: any) {
  const {
    x = 0, y = 0, width = 100, height = 100, name = "Frame", parentId,
    fillColor, strokeColor, strokeWeight, cornerRadius,
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0,
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    itemSpacing = 0,
    fillStyleName, strokeStyleName,
    fillVariableId, strokeVariableId,
  } = p;

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;
  frame.fills = []; // no fill by default
  if (cornerRadius !== undefined) frame.cornerRadius = cornerRadius;

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
  }

  // Fill: variableId > styleName > direct color
  const hints: string[] = [];
  let fillTokenized = false;
  if (fillVariableId) {
    const v = await findVariableById(fillVariableId);
    if (v) {
      frame.fills = [solidPaint(fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(frame.fills[0] as SolidPaint, "color", v);
      frame.fills = [bound];
      fillTokenized = true;
    } else {
      hints.push(`fillVariableId '${fillVariableId}' not found.`);
    }
  } else if (fillStyleName) {
    const { id: sid, available } = await resolvePaintStyle(fillStyleName);
    if (sid) {
      try { await (frame as any).setFillStyleIdAsync(sid); fillTokenized = true; }
      catch (e: any) { hints.push(`fillStyleName '${fillStyleName}' matched but failed to apply: ${e.message}`); }
    } else hints.push(styleNotFoundHint("fillStyleName", fillStyleName, available));
  } else if (fillColor) {
    frame.fills = [solidPaint(fillColor)];
    const suggestion = await suggestStyleForColor(fillColor, "fillStyleName");
    if (suggestion) hints.push(suggestion);
  }

  // Stroke: variableId > styleName > direct color
  let strokeTokenized = false;
  if (strokeVariableId) {
    const v = await findVariableById(strokeVariableId);
    if (v) {
      frame.strokes = [solidPaint(strokeColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(frame.strokes[0] as SolidPaint, "color", v);
      frame.strokes = [bound];
      strokeTokenized = true;
    } else {
      hints.push(`strokeVariableId '${strokeVariableId}' not found.`);
    }
  } else if (strokeStyleName) {
    const { id: sid, available } = await resolvePaintStyle(strokeStyleName);
    if (sid) {
      try { await (frame as any).setStrokeStyleIdAsync(sid); strokeTokenized = true; }
      catch (e: any) { hints.push(`strokeStyleName '${strokeStyleName}' matched but failed to apply: ${e.message}`); }
    } else hints.push(styleNotFoundHint("strokeStyleName", strokeStyleName, available));
  } else if (strokeColor) {
    frame.strokes = [solidPaint(strokeColor)];
    const suggestion = await suggestStyleForColor(strokeColor, "strokeStyleName");
    if (suggestion) hints.push(suggestion);
  }
  if (strokeWeight !== undefined) frame.strokeWeight = strokeWeight;

  // Append to parent or page (with deferred FILL sizing)
  const parent = await appendToParent(frame, parentId);
  if (parent) {
    if (deferH) { try { frame.layoutSizingHorizontal = "FILL"; } catch {} }
    if (deferV) { try { frame.layoutSizingVertical = "FILL"; } catch {} }
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
  if (!p.nodeIds?.length) throw new Error("Missing nodeIds");

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
