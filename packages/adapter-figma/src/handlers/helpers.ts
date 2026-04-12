import { serializeNode, DEFAULT_NODE_BUDGET } from "../utils/serialize-node";
import type { BatchResult } from "@ufira/vibma/types";

// NOTE: the plugin holds ZERO state about imported library styles.
// The MCP pre-processor on frames/text attaches *StyleKey fields next to
// *StyleName; on a local miss, the applier calls figma.importStyleByKeyAsync
// on demand (it's idempotent) and uses the returned style id. This keeps the
// plugin stateless — request/response only. Single source of truth lives in
// the MCP's library registry.

// ─── Hint System ────────────────────────────────────────────────
// Typed warning/hint objects collected by handlers and summarized by batchHandler.

export type HintType = "confirm" | "error" | "suggest" | "warn";
export interface Hint { type: HintType; message: string }

/** Normalize a hint message for dedup: strip quoted strings, parens, brackets. */
function hintKey(h: Hint): string {
  return h.message
    .replace(/'[^']*'/g, "'…'")
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\([^)]*\)/g, "(…)")
    .replace(/\[[^\]]*\]/g, "[…]");
}

// ─── Figma Handler Utilities ────────────────────────────────────
// Shared helpers for plugin-side (Figma) handler functions.

/**
 * Snapshot a node using plugin API serialization.
 * Returns null if node not found. Returns { _truncated, _notice } metadata when budget exceeded.
 */
export async function nodeSnapshot(id: string, depth: number): Promise<any> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) return null;
  const budget = { remaining: DEFAULT_NODE_BUDGET };
  const result = await serializeNode(node, depth, 0, budget);
  if (budget.remaining <= 0) {
    result._truncated = true;
    result._notice = "Snapshot truncated (node budget exceeded). Nodes with _truncated: true are stubs. "
      + "Call get_node_info with their IDs to inspect, or use a shallower depth.";
  }
  return result;
}

/**
 * Process batch items with optional depth enrichment.
 * Reads `items` (array) and `depth` (number|undefined) from params.
 * If depth is defined and a result has an `id`, merges node snapshot into the result.
 */
/**
 * Send a progress update through the Figma plugin → UI → relay → MCP pipeline.
 * This extends the MCP-side timeout (30s → 60s) so long batches don't time out.
 */
function sendBatchProgress(commandId: string, processed: number, total: number, status: "started" | "in_progress" | "completed") {
  const progress = Math.round((processed / total) * 100);
  figma.ui.postMessage({
    type: "command_progress",
    commandId,
    commandType: "batch",
    status,
    progress,
    totalItems: total,
    processedItems: processed,
    message: `Processing ${processed}/${total} items`,
    timestamp: Date.now(),
  });
}

/** Minimal key set for normalizeAliases: text context (fills + fontColor aliases). */
export const TEXT_ALIAS_KEYS: ReadonlySet<string> = new Set(["fills", "fontColor"]);
/** Minimal key set for normalizeAliases: frame context (fills + strokes aliases). */
export const FRAME_ALIAS_KEYS: ReadonlySet<string> = new Set(["fills", "strokes"]);

/**
 * Normalize user-facing param aliases to canonical forms. Mutates `p` in place.
 * Idempotent — once `fills`/`strokes` is set, alias fields are deleted.
 *
 * - fontColor / fontColorVariableName / fontColorStyleName → fills (when keys has "fontColor")
 * - fillColor / fillVariableName / fillStyleName / color / backgroundColor → fills (when keys has "fills")
 * - strokeColor / strokeVariableName / strokeStyleName → strokes (when keys has "strokes")
 *
 * @param p    The item params object (mutated in place)
 * @param keys Key set controlling which alias paths activate. Pass null to normalize all.
 */
export function normalizeAliases(p: Record<string, any>, keys: ReadonlySet<string> | null): void {
  const hasFills = !keys || keys.has("fills");
  const hasFontColor = !keys || keys.has("fontColor");
  const hasStrokes = !keys || keys.has("strokes");

  if (hasFills && !p.fills) {
    const colorAlias = p.color !== undefined && !hasFontColor ? "color"
      : p.backgroundColor !== undefined ? "backgroundColor"
      : p.background !== undefined ? "background"
      : null;
    if (colorAlias) { p.fillColor = p[colorAlias]; delete p[colorAlias]; }
    if (hasFontColor) {
      if (p.fontColorVariableId !== undefined) {
        p.fills = { _variableId: p.fontColorVariableId }; delete p.fontColorVariableId;
      } else if (p.fontColorVariableName !== undefined) {
        p.fills = { _variable: p.fontColorVariableName }; delete p.fontColorVariableName;
      } else if (p.fontColorStyleName !== undefined) {
        p.fills = { _style: p.fontColorStyleName }; delete p.fontColorStyleName;
      } else if (p.fontColor !== undefined) {
        const c = coerceColor(p.fontColor);
        p.fills = c ? [solidPaint(c)] : p.fontColor; delete p.fontColor;
      }
    }
    if (!p.fills && p.fillVariableName !== undefined) {
      p.fills = { _variable: p.fillVariableName }; delete p.fillVariableName;
    } else if (!p.fills && p.fillStyleName !== undefined) {
      p.fills = { _style: p.fillStyleName, _styleKey: p._fillStyleKey }; delete p.fillStyleName; delete p._fillStyleKey;
    } else if (!p.fills && p.fillColor !== undefined) {
      const c = coerceColor(p.fillColor);
      p.fills = c ? [solidPaint(c)] : p.fillColor; delete p.fillColor;
    }
  }

  if (hasStrokes && !p.strokes) {
    if (p.strokeVariableName !== undefined) {
      p.strokes = { _variable: p.strokeVariableName }; delete p.strokeVariableName;
    } else if (p.strokeStyleName !== undefined) {
      p.strokes = { _style: p.strokeStyleName, _styleKey: p._strokeStyleKey }; delete p.strokeStyleName; delete p._strokeStyleKey;
    } else if (p.strokeColor !== undefined) {
      const c = coerceColor(p.strokeColor);
      p.strokes = c ? [solidPaint(c)] : p.strokeColor; delete p.strokeColor;
    }
  }
}

