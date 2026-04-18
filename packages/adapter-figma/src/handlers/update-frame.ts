import { batchHandler, applyTokens, applySizing, type Hint } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

const LAYOUT_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SLOT"];

export async function updateFrameSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);

  const hints: Hint[] = [];
  const isLayoutType = LAYOUT_TYPES.includes(node.type);

  // ── Detect whether auto-layout properties are being set ────────
  // If the agent sets padding, spacing, alignment, or wrap without an explicit
  // layoutMode, they clearly intend auto-layout. Promote to HORIZONTAL and confirm
  // rather than throwing — the intent is readable, so honour it.

  const settingLayoutMode = p.layoutMode !== undefined;
  let hasAutoLayout = settingLayoutMode
    ? p.layoutMode !== "NONE"
    : (isLayoutType && (node as any).layoutMode !== "NONE");

  const needsAutoLayout = !hasAutoLayout && isLayoutType && (
    p.paddingTop !== undefined || p.paddingRight !== undefined ||
    p.paddingBottom !== undefined || p.paddingLeft !== undefined ||
    p.primaryAxisAlignItems !== undefined || p.counterAxisAlignItems !== undefined ||
    p.itemSpacing !== undefined || p.counterAxisSpacing !== undefined ||
    p.layoutWrap !== undefined
  );

  if (needsAutoLayout) {
    (node as any).layoutMode = "HORIZONTAL";
    hasAutoLayout = true;
    hints.push({ type: "confirm", message: "Enabled auto-layout (HORIZONTAL) because layout properties (padding/spacing/alignment) require it." });
  }

  // Guard: layout properties on non-layout nodes (TEXT, RECTANGLE, etc.) are
  // clearly a wrong-target mistake. Warn + skip all layout work rather than throw.
  if (!isLayoutType) {
    const layoutProps = [
      settingLayoutMode && "layoutMode",
      p.layoutWrap !== undefined && "layoutWrap",
      (p.paddingTop !== undefined || p.paddingRight !== undefined ||
       p.paddingBottom !== undefined || p.paddingLeft !== undefined) && "padding",
      (p.primaryAxisAlignItems !== undefined || p.counterAxisAlignItems !== undefined) && "alignment",
      p.itemSpacing !== undefined && "itemSpacing",
      p.counterAxisSpacing !== undefined && "counterAxisSpacing",
      (p.layoutSizingHorizontal !== undefined || p.layoutSizingVertical !== undefined) && "sizing",
    ].filter(Boolean) as string[];
    if (layoutProps.length > 0) {
      hints.push({ type: "warn", message: `Node type ${node.type} does not support layout properties (${layoutProps.join(", ")}) — ignored. These only work on FRAME, COMPONENT, COMPONENT_SET, INSTANCE, and SLOT.` });
      const result: any = {};
      if (hints.length > 0) result.hints = hints;
      return result;
    }
  }

  // 1. Layout mode & wrap
  // Validate: WRAP only works with HORIZONTAL (Figma engine constraint)
  if (p.layoutWrap === "WRAP") {
    const effectiveMode = p.layoutMode ?? (node as any).layoutMode;
    if (effectiveMode === "VERTICAL") {
      throw new Error("layoutWrap 'WRAP' requires layoutMode 'HORIZONTAL' — Figma does not support wrap on vertical layouts. Use column frames inside a horizontal parent for vertical grid patterns.");
    }
  }
  if (settingLayoutMode) {
    (node as any).layoutMode = p.layoutMode;
    if (p.layoutMode !== "NONE" && p.layoutWrap) (node as any).layoutWrap = p.layoutWrap;
  } else if (p.layoutWrap !== undefined) {
    (node as any).layoutWrap = p.layoutWrap;
  }

  // 2. Padding (supports token strings for variable binding)
  const hasPadding = p.paddingTop !== undefined || p.paddingRight !== undefined ||
                     p.paddingBottom !== undefined || p.paddingLeft !== undefined;
  if (hasPadding) {
    await applyTokens(node, {
      paddingTop: p.paddingTop, paddingRight: p.paddingRight,
      paddingBottom: p.paddingBottom, paddingLeft: p.paddingLeft,
    }, hints);
  }

  // 3. Alignment
  if (p.primaryAxisAlignItems !== undefined) (node as any).primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems !== undefined) (node as any).counterAxisAlignItems = p.counterAxisAlignItems;

  // 4. Sizing (shared validation — downgrades invalid HUG/FILL with warnings)
  if (p.layoutSizingHorizontal !== undefined || p.layoutSizingVertical !== undefined) {
    applySizing(node as SceneNode, node.parent, p, hints, false);
  }

  // 5. Spacing (supports token strings for variable binding)
  if (p.itemSpacing !== undefined) {
    await applyTokens(node, { itemSpacing: p.itemSpacing }, hints);
  }
  if (p.counterAxisSpacing !== undefined) {
    // counterAxisSpacing implies WRAP — enable it if not already set
    const wrap = p.layoutWrap || (node as any).layoutWrap;
    if (wrap !== "WRAP") {
      (node as any).layoutWrap = "WRAP";
      hints.push({ type: "confirm", message: "Enabled layoutWrap='WRAP' because counterAxisSpacing requires it." });
    }
    await applyTokens(node, { counterAxisSpacing: p.counterAxisSpacing }, hints);
  }

  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  update_frame: (p) => batchHandler(p, updateFrameSingle),
};
