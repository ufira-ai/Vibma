import { batchHandler, applyTokens, type Hint } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

const LAYOUT_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

export async function updateFrameSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);

  const hints: Hint[] = [];
  const isLayoutType = LAYOUT_TYPES.includes(node.type);
  const settingLayoutMode = p.layoutMode !== undefined;
  // Auto-layout is active if already set OR being set in this call
  const hasAutoLayout = settingLayoutMode
    ? p.layoutMode !== "NONE"
    : (isLayoutType && (node as any).layoutMode !== "NONE");

  // 1. Layout mode & wrap
  if (settingLayoutMode) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support layoutMode`);
    (node as any).layoutMode = p.layoutMode;
    if (p.layoutMode !== "NONE" && p.layoutWrap) (node as any).layoutWrap = p.layoutWrap;
  } else if (p.layoutWrap !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support layoutWrap`);
    if (!hasAutoLayout) throw new Error("layoutWrap requires auto-layout (layoutMode !== NONE)");
    (node as any).layoutWrap = p.layoutWrap;
  }

  // 2. Padding (supports token strings for variable binding)
  const hasPadding = p.paddingTop !== undefined || p.paddingRight !== undefined ||
                     p.paddingBottom !== undefined || p.paddingLeft !== undefined;
  if (hasPadding) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support padding`);
    if (!hasAutoLayout) throw new Error("Padding requires auto-layout (layoutMode !== NONE)");
    await applyTokens(node, {
      paddingTop: p.paddingTop, paddingRight: p.paddingRight,
      paddingBottom: p.paddingBottom, paddingLeft: p.paddingLeft,
    }, hints);
  }

  // 3. Alignment
  if (p.primaryAxisAlignItems !== undefined || p.counterAxisAlignItems !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support axis alignment`);
    if (!hasAutoLayout) throw new Error("Axis alignment requires auto-layout (layoutMode !== NONE)");
    if (p.primaryAxisAlignItems !== undefined) (node as any).primaryAxisAlignItems = p.primaryAxisAlignItems;
    if (p.counterAxisAlignItems !== undefined) (node as any).counterAxisAlignItems = p.counterAxisAlignItems;
  }

  // 4. Sizing (no type check — works on any node in auto-layout)
  if (p.layoutSizingHorizontal !== undefined) (node as any).layoutSizingHorizontal = p.layoutSizingHorizontal;
  if (p.layoutSizingVertical !== undefined) (node as any).layoutSizingVertical = p.layoutSizingVertical;

  // 5. Spacing (supports token strings for variable binding)
  if (p.itemSpacing !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support item spacing`);
    if (!hasAutoLayout) throw new Error("Item spacing requires auto-layout (layoutMode !== NONE)");
    await applyTokens(node, { itemSpacing: p.itemSpacing }, hints);
  }
  if (p.counterAxisSpacing !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support counter-axis spacing`);
    if (!hasAutoLayout) throw new Error("Counter-axis spacing requires auto-layout");
    const wrap = p.layoutWrap || (node as any).layoutWrap;
    if (wrap !== "WRAP") throw new Error("counterAxisSpacing requires layoutWrap=WRAP");
    await applyTokens(node, { counterAxisSpacing: p.counterAxisSpacing }, hints);
  }

  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  update_frame: (p) => batchHandler(p, updateFrameSingle),
};