export async function batchHandler<TItem, TResult>(
  params: { items?: TItem[]; depth?: number } & Record<string, unknown>,
  fn: (item: TItem) => Promise<TResult>,
  guard?: { keys: ReadonlySet<string>; help: string },
): Promise<BatchResult<TResult>> {
  const items = (params.items || [params]) as TItem[];
  const depth = params.depth;
  const commandId = (params as any).commandId;

  const useProgress = items.length > 3 && commandId;
  if (useProgress) sendBatchProgress(commandId, 0, items.length, "started");

  const results: Array<TResult | "ok" | { error: string }> = [];
  const allHints: Hint[] = [];
  for (let i = 0; i < items.length; i++) {
    try {
      // Propagate session capabilities to each item for tier-aware branching
      if ((params as any)._caps) (items[i] as any)._caps = (params as any)._caps;
      // Snapshot original params before alias normalization for correctedPayload
      if (guard && (items[i] as any).children?.length) {
        (items[i] as any)._originalParams = JSON.parse(JSON.stringify(items[i]));
      }
      if (guard) {
        normalizeAliases(items[i] as any, guard.keys);
        rejectUnknownParams(items[i] as any, guard.keys, guard.help);
      }
      let result: any = await fn(items[i]);
      if (depth !== undefined && result?.id) {
        const snapshot = await nodeSnapshot(result.id, depth);
        if (snapshot) result = { ...result, ...snapshot };
      }
      // Collect typed hints from each item
      if (result?.hints) {
        allHints.push(...(result.hints as Hint[]));
        delete result.hints;
      }
      // Replace empty objects with "ok" for readability
      if (result && typeof result === "object" && Object.keys(result).length === 0) {
        results.push("ok");
      } else {
        results.push(result);
      }
    } catch (e: any) {
      results.push({ error: e.message });
    }
    if (useProgress && (i + 1) % 3 === 0) {
      sendBatchProgress(commandId, i + 1, items.length, "in_progress");
    }
  }
  if (useProgress) sendBatchProgress(commandId, items.length, items.length, "completed");

  const out: BatchResult<TResult> = { results };

  // Summarize hints: suppress confirmations, dedup suggest/warn, keep errors as-is
  const warnings: string[] = [];
  const grouped = new Map<string, { count: number; example: string }>();
  const hardcodedColors = new Set<string>();
  const HARDCODED_COLOR_RE = /^Hardcoded color (#[0-9a-f]{6,8})/i;
  for (const hint of allHints) {
    if (hint.type === "confirm") continue;
    if (hint.type === "error") {
      warnings.push(hint.message);
    } else {
      // Collect hardcoded color hints for batched summary
      const colorMatch = hint.message.match(HARDCODED_COLOR_RE);
      if (colorMatch) {
        hardcodedColors.add(colorMatch[1]);
        continue;
      }
      // suggest / warn — deduplicate by normalized key
      const key = hintKey(hint);
      const entry = grouped.get(key);
      if (entry) entry.count++;
      else grouped.set(key, { count: 1, example: hint.message });
    }
  }
  for (const [, { count, example }] of grouped) {
    warnings.push(count > 1 ? `(×${count}) ${example}` : example);
  }
  if (hardcodedColors.size > 0) {
    const colors = [...hardcodedColors].join(", ");
    warnings.push(`Hardcoded colors without design tokens: [${colors}]. Create variables with variables(method:"create"), then bind with fillVariableName/strokeVariableName.`);
  }
  if (warnings.length > 0) out.warnings = warnings;

  return out;
}

/**
 * Append a node to a parent (by ID) or the current page.
 * Returns the parent node if parentId was given, null otherwise.
 */
export async function appendToParent(node: SceneNode, parentId?: string): Promise<BaseNode> {
  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) throw new Error(`Parent not found: ${parentId}`);
    if (!("appendChild" in parent))
      throw new Error(`Parent does not support children: ${parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
    (parent as any).appendChild(node);
    return parent;
  }
  figma.currentPage.appendChild(node);
  return figma.currentPage;
}

/**
 * Lightweight post-append overflow check. Call after appending a child to detect
 * when an auto-layout parent with FIXED primary-axis sizing has children whose
 * total exceeds available space. Only fires when `clipsContent` is true (silent
 * clipping) or when the parent uses FIXED sizing — prevents agents from shipping
 * clipped layouts without realizing.
 */
export function checkParentOverflow(parent: BaseNode | null, hints: Hint[]): void {
  if (!parent || parent.type === "PAGE") return;
  const p = parent as any;
  if (!p.layoutMode || p.layoutMode === "NONE") return;
  if (p.overflowDirection && p.overflowDirection !== "NONE") return;
  if (!("children" in p)) return;

  const isH = p.layoutMode === "HORIZONTAL";
  const primarySizing = isH ? p.layoutSizingHorizontal : p.layoutSizingVertical;
  if (primarySizing !== "FIXED") return;

  const padStart = isH ? (p.paddingLeft || 0) : (p.paddingTop || 0);
  const padEnd = isH ? (p.paddingRight || 0) : (p.paddingBottom || 0);
  const primaryInner = (isH ? p.width : p.height) - padStart - padEnd;
  if (primaryInner <= 0) return;

  const children = p.children as any[];
  const spacing = p.itemSpacing || 0;
  const concreteChildren = children.filter((c: any) =>
    "width" in c && (isH ? c.layoutSizingHorizontal : c.layoutSizingVertical) !== "FILL"
  );
  if (concreteChildren.length === 0) return;

  const totalConcrete = concreteChildren.reduce((sum: number, c: any) => sum + (isH ? c.width : c.height), 0);
  const totalSpacing = Math.max(0, children.length - 1) * spacing;
  const totalUsed = totalConcrete + totalSpacing;

  if (totalUsed > primaryInner) {
    const axis = isH ? "width" : "height";
    const scrollDir = isH ? "HORIZONTAL" : "VERTICAL";
    hints.push({
      type: "warn",
      message: `Children overflow ${p.name} on ${axis}: ${Math.round(totalUsed)} used vs ${Math.round(primaryInner)} available. ` +
        `Content will be clipped. Set overflowDirection:"${scrollDir}" for scrollable content, ` +
        `or use layoutSizingVertical/Horizontal:"HUG" so the frame grows to fit.`,
    });
  }
}

/**
 * Apply layout sizing to a node that is already parented.
 * Single source of truth for FILL validation across all node types.
 *
 * FILL requires an auto-layout parent. If the parent is not auto-layout,
 * emits a warning instead of silently ignoring. Non-FILL values (HUG, FIXED)
 * are applied directly.
 */
/**
 * Apply layout sizing to a node. Single source of truth for FILL validation.
 *
 * @param autoDefault - When true (fresh frames/shapes), auto-default cross-axis to FILL.
 *                      When false (instances/updates), only warn about sizing issues.
 */
export function applySizing(
  node: SceneNode,
  parent: BaseNode | null,
  p: { layoutSizingHorizontal?: string; layoutSizingVertical?: string; width?: number; height?: number },
  hints: Hint[],
  autoDefault = true,
): void {
  const parentIsAL = parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  const nodeHasLayoutMode = "layoutMode" in node;
  let nodeIsAL = nodeHasLayoutMode && (node as any).layoutMode !== "NONE";

  // Rather than letting the Figma API throw on invalid sizing, we infer intent
  // from context (parent layout, dimensions, node type) and apply smart defaults.
  // Every inferred decision is reported back via confirm/warn hints so the agent
  // can learn from it.

  // ── Resolve each axis: explicit > dimension > parent-aware inference ──
  const parentDir = parentIsAL ? (parent as any).layoutMode as string : null;
  const parentSizingH = parentIsAL ? (parent as any).layoutSizingHorizontal as string : null;
  const parentSizingV = parentIsAL ? (parent as any).layoutSizingVertical as string : null;

  function inferAxis(
    field: "layoutSizingHorizontal" | "layoutSizingVertical",
    explicit: string | undefined,
    dimension: number | undefined,
  ): { value: string | undefined; inferred: boolean; reason?: string } {
    // 1. Agent explicitly set sizing → use as-is
    if (explicit) {
      // Warn when sizing conflicts with a provided dimension
      if (dimension !== undefined && (explicit === "HUG" || explicit === "FILL")) {
        const dim = field === "layoutSizingHorizontal" ? "width" : "height";
        const behavior = explicit === "HUG" ? "node will shrink to content" : "node will stretch to fill parent";
        hints.push({ type: "warn", message: `${dim}: ${dimension} ignored — ${field} is "${explicit}" (${behavior}). Set ${field}: "FIXED" to use the explicit ${dim}.` });
      }
      return { value: explicit, inferred: false };
    }

    // 2. Agent provided a dimension → FIXED on that axis
    if (dimension !== undefined) return { value: "FIXED", inferred: false };

    // 3. Infer from context (only for fresh creates, not updates)
    if (!autoDefault) return { value: undefined, inferred: false };

    // 3a. Child of auto-layout parent → read parent's direction + sizing
    if (parentIsAL) {
      const isH = field === "layoutSizingHorizontal";
      const isCrossAxis = parentDir === "HORIZONTAL" ? !isH : isH;

      if (isCrossAxis) {
        // Cross-axis: match parent's constraint on this axis.
        // Parent HUGs → child can't fill (would collapse), so HUG.
        // Parent has CENTER/MAX alignment → FILL would nullify that alignment, so HUG.
        // Parent FIXED/FILL with MIN alignment → child should stretch to fill.
        const parentCross = isH ? parentSizingH : parentSizingV;
        if (parentCross === "HUG") {
          return { value: "HUG", inferred: true, reason: "parent hugs on this axis" };
        }
        const crossAlign = (parent as any).counterAxisAlignItems as string | undefined;
        if (crossAlign === "CENTER" || crossAlign === "MAX" || crossAlign === "BASELINE") {
          return { value: "HUG", inferred: true,
            reason: `parent aligns children ${crossAlign} on cross-axis — FILL would override that` };
        }
        return { value: "FILL", inferred: true, reason: "stretch to fill parent" };
      }
      // Primary axis: content-sized along the flow direction
      return { value: "HUG", inferred: true, reason: "shrink to content along flow" };
    }

    // 3b. Node is auto-layout but not inside AL parent (top-level) → HUG both axes
    if (nodeIsAL) return { value: "HUG", inferred: true, reason: "shrink to content" };

    // 3c. Frame-like node, no AL context — default HUG (shrink to content, like HTML)
    // The HUG validation will enable auto-layout on the node automatically.
    if (nodeHasLayoutMode) return { value: "HUG", inferred: true, reason: "shrink to content" };

    return { value: undefined, inferred: false };
  }

  const hAxis = inferAxis("layoutSizingHorizontal", p.layoutSizingHorizontal, p.width);
  const vAxis = inferAxis("layoutSizingVertical", p.layoutSizingVertical, p.height);
  const axes: Array<{ field: "layoutSizingHorizontal" | "layoutSizingVertical"; value: string | undefined; inferred: boolean; reason?: string }> = [
    { field: "layoutSizingHorizontal", ...hAxis },
    { field: "layoutSizingVertical", ...vAxis },
  ];

  // ── Apply each axis with validation ────────────────────────────
  for (const axis of axes) {
    let { value } = axis;
    const { field, inferred, reason } = axis;
    if (!value) continue;
    if (!(field in node)) {
      hints.push({ type: "warn", message: `${field} not supported on ${node.type} — ignored. Sizing only applies to frames, components, instances, and text.` });
      continue;
    }

    // FILL needs an AL parent — downgrade to HUG to avoid clipping at arbitrary size
    if (value === "FILL" && !parentIsAL) {
      const parentDesc = parent ? `parent "${(parent as any).name || parent.id}"` : "parent";
      hints.push({ type: "warn", message: `${field}:'FILL' requires an auto-layout parent — using HUG instead. Set ${parentDesc}'s layoutMode to enable auto-layout for FILL.` });
      value = "HUG";
    }

    // FILL/HUG on ABSOLUTE child is a no-op — Figma ignores sizing for absolute children
    if ((value === "FILL" || value === "HUG") && "layoutPositioning" in node && (node as any).layoutPositioning === "ABSOLUTE") {
      hints.push({ type: "warn", message: `${field}:'${value}' has no effect on absolutely positioned nodes — use explicit width/height instead.` });
    }

    // HUG needs auto-layout on the node (frames) or an AL parent (text)
    if (value === "HUG") {
      const isTextInAL = node.type === "TEXT" && parentIsAL;
      if (!nodeIsAL && !isTextInAL) {
        if (nodeHasLayoutMode) {
          // Frame-like node — enable AL so HUG works
          (node as any).layoutMode = "VERTICAL";
          nodeIsAL = true;
          hints.push({ type: "suggest", message: `${field}:'HUG' requires auto-layout — enabled layoutMode:'VERTICAL'.` });
        } else {
          // Text/shapes outside AL — contradictory, can't resolve
          throw new Error(`${field}:'HUG' is not supported on ${node.type} outside auto-layout. Place this node inside an auto-layout parent (set parentId to an auto-layout frame).`);
        }
      }
    }

    (node as any)[field] = value;

    // Warn when FILL contradicts parent's cross-axis alignment (CENTER/MAX/BASELINE)
    if (value === "FILL" && !inferred && parentIsAL) {
      const isH = field === "layoutSizingHorizontal";
      const isCrossAxis = parentDir === "HORIZONTAL" ? !isH : isH;
      if (isCrossAxis) {
        const crossAlign = (parent as any).counterAxisAlignItems as string | undefined;
        if (crossAlign === "CENTER" || crossAlign === "MAX" || crossAlign === "BASELINE") {
          hints.push({ type: "warn", message: `${field}:'FILL' overrides parent's counterAxisAlignItems:'${crossAlign}' — this node will stretch to full width instead of being aligned. Use 'HUG' to respect ${crossAlign} alignment.` });
        }
      }
    }

    // Report inferred decisions so the agent knows what we chose
    if (inferred) {
      const dim = field === "layoutSizingHorizontal" ? "width" : "height";
      hints.push({ type: "suggest", message: `No ${dim} specified — defaulted to ${field}:'${value}' (${reason}).` });
    }
  }


  // ── Post-apply: warn about FIXED/FIXED inside auto-layout ─────
  // Skip small leaf nodes (icons, dots) — FIXED is intentional
  if (parentIsAL) {
    if ((node as any).layoutSizingHorizontal === "FIXED" && (node as any).layoutSizingVertical === "FIXED") {
      const w = (node as any).width ?? 0;
      const h = (node as any).height ?? 0;
      if (w >= 100 && h >= 100) {
        hints.push({ type: "warn", message: "Child has FIXED sizing on both axes inside auto-layout parent. Consider 'FILL' or 'HUG' for responsive layout." });
      }
    }
  }

  // ── Suggest for updates (autoDefault=false): don't override, just advise ──
  // Skip suggestion when parent centers/aligns children — FILL would override alignment.
  if (!autoDefault && parentIsAL) {
    const isHorizontal = parentDir === "HORIZONTAL";
    const crossField = isHorizontal ? "layoutSizingVertical" : "layoutSizingHorizontal";
    const crossExplicit = isHorizontal ? p.layoutSizingVertical : p.layoutSizingHorizontal;
    const crossAlign = (parent as any).counterAxisAlignItems as string | undefined;
    const parentAligns = crossAlign === "CENTER" || crossAlign === "MAX" || crossAlign === "BASELINE";
    if (!crossExplicit && !parentAligns && crossField in node) {
      const current = (node as any)[crossField];
      if (current === "HUG" || current === "FIXED") {
        hints.push({ type: "suggest", message: `${crossField} is '${current}' inside auto-layout parent. Consider '${crossField}:"FILL"' to fill available space.` });
      }
    }
  }
}

