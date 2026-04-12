import { batchHandler, appendAndApplySizing, applySizing, checkOverlappingSiblings, isSmallIntrinsic, applyFillWithAutoBind, applyImageFill, applyStrokeWithAutoBind, applyCornerRadius, applyTokens, normalizeAliases, warnCrossAxisHug, FRAME_ALIAS_KEYS, type Hint } from "./helpers";
import { looksInteractive } from "@ufira/vibma/utils/wcag";
import { framesCreateFrame, framesCreateAutoLayout } from "@ufira/vibma/guards";
import { createInlineChildren, collectTextChildren, normalizeInlineChildTypes } from "./components";
import { prepCreateText } from "./create-text";
import { validateAndFixInlineChildren, formatDiff, buildCorrectedPayload } from "./inline-tree";
import { createStageContainer } from "./stage";
import { applyAnnotations } from "./annotations";

/**
 * Resolve the effective layoutMode from params.
 * Single source of truth for auto-layout intent detection on create paths.
 *
 * Priority:
 *   1. Explicit layoutMode → use as-is
 *   2. AL-only params present (padding, spacing, alignment, wrap) → infer VERTICAL
 *   3. HUG sizing requested → infer VERTICAL (HUG requires AL on the node)
 *   4. Default → NONE (static frame)
 *
 * Explicit layoutMode:"NONE" is respected — the agent opted out.
 */
function resolveLayoutMode(p: any): { layoutMode: string; inferred: boolean } {
  const hasALParams =
    p.paddingTop !== undefined || p.paddingRight !== undefined ||
    p.paddingBottom !== undefined || p.paddingLeft !== undefined ||
    p.itemSpacing !== undefined ||
    p.primaryAxisAlignItems !== undefined ||
    p.counterAxisAlignItems !== undefined ||
    p.counterAxisSpacing !== undefined ||
    (p.layoutWrap !== undefined && p.layoutWrap !== "NO_WRAP");

  const hasHUGSizing =
    p.layoutSizingHorizontal === "HUG" || p.layoutSizingVertical === "HUG";

  // Explicit NONE + AL params is contradictory — reject
  if (p.layoutMode === "NONE" && (hasALParams || hasHUGSizing)) {
    const alProps = [
      hasALParams && "padding/spacing/alignment",
      hasHUGSizing && "HUG sizing",
    ].filter(Boolean).join(" and ");
    throw new Error(`layoutMode:'NONE' conflicts with ${alProps}. Static frames do not support layout properties. Remove layoutMode:'NONE' to enable auto-layout.`);
  }

  // Explicit NONE without dimensions — agent must specify size for static frames
  if (p.layoutMode === "NONE" && (p.width === undefined || p.height === undefined)) {
    throw new Error("layoutMode:'NONE' creates a static frame — specify both width and height. Omit layoutMode to let the frame shrink to content automatically.");
  }

  if (p.layoutMode !== undefined) return { layoutMode: p.layoutMode, inferred: false };

  if (hasALParams || hasHUGSizing) {
    return { layoutMode: "VERTICAL", inferred: true };
  }

  return { layoutMode: "NONE", inferred: false };
}

/**
 * Shared setup for frame-like nodes (Frame, Component).
 * Applies layout, fill, stroke, corner radius, opacity, min/max, WCAG checks.
 * Returns { parent, hints } so the caller can add type-specific logic.
 *
 * Single source of truth for frame-like node setup.
 * Handles: alias normalization, positioning, resize, fills reset,
 * padding, layout mode, fill/stroke, corners, sizing, WCAG checks.
 * Callers only need to set node-specific properties (name, description).
 */
