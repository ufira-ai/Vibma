import { batchHandler, appendAndApplySizing, applySizing, checkOverlappingSiblings, applyFillWithAutoBind, applyStrokeWithAutoBind, applyCornerRadius, applyTokens, normalizeAliases, FRAME_ALIAS_KEYS, type Hint } from "./helpers";
import { looksInteractive } from "@ufira/vibma/utils/wcag";
import { framesCreateFrame, framesCreateAutoLayout } from "@ufira/vibma/guards";

/**
 * Shared setup for frame-like nodes (Frame, Component).
 * Applies layout, fill, stroke, corner radius, opacity, min/max, WCAG checks.
 * Returns { parent, hints } so the caller can add type-specific logic.
 *
 * CONTRACT: `p` must have been through `normalizeAliases()` — `fills` and `strokes`
 * must be in canonical form (not `fillColor`, `fontColor`, etc.).
 * When called via batchHandler this is automatic; other callers must normalize first.
 */
export async function setupFrameNode(
  node: FrameNode | ComponentNode,
  p: any,
): Promise<{ parent: BaseNode | null; hints: Hint[] }> {
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

  const hints: Hint[] = [];

  // Corner radius
  await applyCornerRadius(node, p, hints);
  // Opacity
  await applyTokens(node, { opacity: p.opacity }, hints);
  if (p.visible === false) node.visible = false;
  if (p.locked === true) node.locked = true;
  if (p.rotation !== undefined) (node as any).rotation = p.rotation;
  if (p.blendMode) (node as any).blendMode = p.blendMode;
  if (p.layoutPositioning === "ABSOLUTE") (node as any).layoutPositioning = "ABSOLUTE";
  if (p.overflowDirection && p.overflowDirection !== "NONE") (node as any).overflowDirection = p.overflowDirection;

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
    if (p.counterAxisSpacing !== undefined && layoutWrap === "WRAP") {
      await applyTokens(node, { counterAxisSpacing: p.counterAxisSpacing }, hints);
    }
  }

  // Fill & stroke
  await applyFillWithAutoBind(node, p, hints);
  await applyStrokeWithAutoBind(node, p, hints);
  if (p.strokeAlign) node.strokeAlign = p.strokeAlign;
  if (p.strokesIncludedInLayout !== undefined) (node as any).strokesIncludedInLayout = p.strokesIncludedInLayout;

  // Effect style
  if (p.effectStyleName) {
    const styles = await figma.getLocalEffectStylesAsync();
    const exact = styles.find(s => s.name === p.effectStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.effectStyleName.toLowerCase()));
    if (match) {
      await (node as any).setEffectStyleIdAsync(match.id);
    } else {
      const names = styles.map(s => s.name).slice(0, 20);
      const suffix = styles.length > 20 ? `, … and ${styles.length - 20} more` : "";
      hints.push({ type: "error", message: `effectStyleName '${p.effectStyleName}' not found. Available: [${names.join(", ")}${suffix}]` });
    }
  }

  // Min/max dimensions
  if (p.minWidth !== undefined) (node as any).minWidth = p.minWidth;
  if (p.maxWidth !== undefined) (node as any).maxWidth = p.maxWidth;
  if (p.minHeight !== undefined) (node as any).minHeight = p.minHeight;
  if (p.maxHeight !== undefined) (node as any).maxHeight = p.maxHeight;

  // Append to parent + apply sizing (FILL deferred, smart cross-axis defaults, FIXED warning)
  const parent = await appendAndApplySizing(node, p, hints);

  // Overlapping children: detect sibling at same position in non-auto-layout parent
  checkOverlappingSiblings(node, parent, hints);

  // Context-aware HUG/HUG warning: only for containers that need a width constraint
  if (layoutMode !== "NONE" && node.layoutSizingHorizontal === "HUG" && node.layoutSizingVertical === "HUG") {
    const isRoot = !parent || parent.type === "PAGE";
    const children = "children" in node ? (node as any).children as SceneNode[] : [];
    const hasTextChildren = children.some((c: any) => c.type === "TEXT");
    const hasFillChildren = children.some((c: any) => c.layoutSizingHorizontal === "FILL");

    if (isRoot && (hasTextChildren || hasFillChildren)) {
      const name = node.name || "Frame";
      hints.push({ type: "warn", message: `"${name}" has HUG on both axes with ${hasTextChildren ? "text" : "FILL"} children but no width constraint. Text won't wrap and FILL children collapse. Set a width and layoutSizingHorizontal:"FIXED".` });
    }
    // Nested HUG/HUG: no warning — parent provides constraint or cascades to root-level finding
    // Leaf containers (buttons, badges) with HUG/HUG: no warning — intentional
  }

  // HUG on cross-axis of constrained parent — child won't fill available space
  if (parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE") {
    const parentAL = parent as any;
    const isHorizontal = parentAL.layoutMode === "HORIZONTAL";
    const parentCross = isHorizontal ? parentAL.layoutSizingVertical : parentAL.layoutSizingHorizontal;
    const childCross = isHorizontal ? node.layoutSizingVertical : node.layoutSizingHorizontal;
    if ((parentCross === "FIXED" || parentCross === "FILL") && childCross === "HUG") {
      const crossProp = isHorizontal ? "layoutSizingVertical" : "layoutSizingHorizontal";
      hints.push({ type: "warn", message: `HUG on cross-axis of constrained parent — won't fill available space. Use ${crossProp}:"FILL".` });
    }
  }

  // WCAG 2.5.8: target size recommendation for interactive elements
  if (looksInteractive(node) && (node.width < 24 || node.height < 24)) {
    hints.push({ type: "suggest", message: "WCAG: Min 24x24px for touch targets." });
  }

  return { parent, hints };
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleFrame(p: any) {
  const frame = figma.createFrame();
  try {
    frame.x = p.x ?? 0;
    frame.y = p.y ?? 0;
    frame.resize(p.width ?? 100, p.height ?? 100);
    frame.name = p.name || "Frame";
    frame.fills = [];

    const { hints } = await setupFrameNode(frame, p);

    const result: any = { id: frame.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    frame.remove();
    throw e;
  }
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
    const { nodeIds: _, ...rest } = p;
    // Only inject HUG defaults when agent didn't specify and there's no parentId
    // (applySizing handles smart cross-axis defaults when parentId is set)
    return createSingleFrame({
      ...rest,
      name: p.name || "Auto Layout",
      layoutMode: p.layoutMode || "VERTICAL",
      // Top-level auto_layout: default HUG. Child: let applySizing decide.
      layoutSizingHorizontal: p.layoutSizingHorizontal || (p.width !== undefined ? "FIXED" : p.parentId ? undefined : "HUG"),
      layoutSizingVertical: p.layoutSizingVertical || (p.height !== undefined ? "FIXED" : p.parentId ? undefined : "HUG"),
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
  try {
    frame.name = p.name || "Auto Layout";
    frame.fills = [];
    if (minX !== Infinity) {
      frame.x = minX;
      frame.y = minY;
      frame.resize(maxX - minX, maxY - minY);
    }

    if ("appendChild" in originalParent) (originalParent as any).appendChild(frame);
    for (const node of nodes) frame.appendChild(node);

    // Normalize fill/stroke aliases — this path bypasses batchHandler's per-item normalization
    normalizeAliases(p, FRAME_ALIAS_KEYS);

    // Apply all frame properties (layout, fill, stroke, etc.)
    const hints: Hint[] = [];
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
    applySizing(frame, originalParent, {
      layoutSizingHorizontal: p.layoutSizingHorizontal || "HUG",
      layoutSizingVertical: p.layoutSizingVertical || "HUG",
    }, hints);
    if (p.layoutWrap) frame.layoutWrap = p.layoutWrap;
    if (p.counterAxisSpacing !== undefined && p.layoutWrap === "WRAP") {
      await applyTokens(frame, { counterAxisSpacing: p.counterAxisSpacing }, hints);
    }

    await applyFillWithAutoBind(frame, p, hints);
    await applyStrokeWithAutoBind(frame, p, hints);
    await applyCornerRadius(frame, p, hints);

    const result: any = { id: frame.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    // Return wrapped nodes to original parent before removing the frame
    for (const node of [...frame.children]) {
      (originalParent as any).appendChild(node);
    }
    frame.remove();
    throw e;
  }
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_frame: (p) => batchHandler(p, createSingleFrame, { keys: framesCreateFrame, help: 'frames(method: "help", topic: "create")' }),
  create_auto_layout: (p) => batchHandler(p, createSingleAutoLayout, { keys: framesCreateAutoLayout, help: 'frames(method: "help", topic: "create")' }),
};