/**
 * Warn if a node has HUG on the cross-axis of a constrained auto-layout parent.
 * Skips when parent centers/aligns children — HUG is correct to respect alignment.
 * Call AFTER sizing is applied, passing the node's parent.
 */
export function warnCrossAxisHug(node: SceneNode, parent: BaseNode | null, hints: Hint[], label = ""): void {
  if (!parent || !("layoutMode" in parent) || (parent as any).layoutMode === "NONE") return;
  const parentAL = parent as any;
  const isHorizontal = parentAL.layoutMode === "HORIZONTAL";
  const crossAlign = parentAL.counterAxisAlignItems as string | undefined;
  if (crossAlign === "CENTER" || crossAlign === "MAX" || crossAlign === "BASELINE") return;
  const parentCross = isHorizontal ? parentAL.layoutSizingVertical : parentAL.layoutSizingHorizontal;
  const childCross = isHorizontal ? (node as any).layoutSizingVertical : (node as any).layoutSizingHorizontal;
  if ((parentCross === "FIXED" || parentCross === "FILL") && childCross === "HUG") {
    const crossProp = isHorizontal ? "layoutSizingVertical" : "layoutSizingHorizontal";
    const prefix = label ? `${label} has ` : "";
    hints.push({ type: "warn", message: `${prefix}HUG on cross-axis of constrained parent — won't fill available space. Use ${crossProp}:"FILL".` });
  }
}

/**
 * Append a node to its parent, then apply layout sizing with FILL deferral.
 * Convenience wrapper: appendToParent + applySizing.
 *
 * FILL is deferred until after append because Figma requires an auto-layout parent.
 * Non-FILL values are applied before append (they work without a parent).
 */
export async function appendAndApplySizing(
  node: SceneNode,
  p: { parentId?: string; layoutSizingHorizontal?: string; layoutSizingVertical?: string },
  hints: Hint[],
  autoDefault = true,
): Promise<BaseNode> {
  // Pre-parent: only apply FIXED immediately (safe without a parent).
  // HUG and FILL have prerequisites (auto-layout on node / parent) validated by applySizing.
  for (const field of ["layoutSizingHorizontal", "layoutSizingVertical"] as const) {
    const value = p[field];
    if (value === "FIXED" && field in node) (node as any)[field] = value;
  }

  const parent = await appendToParent(node, p.parentId);

  // Post-parent: applySizing handles HUG promotion, FILL validation, cross-axis defaults
  applySizing(node, parent, p, hints, autoDefault);

  // Post-append: warn if this child pushes the parent past its available space
  checkParentOverflow(parent, hints);

  return parent;
}