export async function setupFrameNode(
  node: FrameNode | ComponentNode,
  p: any,
): Promise<{ parent: BaseNode | null; hints: Hint[] }> {
  // ── Normalize aliases: fillVariableName → fills, strokeVariableName → strokes ──
  normalizeAliases(p, FRAME_ALIAS_KEYS);

  // ── Common setup: position, resize, clear default fill ──
  if (p.x !== undefined) node.x = p.x;
  if (p.y !== undefined) node.y = p.y;
  if (p.width !== undefined || p.height !== undefined) {
    node.resize(p.width ?? node.width, p.height ?? node.height);
  }
  node.fills = [];

  // Expand padding shorthand → per-edge (token values preserved)
  if (p.padding !== undefined) {
    p.paddingTop ??= p.padding;
    p.paddingRight ??= p.padding;
    p.paddingBottom ??= p.padding;
    p.paddingLeft ??= p.padding;
  }

  // ── Resolve layoutMode: single source of truth for create path ──
  const { layoutMode, inferred: inferredLayoutMode } = resolveLayoutMode(p);

  const {
    layoutWrap = "NO_WRAP",
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    parentId,
  } = p;

  const hints: Hint[] = [];

  if (inferredLayoutMode) {
    hints.push({ type: "suggest", message: `No layoutMode specified — defaulted to layoutMode:'${layoutMode}' because padding/spacing/alignment require auto-layout.` });
  }

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
    // Validate: WRAP only works with HORIZONTAL (Figma engine constraint)
    if (layoutWrap === "WRAP" && layoutMode === "VERTICAL") {
      throw new Error("layoutWrap 'WRAP' requires layoutMode 'HORIZONTAL' — Figma does not support wrap on vertical layouts. Use column frames inside a horizontal parent for vertical grid patterns.");
    }
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
    if (p.counterAxisSpacing !== undefined) {
      if (layoutWrap !== "WRAP") {
        node.layoutWrap = "WRAP";
        hints.push({ type: "confirm", message: "Enabled layoutWrap='WRAP' because counterAxisSpacing requires it." });
      }
      await applyTokens(node, { counterAxisSpacing: p.counterAxisSpacing }, hints);
    }
  }

  // Fill & stroke (image fill takes precedence over color fill)
  const hasImageFill = await applyImageFill(node, p, hints);
  if (!hasImageFill) await applyFillWithAutoBind(node, p, hints);
  await applyStrokeWithAutoBind(node, p, hints);
  if (p.strokeAlign) node.strokeAlign = p.strokeAlign;
  if (p.strokesIncludedInLayout !== undefined) (node as any).strokesIncludedInLayout = p.strokesIncludedInLayout;

  // Effect style: local first, library fallback via _effectStyleKey
  if (p.effectStyleName) {
    const styles = await figma.getLocalEffectStylesAsync();
    const exact = styles.find(s => s.name === p.effectStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.effectStyleName.toLowerCase()));
    if (match) {
      await (node as any).setEffectStyleIdAsync(match.id);
    } else if (p._effectStyleKey) {
      try {
        const style = await figma.importStyleByKeyAsync(p._effectStyleKey);
        await (node as any).setEffectStyleIdAsync(style.id);
      } catch (e: any) {
        hints.push({ type: "error", message: `effectStyleName '${p.effectStyleName}' (library import) failed: ${e.message}. Ensure the source library is enabled for this file.` });
      }
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

  // Overlapping children: detect sibling at same position in non-auto-layout parent.
  // Callers can set _skipOverlapCheck to suppress for transient nodes (e.g. variant children
  // that will be combined into a set immediately after creation).
  if (!p._skipOverlapCheck) {
    checkOverlappingSiblings(node, parent, hints);
  }

  // Context-aware HUG/HUG warning: only for containers that need a width constraint
  if (layoutMode !== "NONE" && node.layoutSizingHorizontal === "HUG" && node.layoutSizingVertical === "HUG") {
    const isRoot = !parent || parent.type === "PAGE";
    const children = "children" in node ? (node as any).children as SceneNode[] : [];
    const hasTextChildren = children.some((c: any) => c.type === "TEXT");
    const hasFillChildren = children.some((c: any) => c.layoutSizingHorizontal === "FILL");

    if (isRoot && (hasTextChildren || hasFillChildren) && !isSmallIntrinsic(node)) {
      const name = node.name || "Frame";
      hints.push({ type: "warn", message: `"${name}" has HUG on both axes with ${hasTextChildren ? "text" : "FILL"} children but no width constraint. Text won't wrap and FILL children collapse. Set a width and layoutSizingHorizontal:"FIXED".` });
    }
    // Nested HUG/HUG: no warning — parent provides constraint or cascades to root-level finding
    // Leaf containers (buttons, badges) with HUG/HUG: no warning — intentional
  }

  warnCrossAxisHug(node, parent, hints);

  // WCAG 2.5.8: target size recommendation for interactive elements
  if (looksInteractive(node) && (node.width < 24 || node.height < 24)) {
    hints.push({ type: "suggest", message: "WCAG: Min 24x24px for touch targets." });
  }

  // Annotations
  applyAnnotations(node, p, hints);

  return { parent, hints };
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleFrame(p: any) {
  const hints: Hint[] = [];

  // Validate inline children BEFORE creating any Figma nodes.
  // May promote p.layoutMode, fix child sizing. Returns inference tracking.
  if (p.children?.length) {
    // _originalParams captured by batchHandler BEFORE alias normalization
    const originalParams = p._originalParams;
    delete p._originalParams;

    normalizeInlineChildTypes(p.children);
    const validation = validateAndFixInlineChildren(p, hints);

    if (validation.hasAmbiguity) {
      const diff = formatDiff(validation.inferences);
      const correctedPayload = buildCorrectedPayload(p, originalParams);
      const canEdit = p._caps?.edit;

      // Edit-tier: auto-stage — create in stage container, return staged result
      if (canEdit) {
        const stageFrame = await createStageContainer(p, p.name || "Frame");
        try {
          // Build the tree inside the stage container
          const stagedP = { ...p, parentId: stageFrame.id, x: undefined, y: undefined };
          const frame = figma.createFrame();
          frame.name = p.name || "Frame";
          const { hints: setupHints } = await setupFrameNode(frame, stagedP);
          hints.push(...setupHints);
          if (p.children?.length) {
            const textChildren = collectTextChildren(p.children);
            const textCtx = await prepCreateText({ items: textChildren });
            await createInlineChildren(frame, null, p.children, hints, textCtx);
          }
          return { id: stageFrame.id, status: "staged", diff, correctedPayload, hints };
        } catch (e) {
          stageFrame.remove();
          throw e;
        }
      }

      // Create-tier: reject with structured learning payload
      return {
        error: `Ambiguous layout intent detected — review the diff and re-create with the corrected payload.`,
        diff,
        correctedPayload,
      };
    }
  }

  const frame = figma.createFrame();
  try {
    frame.name = p.name || "Frame";

    const { hints: setupHints } = await setupFrameNode(frame, p);
    hints.push(...setupHints);

    // Create inline children after setup (Figma node is now configured)
    if (p.children?.length) {
      const textChildren = collectTextChildren(p.children);
      const textCtx = await prepCreateText({ items: textChildren });
      await createInlineChildren(frame, null, p.children, hints, textCtx);
    }

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

  // children + nodeIds is contradictory — nodeIds wraps existing nodes, children creates new ones
  if (p.nodeIds?.length && p.children?.length) {
    throw new Error("Cannot use both nodeIds and children. Use nodeIds to wrap existing nodes, or children to create inline child nodes.");
  }

  // If no nodeIds, create a fresh auto-layout frame (matching YAML schema)
  // auto_layout always creates AL — force VERTICAL if not specified.
  // Sizing is handled by applySizing (HUG for top-level, smart cross-axis for nested).
  if (!p.nodeIds?.length) {
    const { nodeIds: _, ...rest } = p;
    return createSingleFrame({
      ...rest,
      name: p.name || "Auto Layout",
      layoutMode: p.layoutMode || "VERTICAL",
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

    const hasImageFill = await applyImageFill(frame, p, hints);
    if (!hasImageFill) await applyFillWithAutoBind(frame, p, hints);
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