/** Check for sibling nodes at the same position in a non-auto-layout parent. */
export function checkOverlappingSiblings(node: SceneNode, parent: BaseNode | null, hints: Hint[]): void {
  if (!parent || !("children" in parent)) return;
  const parentIsAL = "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  if (parentIsAL) return;
  const siblings = (parent as any).children as SceneNode[];
  const nx = Math.round(node.x), ny = Math.round(node.y);
  const overlapping = siblings.filter(s =>
    s.id !== node.id && "x" in s && "y" in s &&
    Math.round((s as any).x) === nx && Math.round((s as any).y) === ny
  );
  if (overlapping.length > 0) {
    hints.push({ type: "warn", message: `Overlapping sibling(s) at (${nx},${ny}): [${overlapping.map(s => s.name).join(", ")}]. Set distinct x/y or convert parent to auto-layout.` });
  }
}

/** Small intrinsic container (buttons, badges) — mute HUG×HUG warnings. */
export function isSmallIntrinsic(node: any): boolean {
  const bb = node.absoluteBoundingBox ?? node;
  const children = "children" in node ? (node as any).children : [];
  return (bb.width < 100 || bb.height < 100) || children.length < 3;
}

/**
 * Coerce a color value: hex string → {r,g,b,a} object (0-1).
 * Passes through objects unchanged. Returns null if not a valid hex string.
 */
export function coerceColor(v: any): { r: number; g: number; b: number; a: number } | null {
  if (typeof v === "object" && v !== null && "r" in v) {
    return { r: v.r ?? 0, g: v.g ?? 0, b: v.b ?? 0, a: v.a ?? 1 };
  }
  if (typeof v !== "string") return null;
  const m = v.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/**
 * Build a solid paint from an RGBA color object (channels 0-1).
 */
export function solidPaint(c: any) {
  return { type: "SOLID" as const, color: { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0 }, opacity: c.a ?? 1 };
}

/**
 * Resolve a variable by ID with scan fallback.
 * Direct lookup can fail for recently-created variables.
 */
export async function findVariableById(id: string): Promise<any> {
  const direct = await figma.variables.getVariableByIdAsync(id);
  if (direct) return direct;
  const all = await figma.variables.getLocalVariablesAsync();
  return all.find(v => v.id === id) || null;
}

/**
 * Resolve any variable by name, optionally scoped to a collection name.
 * Throws if the name matches multiple variables across collections and no collectionName is given.
 */
/**
 * Shared variable lookup logic. Searches by exact name, case-insensitive fallback,
 * then "CollectionName/VarName" slash-path fallback. Returns null if not found.
 */
async function resolveVariable(
  name: string,
  typeFilter?: VariableResolvedDataType,
  collectionName?: string,
  scopeContext?: string,
): Promise<Variable | null> {
  const all = typeFilter
    ? await figma.variables.getLocalVariablesAsync(typeFilter)
    : await figma.variables.getLocalVariablesAsync();
  let matches = all.filter(v => v.name === name);
  if (matches.length === 0) {
    const lower = name.toLowerCase();
    matches = all.filter(v => v.name.toLowerCase() === lower);
  }
  // Fallback: try parsing "CollectionName/VarName" when no exact match
  if (matches.length === 0 && !collectionName && name.includes("/")) {
    const slashIdx = name.indexOf("/");
    return resolveVariable(name.substring(slashIdx + 1), typeFilter, name.substring(0, slashIdx), scopeContext);
  }
  if (matches.length === 0) return null;
  if (collectionName) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const col = collections.find(c => c.name === collectionName) ||
                collections.find(c => c.name.toLowerCase() === collectionName.toLowerCase());
    if (!col) return null;
    return matches.find(v => v.variableCollectionId === col.id) || null;
  }
  if (matches.length > 1 && scopeContext) {
    // Disambiguate by scope: prefer variable whose scope matches the binding context
    const scoped = matches.filter(v => {
      const scopes: string[] = (v as any).scopes || [];
      return scopes.includes(scopeContext);
    });
    if (scoped.length === 1) return scoped[0];
    // Also try ALL_SCOPES as fallback
    const allScope = matches.filter(v => {
      const scopes: string[] = (v as any).scopes || [];
      return scopes.length === 0 || scopes.includes("ALL_SCOPES");
    });
    if (allScope.length === 1) return allScope[0];
  }
  if (matches.length > 1) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const colNames = matches.map(v => collections.find(c => c.id === v.variableCollectionId)?.name || "?");
    throw new Error(`Variable '${name}' exists in multiple collections: [${colNames.join(", ")}]. Use "CollectionName/${name}" to disambiguate.`);
  }
  return matches[0];
}

export async function findVariableByName(name: string, collectionName?: string, scopeContext?: string): Promise<Variable | null> {
  return resolveVariable(name, undefined, collectionName, scopeContext);
}

export async function findColorVariableByName(name: string, collectionName?: string): Promise<Variable | null> {
  return resolveVariable(name, "COLOR", collectionName);
}

/**
 * Format a "style not found" hint that includes available style names
 * so the agent can self-correct (e.g. "Heading" → "Heading/H2").
 */
export function styleNotFoundHint(param: string, value: string, available: string[], limit = 20): Hint {
  if (available.length === 0) return { type: "error", message: `${param} '${value}' not found (no local styles of this type exist).` };
  const names = available.slice(0, limit);
  const suffix = available.length > limit ? `, … and ${available.length - limit} more` : "";
  return { type: "error", message: `${param} '${value}' not found. Available: [${names.join(", ")}${suffix}]` };
}

/**
 * Resolve textStyleName → BaseStyle for a batch of items.
 * Local-first: exact local match → library import via _textStyleKey → fuzzy local.
 */
export async function resolveTextStylesForBatch(
  items: any[],
): Promise<{ byName: Map<string, any>; fontsToLoad: FontName[]; localStyles: any[] }> {
  const byName = new Map<string, any>();
  const fontsToLoad: FontName[] = [];

  const needsResolve = items.some((p: any) => p.textStyleName && !p.textStyleId);
  if (!needsResolve) return { byName, fontsToLoad, localStyles: [] };

  const localStyles = await figma.getLocalTextStylesAsync();

  // First pass: exact-match local styles. Local always wins.
  for (const p of items) {
    if (!p.textStyleName || p.textStyleId) continue;
    const name: string = p.textStyleName;
    if (byName.has(name)) continue;
    const exact = localStyles.find((s: any) => s.name === name);
    if (exact) {
      byName.set(name, exact);
      if (exact.fontName) fontsToLoad.push(exact.fontName);
      continue;
    }
  }

  // Second pass: library fallback via _textStyleKey (deduped, sequential, 2s timeout per call).
  const MAX_LIBRARY_IMPORTS = 3;
  const pendingImports: { name: string; key: string }[] = [];
  for (const p of items) {
    if (!p.textStyleName || p.textStyleId) continue;
    const name: string = p.textStyleName;
    if (byName.has(name)) continue;
    if (!p._textStyleKey) continue;
    if (pendingImports.some(i => i.name === name)) continue;
    pendingImports.push({ name, key: p._textStyleKey });
  }
  for (const { name, key } of pendingImports.slice(0, MAX_LIBRARY_IMPORTS)) {
    try {
      const style: any = await Promise.race([
        figma.importStyleByKeyAsync(key),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
      ]);
      if (style && style.type === "TEXT") {
        byName.set(name, style);
        if (style.fontName) fontsToLoad.push(style.fontName);
      }
    } catch {
      // falls through to styleNotFoundHint
    }
  }

  // Third pass: fuzzy local match as last resort (only for names with still no match).
  for (const p of items) {
    if (!p.textStyleName || p.textStyleId) continue;
    const name: string = p.textStyleName;
    if (byName.has(name)) continue;
    const fuzzy = localStyles.find((s: any) => s.name.toLowerCase().includes(name.toLowerCase()));
    if (fuzzy) {
      byName.set(name, fuzzy);
      if (fuzzy.fontName) fontsToLoad.push(fuzzy.fontName);
    }
  }

  return { byName, fontsToLoad, localStyles };
}

/** Result from color matching: includes the hint AND auto-bind data when a match is found. */
export interface ColorMatchResult {
  hint: Hint;
  /** Matched variable — callers should auto-bind this to the node's paint */
  variable?: any;
  /** Matched paint style ID — callers should auto-apply via setFillStyleIdAsync */
  paintStyleId?: string;
}

/**
 * Check if a hardcoded color matches any local paint style or color variable.
 * Returns a hint AND the matched variable/style so callers can auto-bind.
 */
export async function suggestStyleForColor(
  color: { r: number, g: number, b: number, a?: number },
  styleParam: string,
  bindingContext?: "ALL_FILLS" | "FRAME_FILL" | "SHAPE_FILL" | "TEXT_FILL" | "STROKE_COLOR",
): Promise<ColorMatchResult> {
  const hex = `#${[color.r, color.g, color.b].map(v => Math.round((v ?? 0) * 255).toString(16).padStart(2, "0")).join("")}`;
  const eps = 0.02;
  const cr = color.r ?? 0, cg = color.g ?? 0, cb = color.b ?? 0, ca = color.a ?? 1;

  const colorMatches = (vc: { r: number; g: number; b: number; a?: number }) =>
    Math.abs(vc.r - cr) < eps && Math.abs(vc.g - cg) < eps &&
    Math.abs(vc.b - cb) < eps && Math.abs((vc.a ?? 1) - ca) < eps;

  // Check color variables first (preferred — supports multi-mode theming)
  const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
  if (colorVars.length > 0) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const defaultModes = new Map(collections.map(c => [c.id, c.defaultModeId]));

    // Auto-bind requires explicit scope match — ALL_SCOPES is not enough
    let best: any = null;

    for (const v of colorVars) {
      const modeId = defaultModes.get(v.variableCollectionId);
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (!val || typeof val !== "object" || "type" in val) continue;
      if (!colorMatches(val as any)) continue;

      const scopes: string[] = (v as any).scopes || [];
      if (bindingContext && scopes.includes(bindingContext)) {
        best = v;
        break;
      }
    }
    if (best) {
      return {
        hint: { type: "confirm", message: `Auto-bound color ${hex} → variable '${best.name}'.` },
        variable: best,
      };
    }
  }

  // Check paint styles
  const styles = await figma.getLocalPaintStylesAsync();
  for (const style of styles) {
    const paints = style.paints;
    if (paints.length === 1 && paints[0].type === "SOLID") {
      const sc = (paints[0] as SolidPaint).color;
      const so = (paints[0] as SolidPaint).opacity ?? 1;
      if (Math.abs(sc.r - cr) < eps && Math.abs(sc.g - cg) < eps &&
          Math.abs(sc.b - cb) < eps && Math.abs(so - ca) < eps) {
        return {
          hint: { type: "confirm", message: `Auto-bound color ${hex} → style '${style.name}'.` },
          paintStyleId: style.id,
        };
      }
    }
  }

  const scopeHint = bindingContext ? ` with scopes: [${bindingContext}]` : "";
  return { hint: { type: "suggest", message: `Hardcoded color ${hex} has no matching color variable${scopeHint} or paint style. Create one with variables(method: "create"${scopeHint}) or styles(method: "create", type: "paint"), then use ${styleParam} for design token consistency.` } };
}

/**
 * Apply fill to a node with full token resolution and auto-binding.
 * Priority: fillVariableId > fillVariableName > fillStyleName > fillColor (with auto-bind).
 * Returns hints array with auto-bind confirmations or errors.
 */
// ─── Wrong-shape param corrections ─────────────────────────────
// Map of commonly-misused param names → corrective message with correct schema + example.

const WRONG_SHAPE_CORRECTIONS: Record<string, string> = {
  // fills: handled by batchHandler normalization — not rejected
  // strokes: handled by batchHandler normalization — not rejected

  color: `"color" is ambiguous on text nodes. Use fills: [{type:"SOLID", color:"#hex"}] for text color, or fontColor: "#hex" as shorthand.`,
  border: `"border" is not a valid param. Use strokeColor: "#hex", strokeWeight: 1`,
  borderColor: `"borderColor" is not a valid param. Use strokeColor: "#hex" or strokeVariableName: "border/default"`,
  borderWidth: `"borderWidth" is not a valid param. Use strokeWeight: 1 (number or variable name string)`,
  borderRadius: `"borderRadius" is not a valid param. Use cornerRadius: 8 (number or variable name string). Per-corner: topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius`,
  radius: `"radius" is not a valid param. Use cornerRadius: 8 (number or variable name string)`,
  font: `"font" is not a valid param. Use fontFamily: "Inter" and fontStyle: "Bold" (or fontWeight: 700)`,
  text: `"text" is not a valid param on frames. For text nodes, use text(method: "create", items: [{text: "Hello", parentId: "<frameId>"}])`,
  content: `"content" is not a valid param. For text nodes, use text(method: "create", items: [{text: "Hello"}])`,
  label: `"label" is not a valid param. For text nodes, use text(method: "create", items: [{text: "Hello", parentId: "<frameId>"}])`,
  gap: `"gap" is not a valid param. Use itemSpacing: 8 (number or variable name string) for spacing between children`,
  spacing: `"spacing" is not a valid param. Use itemSpacing: 8 for spacing between children, or padding: 16 for inner padding`,
  alignItems: `"alignItems" is not a valid param. Use counterAxisAlignItems: "CENTER" (MIN | MAX | CENTER | BASELINE)`,
  justifyContent: `"justifyContent" is not a valid param. Use primaryAxisAlignItems: "CENTER" (MIN | MAX | CENTER | SPACE_BETWEEN)`,
  direction: `"direction" is not a valid param. Use layoutMode: "HORIZONTAL" or "VERTICAL"`,
  display: `"display" is not a valid param. Use layoutMode: "HORIZONTAL" or "VERTICAL" for auto-layout, or "NONE" for static frames`,
  fontWeight: `"fontWeight" is not supported here. Use fontStyle with the variant name, for example fontStyle: "Bold" or "SemiBold" (use fonts.list to find available variants for your font family).`,
};

/**
 * Reject unknown/wrong params on create handlers. For known wrong shapes, gives the
 * correct schema definition and example payload. For truly unknown keys, lists them
 * and points to the help command.
 */
export function rejectUnknownParams(p: any, knownKeys: ReadonlySet<string>, helpCmd: string): void {
  const unknown: string[] = [];
  const corrections: string[] = [];

  for (const key of Object.keys(p)) {
    if (knownKeys.has(key) || key.startsWith("_")) continue; // skip internal keys
    const correction = WRONG_SHAPE_CORRECTIONS[key];
    if (correction) {
      corrections.push(correction);
    } else {
      unknown.push(key);
    }
  }

  if (corrections.length > 0) {
    throw new Error(corrections.join("\n\n"));
  }
  if (unknown.length > 0) {
    throw new Error(
      `Unknown params: ${unknown.join(", ")}. ` +
      `Use ${helpCmd} to see valid params and examples.`
    );
  }
}

/**
 * Apply an IMAGE fill from base64 data, or insert SVG markup as child vector nodes.
 * Injected by MCP-side imageUrl pre-processor (_imageData for raster, _svgMarkup for SVG).
 * Returns true if fill/SVG was applied, false if no image data present.
 */
export async function applyImageFill(
  node: any,
  p: { _imageData?: string; _imageMimeType?: string; imageScaleMode?: string; _attribution?: string; _svgMarkup?: string },
  hints: Hint[],
): Promise<boolean> {
  // SVG → insert as vector children inside the node, scaled to fit
  if (p._svgMarkup) {
    try {
      const svgNode = figma.createNodeFromSvg(p._svgMarkup);

      if ("children" in node) {
        const targetW = node.width;
        const targetH = node.height;
        const svgW = svgNode.width;
        const svgH = svgNode.height;

        // Scale the whole SVG group to fit, then transfer children
        if (targetW && targetH && (svgW !== targetW || svgH !== targetH)) {
          const scale = Math.min(targetW / svgW, targetH / svgH);
          svgNode.rescale(scale);
        }

        for (const child of [...svgNode.children]) node.appendChild(child);
        svgNode.remove();
      } else {
        svgNode.x = node.x;
        svgNode.y = node.y;
        svgNode.name = node.name;
        if (node.parent) node.parent.appendChild(svgNode);
        node.remove();
      }
      return true;
    } catch (e: any) {
      hints.push({ type: "error", message: `Failed to insert SVG: ${e.message}` });
      return false;
    }
  }

  if (!p._imageData) return false;

  try {
    const { customBase64Decode } = await import("../utils/base64");
    const bytes = customBase64Decode(p._imageData);
    const image = figma.createImage(bytes);
    const scaleMode = (p.imageScaleMode ?? "FILL") as "FILL" | "FIT" | "CROP" | "TILE";

    node.fills = [{
      type: "IMAGE" as const,
      scaleMode,
      imageHash: image.hash,
    }];

    if (p._attribution) {
      node.name = `${node.name} — ${p._attribution}`;
      hints.push({ type: "suggest", message: p._attribution });
    }

    return true;
  } catch (e: any) {
    hints.push({ type: "error", message: `Failed to apply image fill: ${e.message}` });
    return false;
  }
}

export async function applyFillWithAutoBind(
  node: any,
  p: { fills?: any },
  hints: Hint[],
): Promise<boolean> {
  if (p.fills === undefined) return false;

  // Tagged binding: { _variableId: "id" } (from fillVariableId)
  if (p.fills?._variableId) {
    const v = await findVariableById(p.fills._variableId);
    if (v) {
      // Clear any existing paint style — it overrides variable bindings in Figma
      if ("fillStyleId" in node && node.fillStyleId) try { await node.setFillStyleIdAsync(""); } catch {}
      node.fills = [solidPaint({ r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", v);
      node.fills = [bound];
      return true;
    }
    hints.push({ type: "error", message: `fillVariableId '${p.fills._variableId}' not found.` });
    return false;
  }

  // Tagged binding: { _variable: "name" } (from fillVariableName normalization)
  if (p.fills?._variable) {
    const name = p.fills._variable;
    const v = await findColorVariableByName(name);
    if (v) {
      // Clear any existing paint style — it overrides variable bindings in Figma
      if ("fillStyleId" in node && node.fillStyleId) try { await node.setFillStyleIdAsync(""); } catch {}
      node.fills = [solidPaint({ r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", v);
      node.fills = [bound];
      hints.push({ type: "confirm", message: `Bound fill → variable '${v.name}'.` });
      return true;
    }
    const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
    const names = colorVars.map(v => v.name).slice(0, 20);
    hints.push({ type: "error", message: `fillVariableName '${name}' not found. Available: [${names.join(", ")}]` });
    return false;
  }

  // Tagged binding: { _style: "name", _styleKey?: "<libKey>" } (from fillStyleName normalization)
  if (p.fills?._style) {
    const name = p.fills._style;
    const styleKey: string | undefined = p.fills._styleKey;
    const styles = await figma.getLocalPaintStylesAsync();
    const exact = styles.find(s => s.name === name);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
    if (match) {
      try { await node.setFillStyleIdAsync(match.id); return true; }
      catch (e: any) { hints.push({ type: "error", message: `fillStyleName '${name}' matched but failed to apply: ${e.message}` }); return false; }
    }
    // Fallback: MCP pre-processor attached a library style key. Import on demand.
    // importStyleByKeyAsync is idempotent — re-calling is cheap and stateless.
    if (styleKey) {
      try {
        const style = await figma.importStyleByKeyAsync(styleKey);
        await node.setFillStyleIdAsync(style.id);
        return true;
      } catch (e: any) {
        hints.push({ type: "error", message: `fillStyleName '${name}' (library import) failed: ${e.message}. Ensure the source library is enabled for this file.` });
        return false;
      }
    }
    hints.push(styleNotFoundHint("fillStyleName", name, styles.map(s => s.name)));
    return false;
  }

  // Empty array → transparent
  if (Array.isArray(p.fills) && p.fills.length === 0) {
    node.fills = [];
    return true;
  }

  // Array of paints → coerce hex colors, auto-bind single solid
  if (Array.isArray(p.fills)) {
    // Warn about REST API gradient format (gradientHandlePositions) — plugin API uses gradientTransform
    for (const f of p.fills) {
      if (f.gradientHandlePositions) {
        hints.push({ type: "warn", message: `"gradientHandlePositions" is the REST API format. The plugin API uses gradientTransform: [[1,0,0],[0,1,0]] (2×3 matrix). The handle positions were ignored.` });
        break;
      }
    }
    node.fills = p.fills.map((f: any) => {
      if (f.type === "SOLID" && f.color) {
        const c = coerceColor(f.color);
        if (c) return { type: "SOLID" as const, color: { r: c.r, g: c.g, b: c.b }, opacity: f.opacity ?? c.a ?? 1 };
      }
      const { gradientHandlePositions: _, ...clean } = f;
      return clean;
    });
    // Auto-bind for single solid color
    if (p.fills.length === 1 && node.fills[0]?.type === "SOLID") {
      const sc = node.fills[0].color;
      const match = await suggestStyleForColor({ ...sc, a: node.fills[0].opacity ?? 1 }, "fillStyleName", "ALL_FILLS");
      if (match.variable) {
        const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", match.variable);
        node.fills = [bound];
      } else if (match.paintStyleId) {
        try { await node.setFillStyleIdAsync(match.paintStyleId); } catch {}
      }
      hints.push(match.hint);
    }
    return true;
  }

  // Scalar: hex color string
  const c = coerceColor(p.fills);
  if (c) {
    node.fills = [solidPaint(c)];
    const match = await suggestStyleForColor(c, "fillStyleName", "ALL_FILLS");
    if (match.variable) {
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", match.variable);
      node.fills = [bound];
    } else if (match.paintStyleId) {
      try { await node.setFillStyleIdAsync(match.paintStyleId); } catch {}
    }
    hints.push(match.hint);
    return true;
  }

  // Scalar string: try as style name, then variable name
  const styles = await figma.getLocalPaintStylesAsync();
  const exact = styles.find(s => s.name === p.fills);
  const styleMatch = exact || styles.find(s => s.name.toLowerCase() === String(p.fills).toLowerCase());
  if (styleMatch) {
    try { await node.setFillStyleIdAsync(styleMatch.id); hints.push({ type: "confirm", message: `fills '${p.fills}' resolved as paint style '${styleMatch.name}'. Use fillStyleName for clarity.` }); return true; }
    catch (e: any) { hints.push({ type: "error", message: `fills '${p.fills}' matched style but failed: ${e.message}` }); return false; }
  }
  const v = await findColorVariableByName(String(p.fills));
  if (v) {
    node.fills = [solidPaint({ r: 0, g: 0, b: 0 })];
    const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", v);
    node.fills = [bound];
    hints.push({ type: "confirm", message: `fills '${p.fills}' resolved as color variable '${v.name}'. Use fillVariableName for clarity.` });
    return true;
  }
  hints.push({ type: "error", message: `fills '${p.fills}' is not a valid color (hex or {r,g,b}), paint style, or color variable.` });
  return false;
}

/**
 * Apply stroke to a node with full token resolution and auto-binding.
 * Accepts canonical `strokes` (array, tagged binding, hex string) — same pattern as applyFillWithAutoBind.
 * Also handles strokeWeight token fields.
 */
export async function applyStrokeWithAutoBind(
  node: any,
  p: { strokes?: any; strokeWeight?: number | string;
       strokeTopWeight?: number | string; strokeBottomWeight?: number | string;
       strokeLeftWeight?: number | string; strokeRightWeight?: number | string },
  hints: Hint[],
): Promise<void> {
  if (p.strokes !== undefined) {
    // Tagged binding: { _variableId: "id" }
    if (p.strokes?._variableId) {
      const v = await findVariableById(p.strokes._variableId);
      if (v) {
        // Clear any existing paint style — it overrides variable bindings in Figma
        if ("strokeStyleId" in node && node.strokeStyleId) try { await node.setStrokeStyleIdAsync(""); } catch {}
        node.strokes = [solidPaint({ r: 0, g: 0, b: 0 })];
        const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", v);
        node.strokes = [bound];
      } else {
        hints.push({ type: "error", message: `strokeVariableId '${p.strokes._variableId}' not found.` });
      }
    }
    // Tagged binding: { _variable: "name" }
    else if (p.strokes?._variable) {
      const name = p.strokes._variable;
      const v = await findColorVariableByName(name);
      if (v) {
        // Clear any existing paint style — it overrides variable bindings in Figma
        if ("strokeStyleId" in node && node.strokeStyleId) try { await node.setStrokeStyleIdAsync(""); } catch {}
        node.strokes = [solidPaint({ r: 0, g: 0, b: 0 })];
        const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", v);
        node.strokes = [bound];
        hints.push({ type: "confirm", message: `Bound stroke → variable '${v.name}'.` });
      } else {
        const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
        const names = colorVars.map(v => v.name).slice(0, 20);
        hints.push({ type: "error", message: `strokeVariableName '${name}' not found. Available: [${names.join(", ")}]` });
      }
    }
    // Tagged binding: { _style: "name", _styleKey?: "<libKey>" }
    else if (p.strokes?._style) {
      const name = p.strokes._style;
      const styleKey: string | undefined = p.strokes._styleKey;
      const styles = await figma.getLocalPaintStylesAsync();
      const exact = styles.find(s => s.name === name);
      const match = exact || styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
      if (match) {
        try { await node.setStrokeStyleIdAsync(match.id); }
        catch (e: any) { hints.push({ type: "error", message: `strokeStyleName '${name}' matched but failed to apply: ${e.message}` }); }
      } else if (styleKey) {
        try {
          const style = await figma.importStyleByKeyAsync(styleKey);
          await node.setStrokeStyleIdAsync(style.id);
        } catch (e: any) {
          hints.push({ type: "error", message: `strokeStyleName '${name}' (library import) failed: ${e.message}` });
        }
      } else {
        hints.push(styleNotFoundHint("strokeStyleName", name, styles.map(s => s.name)));
      }
    }
    // Empty array → clear strokes
    else if (Array.isArray(p.strokes) && p.strokes.length === 0) {
      node.strokes = [];
    }
    // Array of paints → coerce hex colors, auto-bind single solid
    else if (Array.isArray(p.strokes)) {
      // Warn about REST API gradient format (gradientHandlePositions) — plugin API uses gradientTransform
      for (const f of p.strokes) {
        if (f.gradientHandlePositions) {
          hints.push({ type: "warn", message: `"gradientHandlePositions" is the REST API format. The plugin API uses gradientTransform: [[1,0,0],[0,1,0]] (2×3 matrix). The handle positions were ignored.` });
          break;
        }
      }
      node.strokes = p.strokes.map((f: any) => {
        if (f.type === "SOLID" && f.color) {
          const c = coerceColor(f.color);
          if (c) return { type: "SOLID" as const, color: { r: c.r, g: c.g, b: c.b }, opacity: f.opacity ?? c.a ?? 1 };
        }
        const { gradientHandlePositions: _, ...clean } = f;
        return clean;
      });
      // Auto-bind for single solid color
      if (p.strokes.length === 1 && node.strokes[0]?.type === "SOLID") {
        const sc = node.strokes[0].color;
        const match = await suggestStyleForColor({ ...sc, a: node.strokes[0].opacity ?? 1 }, "strokeStyleName", "STROKE_COLOR");
        if (match.variable) {
          const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", match.variable);
          node.strokes = [bound];
        } else if (match.paintStyleId) {
          try { await node.setStrokeStyleIdAsync(match.paintStyleId); } catch {}
        }
        hints.push(match.hint);
      }
    }
    // Scalar: hex color string
    else {
      const c = coerceColor(p.strokes);
      if (c) {
        node.strokes = [solidPaint(c)];
        const match = await suggestStyleForColor(c, "strokeStyleName", "STROKE_COLOR");
        if (match.variable) {
          const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", match.variable);
          node.strokes = [bound];
        } else if (match.paintStyleId) {
          try { await node.setStrokeStyleIdAsync(match.paintStyleId); } catch {}
        }
        hints.push(match.hint);
      } else {
        // Scalar string: try as style name, then variable name
        const styles = await figma.getLocalPaintStylesAsync();
        const exact = styles.find(s => s.name === p.strokes);
        const styleMatch = exact || styles.find(s => s.name.toLowerCase() === String(p.strokes).toLowerCase());
        if (styleMatch) {
          try { await node.setStrokeStyleIdAsync(styleMatch.id); hints.push({ type: "confirm", message: `strokes '${p.strokes}' resolved as paint style '${styleMatch.name}'. Use strokeStyleName for clarity.` }); }
          catch (e: any) { hints.push({ type: "error", message: `strokes '${p.strokes}' matched style but failed: ${e.message}` }); }
        } else {
          const v = await findColorVariableByName(String(p.strokes));
          if (v) {
            node.strokes = [solidPaint({ r: 0, g: 0, b: 0 })];
            const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", v);
            node.strokes = [bound];
            hints.push({ type: "confirm", message: `strokes '${p.strokes}' resolved as color variable '${v.name}'. Use strokeVariableName for clarity.` });
          } else {
            hints.push({ type: "error", message: `strokes '${p.strokes}' is not a valid color (hex or {r,g,b}), paint style, or color variable.` });
          }
        }
      }
    }
  }
  const swFields: Record<string, number | string | undefined> = {};
  for (const f of ["strokeWeight", "strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"] as const) {
    if ((p as any)[f] !== undefined && f in node) swFields[f] = (p as any)[f];
  }
  await applyTokens(node, swFields, hints);
}

/**
 * Parse a token value: numeric string → number, otherwise variable name.
 * Returns { num } for hardcoded values, { varName } for variable references.
 */
function parseToken(value: string | number): { num: number } | { varName: string } {
  if (typeof value === "number") return { num: value };
  const n = Number(value);
  if (!isNaN(n) && value.trim() !== "") return { num: n };
  return { varName: value };
}

/**
 * Apply a token field to a node property.
 * Numeric string → set value (hardcoded). Non-numeric string → bind variable.
 * Returns true if the value was a variable binding.
 */

/**
 * Apply corner radius to a node, supporting both shorthand and per-corner values.
 * Each field accepts number (hardcoded) or string (variable name/ID).
 * Expands shorthand → per-corner (like padding).
 */
export async function applyCornerRadius(node: any, p: any, hints: Hint[]): Promise<void> {
  // Expand shorthand → per-corner (individual values override shorthand)
  if (p.cornerRadius !== undefined) {
    p.topLeftRadius ??= p.cornerRadius;
    p.topRightRadius ??= p.cornerRadius;
    p.bottomRightRadius ??= p.cornerRadius;
    p.bottomLeftRadius ??= p.cornerRadius;
  }

  const fields = ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"] as const;
  const hasPer = fields.some(f => p[f] !== undefined);

  if (hasPer && "topLeftRadius" in node) {
    const cornerFields: Record<string, number | string | undefined> = {};
    for (const f of fields) {
      if (p[f] !== undefined) cornerFields[f] = p[f];
    }
    await applyTokens(node, cornerFields, hints);
  } else if (p.cornerRadius !== undefined && "cornerRadius" in node) {
    // Node supports cornerRadius but not per-corner — apply as single field
    const bound = await applyToken(node, "cornerRadius", p.cornerRadius, hints);
    if (!bound && p.cornerRadius !== 0) {
      hints.push({ type: "suggest", message: `Hardcoded cornerRadius. Use an existing FLOAT variable with scopes: [CORNER_RADIUS] or create one with variables(method:"create"), then pass the variable name string instead of a number.` });
    }
  }
}

// ─── FLOAT token scope mapping ──────────────────────────────────
// Maps node property names to Figma variable scopes for auto-bind matching.
const FIELD_TO_SCOPE: Record<string, string> = {
  cornerRadius: "CORNER_RADIUS",
  topLeftRadius: "CORNER_RADIUS",
  topRightRadius: "CORNER_RADIUS",
  bottomRightRadius: "CORNER_RADIUS",
  bottomLeftRadius: "CORNER_RADIUS",
  itemSpacing: "GAP",
  counterAxisSpacing: "GAP",
  paddingTop: "GAP",
  paddingRight: "GAP",
  paddingBottom: "GAP",
  paddingLeft: "GAP",
  strokeWeight: "STROKE_FLOAT",
  strokeTopWeight: "STROKE_FLOAT",
  strokeBottomWeight: "STROKE_FLOAT",
  strokeLeftWeight: "STROKE_FLOAT",
  strokeRightWeight: "STROKE_FLOAT",
  opacity: "OPACITY",
};

async function getFloatVarsWithModes(): Promise<{ vars: any[]; defaultModes: Map<string, string> }> {
  const vars = await figma.variables.getLocalVariablesAsync("FLOAT");
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const defaultModes = new Map(collections.map(c => [c.id, c.defaultModeId]));
  return { vars, defaultModes };
}

/**
 * Match a numeric value against existing FLOAT variables by value and scope.
 * Uses Figma variable scopes (CORNER_RADIUS, GAP, etc.) — no collection name assumptions.
 * Returns the matched variable or null.
 */
async function matchFloatVariable(
  numericValue: number, field: string,
): Promise<any | null> {
  if (numericValue === 0) return null; // 0 is too common to match
  const scope = FIELD_TO_SCOPE[field];
  if (!scope) return null; // No scope mapping — can't auto-bind
  const { vars, defaultModes } = await getFloatVarsWithModes();
  if (vars.length === 0) return null;

  for (const v of vars) {
    const modeId = defaultModes.get(v.variableCollectionId);
    if (!modeId) continue;
    const val = v.valuesByMode[modeId];
    // Skip aliases and non-numeric values
    if (typeof val !== "number") continue;
    if (val !== numericValue) continue;

    const scopes: string[] = (v as any).scopes || [];

    // Auto-bind requires explicit scope match — ALL_SCOPES is not enough
    if (scope && scopes.includes(scope)) {
      return v;
    }
  }

  return null;
}

/**
 * Apply a token value (number or variable name string) to a node property.
 * Numbers are auto-bound to matching FLOAT variables (by value + scope).
 * Strings are bound as variable names.
 * Returns true if a variable was bound, false if hardcoded numeric.
 */
export async function applyToken(
  node: any, field: string, value: number | string, hints: Hint[],
): Promise<boolean> {
  // Coerce numeric strings to plain numbers — variable names are never purely numeric
  if (typeof value === "string") {
    const n = Number(value);
    if (!isNaN(n) && value.trim() !== "") {
      value = n;
    }
  }
  if (typeof value === "number") {
    // Auto-bind: match numeric value against existing FLOAT variables by scope
    const matched = await matchFloatVariable(value, field);
    if (matched) {
      node.setBoundVariable(field, matched);
      hints.push({ type: "confirm", message: `Auto-bound ${field} ${value} → variable '${matched.name}'.` });
      return true;
    }
    node[field] = value;
    return false;
  }
  // Non-numeric string — bind as variable name, using scope to disambiguate
  const scope = FIELD_TO_SCOPE[field];
  await bindNumericVariable(node, field, value, hints, scope);
  return true;
}

/**
 * Apply multiple token fields at once, emitting a single grouped warning
 * for any hardcoded values. Skips undefined values.
 */
export async function applyTokens(
  node: any, fields: Record<string, number | string | undefined>, hints: Hint[],
): Promise<void> {
  const hardcoded: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) {
      const bound = await applyToken(node, field, value, hints);
      if (!bound && Number(value) !== 0) hardcoded.push(field);
    }
  }
  if (hardcoded.length > 0) {
    // Group related fields for compact messages, include required scopes
    const paddingFields = hardcoded.filter(f => f.startsWith("padding"));
    const others = hardcoded.filter(f => !f.startsWith("padding"));
    const groups: string[] = [];
    if (paddingFields.length > 0) groups.push(paddingFields.length >= 3 ? "padding" : paddingFields.join(", "));
    groups.push(...others);
    // Collect unique scopes needed for auto-bind
    const neededScopes = new Set(hardcoded.map(f => FIELD_TO_SCOPE[f]).filter(Boolean));
    const scopeList = [...neededScopes].join(", ");
    const scopeHint = neededScopes.size > 0 ? ` with scopes: [${scopeList}]` : "";
    hints.push({ type: "suggest", message: `Hardcoded ${groups.join(", ")}. Use an existing FLOAT variable${scopeHint} or create one with variables(method:"create", items:[{name:"<name>", resolvedType:"FLOAT", collectionId:"<collection>", value:<N>, scopes:[${scopeList}]}]), then pass the variable name string instead of a number.` });
  }
}

/**
 * Bind a FLOAT variable by name to one or more node properties.
 * For cornerRadius, binds all four corners. Returns true if bound successfully.
 */
export async function bindNumericVariable(
  node: any,
  fields: string | string[],
  variableName: string,
  hints: Hint[],
  scopeContext?: string,
): Promise<boolean> {
  const v = await findVariableByName(variableName, undefined, scopeContext);
  if (!v) {
    const floatVars = await figma.variables.getLocalVariablesAsync("FLOAT");
    const names = floatVars.map(v => v.name).slice(0, 20);
    hints.push({ type: "error", message: `Variable '${variableName}' not found. Available FLOAT variables: [${names.join(", ")}]` });
    return false;
  }
  if (v.resolvedType !== "FLOAT") {
    hints.push({ type: "error", message: `Variable '${variableName}' is ${v.resolvedType}, expected FLOAT.` });
    return false;
  }
  const fieldList = Array.isArray(fields) ? fields : [fields];
  for (const f of fieldList) {
    node.setBoundVariable(f, v);
  }
  const label = fieldList.length > 1 ? fieldList[0].replace(/^topLeftRadius$/, "cornerRadius") : fieldList[0];
  hints.push({ type: "confirm", message: `Bound ${label} → variable '${v.name}'.` });
  return true;
}

/**
 * Walk up ancestors from a node to find the nearest COMPONENT or COMPONENT_SET.
 * If `explicitId` is provided, fetches that node directly instead.
 * Returns null if no component is found.
 */
export async function findComponentForBinding(
  node: BaseNode,
  explicitId: string | undefined,
  hints: Hint[],
): Promise<ComponentNode | ComponentSetNode | null> {
  if (explicitId) {
    const target = await figma.getNodeByIdAsync(explicitId);
    if (!target) {
      hints.push({ type: "error", message: `componentId '${explicitId}' not found.` });
      return null;
    }
    if (target.type !== "COMPONENT" && target.type !== "COMPONENT_SET") {
      hints.push({ type: "error", message: `componentId '${explicitId}' is ${target.type}, not a component.` });
      return null;
    }
    return target as ComponentNode | ComponentSetNode;
  }
  let cursor: BaseNode | null = node.parent;
  while (cursor) {
    if (cursor.type === "COMPONENT" || cursor.type === "COMPONENT_SET") {
      return cursor as ComponentNode | ComponentSetNode;
    }
    cursor = cursor.parent;
  }
  return null;
}

/**
 * Resolve a component TEXT property key by prefix match.
 * Property keys have auto-generated suffixes like "Label#2:33" — agents often omit the suffix.
 * Returns the full key or null if not found.
 */
export function resolveComponentPropertyKey(
  defs: Record<string, { type: string }>,
  name: string,
): string | null {
  if (defs[name]) return name;
  return Object.keys(defs).find(k => k.startsWith(name + "#")) ?? null;
}

/**
 * Bind a text node to a component TEXT property by name.
 * Resolves the property key by prefix match and sets componentPropertyReferences.
 * For variant components (children of COMPONENT_SET), walks up to find the set that owns the property definitions.
 * Returns hints for errors (property not found, wrong type, parent not a component).
 */
export function bindTextToComponentProperty(
  textNode: any,
  comp: any,
  propertyName: string,
  hints: Hint[],
): boolean {
  // Variant components delegate property definitions to their parent COMPONENT_SET
  let defOwner = comp;
  if (comp.type === "COMPONENT" && comp.parent?.type === "COMPONENT_SET") {
    defOwner = comp.parent;
  }
  const defs = defOwner.componentPropertyDefinitions;
  const key = resolveComponentPropertyKey(defs, propertyName);
  if (!key) {
    const available = Object.keys(defs).filter(k => defs[k].type === "TEXT").map(k => k.split("#")[0]);
    hints.push({ type: "error", message: `componentPropertyName '${propertyName}' not found. Available TEXT properties: [${available.join(", ")}]` });
    return false;
  }
  if (defs[key].type !== "TEXT") {
    hints.push({ type: "error", message: `componentPropertyName '${propertyName}' is ${defs[key].type}, not TEXT.` });
    return false;
  }
  textNode.componentPropertyReferences = { characters: key };
  return true;
}

/**
 * Check if manual font properties match any local text style.
 * Returns a hint suggesting the matching style name if found,
 * or a prompt to create a text style if no match.
 */
export async function suggestTextStyle(
  fontSize: number,
  fontWeight: number,
): Promise<Hint> {
  const styles = await figma.getLocalTextStylesAsync();
  const matching = styles.filter(s => s.fontSize === fontSize);
  if (matching.length > 0) {
    const names = matching.map(s => s.name).slice(0, 5);
    return { type: "suggest", message: `Manual font (${fontSize}px / ${fontWeight}w) — text styles at same size: [${names.join(", ")}]. Use textStyleName to link to a design token.` };
  }
  return { type: "suggest", message: `Manual font (${fontSize}px / ${fontWeight}w) has no text style. Create one with styles(method: "create", type: "text"), then use textStyleName for design token consistency.` };
}
