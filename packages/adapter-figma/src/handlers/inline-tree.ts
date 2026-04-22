/**
 * Inline Children Tree Model — validates parent-child sizing before Figma node creation.
 *
 * Each inference is tagged with a confidence level:
 * - **deterministic**: one obvious Vibma rule, applied silently
 * - **ambiguous**: multiple plausible trees, triggers staging (edit-tier) or reject (create-tier)
 * - **conflict**: contradictory signals, always reject
 *
 * See ARCHITECTURE-stage-create.md for the full rule set and two-path authoring model.
 */

import type { Hint } from "./helpers";

// ─── Inference Tracking ─────────────────────────────────────────

export interface Inference {
  path: string;                              // "Card > Title"
  field: string;                             // "layoutMode"
  from: any;                                 // original value (undefined if missing)
  to: any;                                   // resolved value
  confidence: "deterministic" | "ambiguous";
  reason: string;
}

export interface ValidationResult {
  hasAmbiguity: boolean;
  inferences: Inference[];
}

// ─── Tree Model ─────────────────────────────────────────────────

interface ParentContext {
  layoutMode: string;      // "NONE" | "HORIZONTAL" | "VERTICAL"
  explicitNone: boolean;   // true if layoutMode:"NONE" was explicitly set
  sizingH: string;         // "FIXED" | "HUG" | "FILL"
  sizingV: string;         // "FIXED" | "HUG" | "FILL"
}

interface InlineNode {
  raw: any;
  type: string;
  name: string;
  path: string;            // "Card > Title" for inference messages
  parent: ParentContext;
  layoutMode: string;
  explicitNone: boolean;
  children: InlineNode[];
}

// ─── Resolvers ──────────────────────────────────────────────────

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function resolveEffectiveSizing(p: any, axis: "H" | "V"): string {
  if (axis === "H") return p.layoutSizingHorizontal || (p.width !== undefined ? "FIXED" : "HUG");
  return p.layoutSizingVertical || (p.height !== undefined ? "FIXED" : "HUG");
}

const AL_PARAMS = [
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "padding",
  "itemSpacing", "primaryAxisAlignItems", "counterAxisAlignItems", "counterAxisSpacing",
];

function resolveChildLayoutMode(p: any): { mode: string; explicitNone: boolean } {
  if (p.layoutMode === "NONE") return { mode: "NONE", explicitNone: true };
  if (p.layoutMode) return { mode: p.layoutMode, explicitNone: false };
  if (AL_PARAMS.some(k => p[k] !== undefined)) return { mode: "VERTICAL", explicitNone: false };
  if (p.layoutSizingHorizontal === "HUG" || p.layoutSizingVertical === "HUG") return { mode: "VERTICAL", explicitNone: false };
  if (p.layoutWrap && p.layoutWrap !== "NO_WRAP") return { mode: "HORIZONTAL", explicitNone: false };
  return { mode: "NONE", explicitNone: false };
}

function childName(child: any): string {
  return child.name || child.text || child.componentPropertyName || child.type || "child";
}

function childHasFillOrHug(child: any): boolean {
  const h = child.layoutSizingHorizontal;
  const v = child.layoutSizingVertical;
  return h === "FILL" || h === "HUG" || v === "FILL" || v === "HUG";
}

/** Check if parent has explicit dimensions (fixed-size container). */
function parentHasDimensions(p: any): boolean {
  return p.width !== undefined && p.height !== undefined;
}

interface AxisBudget {
  axis: "H" | "V";
  dimensionField: "width" | "height";
  anchorDimension?: number;
  fillCount: number;
  unknownSiblingCount: number;
  knownSiblingSpace: number;
  chromeSpace: number;
  leftoverSpace?: number;
}

function getAxisBudget(parentRaw: any, nodes: InlineNode[], axis: "H" | "V"): AxisBudget {
  const dimensionField = axis === "H" ? "width" : "height";
  const minField = axis === "H" ? "minWidth" : "minHeight";
  const maxField = axis === "H" ? "maxWidth" : "maxHeight";
  const sizingField = axis === "H" ? "layoutSizingHorizontal" : "layoutSizingVertical";

  const directAnchor = asNumber(parentRaw[dimensionField]);
  const minAnchor = asNumber(parentRaw[minField]);
  const maxAnchor = asNumber(parentRaw[maxField]);
  const anchorDimension = directAnchor
    ?? (minAnchor !== undefined && maxAnchor !== undefined && minAnchor === maxAnchor ? minAnchor : undefined);

  const padStart = axis === "H" ? asNumber(parentRaw.paddingLeft) : asNumber(parentRaw.paddingTop);
  const padEnd = axis === "H" ? asNumber(parentRaw.paddingRight) : asNumber(parentRaw.paddingBottom);
  const padAll = asNumber(parentRaw.padding);
  const itemSpacing = asNumber(parentRaw.itemSpacing);

  const chromeSpace =
    (padStart ?? padAll ?? 0) +
    (padEnd ?? padAll ?? 0) +
    (itemSpacing ?? 0) * Math.max(0, nodes.length - 1);

  let fillCount = 0;
  let unknownSiblingCount = 0;
  let knownSiblingSpace = 0;

  for (const node of nodes) {
    const sizing = node.raw[sizingField];
    const dimension = asNumber(node.raw[dimensionField]);

    if (sizing === "FILL") {
      fillCount++;
      continue;
    }

    if (dimension !== undefined) {
      knownSiblingSpace += dimension;
      continue;
    }

    unknownSiblingCount++;
  }

  const leftoverSpace = anchorDimension !== undefined
    ? anchorDimension - chromeSpace - knownSiblingSpace
    : undefined;

  return {
    axis,
    dimensionField,
    anchorDimension,
    fillCount,
    unknownSiblingCount,
    knownSiblingSpace,
    chromeSpace,
    leftoverSpace,
  };
}

function formatPx(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
}

// ─── Build Tree ─────────────────────────────────────────────────

function buildInlineTree(children: any[], parentCtx: ParentContext, parentPath: string): InlineNode[] {
  return children.map(child => {
    const type = child.type || "unknown";
    const name = childName(child);
    const path = parentPath ? `${parentPath} > ${name}` : name;

    // Leaf nodes (text, instance) have no layout mode
    if (type === "text" || type === "instance" || type === "unknown") {
      return { raw: child, type, name, path, parent: parentCtx, layoutMode: "NONE", explicitNone: false, children: [] };
    }

    // Frame/component children: resolve their own layout mode
    const { mode, explicitNone } = resolveChildLayoutMode(child);
    const childCtx: ParentContext = {
      layoutMode: mode,
      explicitNone,
      sizingH: resolveEffectiveSizing(child, "H"),
      sizingV: resolveEffectiveSizing(child, "V"),
    };

    const nested = child.children?.length
      ? buildInlineTree(child.children, childCtx, path)
      : [];

    return { raw: child, type, name, path, parent: parentCtx, layoutMode: mode, explicitNone, children: nested };
  });
}

// ─── Validate Tree ──────────────────────────────────────────────

function validateInlineTree(
  nodes: InlineNode[],
  parentRaw: any,
  parentPath: string,
  hints: Hint[],
  inferences: Inference[],
): void {
  // ── Level 1: Parent layout promotion ──
  const parentIsNone = (parentRaw.layoutMode || "NONE") === "NONE" && !parentRaw.layoutMode;
  const parentExplicitNone = parentRaw.layoutMode === "NONE";
  const anyChildNeedsAL = nodes.some(n => childHasFillOrHug(n.raw));

  // Conflict: explicit NONE + children need AL
  if (anyChildNeedsAL && parentExplicitNone) {
    const culprit = nodes.find(n => childHasFillOrHug(n.raw))!;
    throw new Error(
      `layoutMode:'NONE' conflicts with child '${culprit.name}' using FILL/HUG sizing. ` +
      `Remove layoutMode:'NONE' to let auto-layout be inferred, or use FIXED sizing on children.`
    );
  }

  // Promote static parent to AL when children need it
  if (anyChildNeedsAL && parentIsNone) {
    const hasDims = parentHasDimensions(parentRaw);
    const culprit = nodes.find(n => childHasFillOrHug(n.raw))!;

    // Confidence: deterministic if parent has dimensions (clear container intent), ambiguous otherwise
    const confidence = hasDims ? "deterministic" as const : "ambiguous" as const;
    const reason = hasDims
      ? "Fixed-size parent with FILL/HUG children — container intent"
      : "No dimensions — container size unknown, promoted to VERTICAL";

    const from = parentRaw.layoutMode;
    parentRaw.layoutMode = "VERTICAL";

    inferences.push({ path: parentPath || "(root)", field: "layoutMode", from, to: "VERTICAL", confidence, reason });
    hints.push({
      type: "confirm",
      message: `Promoted to auto-layout (VERTICAL) because child '${culprit.name}' uses FILL/HUG sizing.`,
    });

    // Update parent context in all nodes to reflect promotion
    const updatedCtx: ParentContext = {
      layoutMode: "VERTICAL",
      explicitNone: false,
      sizingH: resolveEffectiveSizing(parentRaw, "H"),
      sizingV: resolveEffectiveSizing(parentRaw, "V"),
    };
    for (const node of nodes) node.parent = updatedCtx;
  }

  // ── Level 2 + 3: Per-node, per-axis validation ──
  const parentIsVertical = nodes[0]?.parent.layoutMode === "VERTICAL";
  const primaryField = parentIsVertical ? "layoutSizingVertical" : "layoutSizingHorizontal";
  const primaryDimName = parentIsVertical ? "height" : "width";
  const parentPrimarySizing = nodes[0]
    ? (parentIsVertical ? nodes[0].parent.sizingV : nodes[0].parent.sizingH)
    : "HUG";
  const primaryBudget = nodes.length > 0 && nodes[0]?.parent.layoutMode !== "NONE"
    ? getAxisBudget(parentRaw, nodes, parentIsVertical ? "V" : "H")
    : null;
  const hasPrimaryFillChildren = nodes.some((node) => node.raw[primaryField] === "FILL");

  if (parentPrimarySizing === "HUG" && hasPrimaryFillChildren && primaryBudget?.anchorDimension !== undefined) {
    const leftover = primaryBudget.leftoverSpace;
    if (leftover !== undefined && leftover < 0) {
      throw new Error(
        `Parent '${parentPath}' has ${primaryDimName}:${formatPx(primaryBudget.anchorDimension)} but its fixed chrome/siblings already need ${formatPx(primaryBudget.chromeSpace + primaryBudget.knownSiblingSpace)}. ` +
        `Primary-axis FILL children cannot fit without a larger ${primaryDimName}.`
      );
    }

    const from = parentRaw[primaryField] ?? "HUG";
    parentRaw[primaryField] = "FIXED";
    for (const node of nodes) {
      if (parentIsVertical) node.parent.sizingV = "FIXED";
      else node.parent.sizingH = "FIXED";
    }

    const leftoverNote = leftover !== undefined
      ? ` with ${formatPx(leftover)}px of remaining space${primaryBudget.fillCount > 1 ? ` shared across ${primaryBudget.fillCount} FILL children` : ""}`
      : "";
    inferences.push({
      path: parentPath || "(root)",
      field: primaryField,
      from,
      to: "FIXED",
      confidence: "deterministic",
      reason:
        `Explicit ${primaryDimName}:${formatPx(primaryBudget.anchorDimension)} plus primary-axis FILL children needs a real create-time anchor${leftoverNote}`,
    });
    hints.push({
      type: "confirm",
      message:
        `Parent '${parentPath}' uses primary-axis FILL children with explicit ${primaryDimName}:${formatPx(primaryBudget.anchorDimension)} — using ${primaryField}:'FIXED' so the leftover space is preserved at creation time${leftoverNote}.`,
    });
  }

  for (const node of nodes) {
    const { parent, raw, path } = node;

    // Skip validation for non-AL parents
    if (parent.layoutMode === "NONE") {
      if (node.children.length) {
        validateInlineTree(node.children, raw, path, hints, inferences);
      }
      continue;
    }

    // Determine axis roles from parent direction
    const isVertical = parent.layoutMode === "VERTICAL";
    const axes: Array<{
      field: "layoutSizingHorizontal" | "layoutSizingVertical";
      role: "cross" | "primary";
      dimension: number | undefined;
      sizing: string | undefined;
      parentSizing: string;
    }> = [
      {
        field: "layoutSizingHorizontal",
        role: isVertical ? "cross" : "primary",
        dimension: raw.width,
        sizing: raw.layoutSizingHorizontal,
        parentSizing: parent.sizingH,
      },
      {
        field: "layoutSizingVertical",
        role: isVertical ? "primary" : "cross",
        dimension: raw.height,
        sizing: raw.layoutSizingVertical,
        parentSizing: parent.sizingV,
      },
    ];

    for (const axis of axes) {
      const { field, role, dimension, sizing, parentSizing } = axis;
      const dimName = field === "layoutSizingHorizontal" ? "width" : "height";

      // Level 2a: HUG parent + FILL child on the primary axis — invalid.
      // A HUG parent normally sizes from its children, but an explicit parent dimension
      // can preserve a real leftover-space anchor (common in existing nodes / staged edits).
      if (parentSizing === "HUG" && sizing === "FILL") {
        if (role === "primary") {
          throw new Error(
            `Child '${node.name}' has ${field}:'FILL' inside parent '${parentPath}' that is HUG on the same axis. ` +
            `A HUG parent sizes to its children, so FILL has no width/height anchor here. ` +
            `Resolve by choosing one: parent ${field}:'FIXED' with explicit ${dimName}, parent ${field}:'FILL' within its own parent, or child ${field}:'HUG'.`
          );
        }

        // Level 2b: Cross-axis FILL inside HUG is ambiguous but recoverable.
        inferences.push({
          path, field, from: "FILL", to: "FILL", confidence: "ambiguous",
          reason: `Cross-axis FILL inside HUG parent — siblings determine width`,
        });
        hints.push({
          type: "warn",
          message: `Child '${node.name}' has ${field}:'FILL' on the cross-axis inside a HUG parent — FILL adopts the largest sibling size. Set ${dimName} on parent for explicit sizing.`,
        });
      }

      // Conflict: FILL + explicit dimension
      if (sizing === "FILL" && dimension !== undefined) {
        throw new Error(
          `Child '${node.name}' has both ${field}:'FILL' and ${dimName} — these conflict. ` +
          `Use FILL to stretch to parent, or set ${dimName} with ${field}:'FIXED'.`
        );
      }

      // Level 3: FIXED without dimension — deterministic inference from axis role
      if (sizing === "FIXED" && dimension === undefined) {
        const from = "FIXED";
        if (role === "cross") {
          raw[field] = "FILL";
          inferences.push({
            path, field, from, to: "FILL", confidence: "deterministic",
            reason: "FIXED on cross-axis without dimension — stretch to parent",
          });
          hints.push({
            type: "confirm",
            message: `Child '${node.name}' has ${field}:'FIXED' on cross-axis without ${dimName} — using FILL to stretch to parent.`,
          });
        } else {
          raw[field] = "HUG";
          inferences.push({
            path, field, from, to: "HUG", confidence: "deterministic",
            reason: "FIXED on primary axis without dimension — content-size",
          });
          hints.push({
            type: "confirm",
            message: `Child '${node.name}' has ${field}:'FIXED' on primary axis without ${dimName} — using HUG to content-size.`,
          });
        }
      }
    }

    // Recurse into frame/component children
    if (node.children.length) {
      validateInlineTree(node.children, raw, path, hints, inferences);
    }
  }
}

// ─── Diff & Payload Helpers ─────────────────────────────────────

/**
 * Format ambiguous inferences as a git-style diff string.
 * Only includes ambiguous decisions — deterministic inferences are silent.
 */
export function formatDiff(inferences: Inference[]): string {
  const ambiguous = inferences.filter(i => i.confidence === "ambiguous");
  if (ambiguous.length === 0) return "";

  // Group by path
  const byPath = new Map<string, Inference[]>();
  for (const inf of ambiguous) {
    const group = byPath.get(inf.path) || [];
    group.push(inf);
    byPath.set(inf.path, group);
  }

  const lines: string[] = [];
  for (const [path, infs] of byPath) {
    lines.push(path);
    for (const inf of infs) {
      const fromStr = inf.from === undefined ? "(not set)" : JSON.stringify(inf.from);
      const toStr = JSON.stringify(inf.to);
      lines.push(`- ${inf.field}: ${fromStr}`);
      lines.push(`+ ${inf.field}: ${toStr}  # ${inf.reason}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

/**
 * Build a corrected payload in authoring-schema form.
 *
 * Takes two params:
 * - `mutatedParams`: params after validateAndFixInlineChildren (has inferred fields)
 * - `originalParams`: optional pre-mutation snapshot (preserves authoring aliases like fillColor)
 *
 * If `originalParams` is provided, we start from it and overlay only the fields that
 * were changed by the opinion engine (layoutMode, layoutSizingH/V on children).
 * This keeps the payload in the form the agent authored (fillColor stays fillColor,
 * not the expanded fills array).
 */
export function buildCorrectedPayload(mutatedParams: any, originalParams?: any): any {
  if (!originalParams) {
    const clone = JSON.parse(JSON.stringify(mutatedParams));
    stripInternalFields(clone);
    return clone;
  }

  const base = JSON.parse(JSON.stringify(originalParams));
  // Overlay inferred fields from mutated onto original
  applyInferredFields(base, mutatedParams);
  stripInternalFields(base);
  return base;
}

/** Fields that the opinion engine may set/change. */
const INFERRED_FIELDS = ["layoutMode", "layoutSizingHorizontal", "layoutSizingVertical"];

function applyInferredFields(target: any, source: any): void {
  for (const field of INFERRED_FIELDS) {
    if (source[field] !== undefined) target[field] = source[field];
  }
  // Recurse into children
  if (Array.isArray(target.children) && Array.isArray(source.children)) {
    for (let i = 0; i < target.children.length && i < source.children.length; i++) {
      applyInferredFields(target.children[i], source.children[i]);
    }
  }
}

const INTERNAL_FIELDS = new Set(["_skipOverlapCheck", "_inlineHints", "_originalParams", "_caps"]);

function stripInternalFields(obj: any): void {
  if (!obj || typeof obj !== "object") return;
  for (const key of INTERNAL_FIELDS) {
    delete obj[key];
  }
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) stripInternalFields(child);
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Validate and fix inline children before Figma node creation.
 * Builds an annotated tree model, applies sizing rules, tracks inferences.
 *
 * Always applies all fixes (deterministic + ambiguous). Returns:
 * - `hasAmbiguity`: true if any inference was ambiguous (caller decides: stage or reject)
 * - `inferences`: full list with confidence tags, for diff/payload generation
 *
 * Mutates `parentParams` (may promote layoutMode) and children (may fix sizing).
 * Throws on conflicts (FILL+dimension, explicit NONE+FILL/HUG).
 */
export function validateAndFixInlineChildren(parentParams: any, hints: Hint[]): ValidationResult {
  const parentLM = parentParams.layoutMode || "";
  const explicitNone = parentParams.layoutMode === "NONE";
  const parentCtx: ParentContext = {
    layoutMode: parentLM || "NONE",
    explicitNone,
    sizingH: resolveEffectiveSizing(parentParams, "H"),
    sizingV: resolveEffectiveSizing(parentParams, "V"),
  };
  const parentName = parentParams.name || "(root)";
  const inferences: Inference[] = [];

  // Root parent: FIXED without dimension → HUG (content + padding drives size)
  if (parentLM && parentLM !== "NONE") {
    const axes: Array<{ field: "layoutSizingHorizontal" | "layoutSizingVertical"; dim: "width" | "height" }> = [
      { field: "layoutSizingHorizontal", dim: "width" },
      { field: "layoutSizingVertical", dim: "height" },
    ];
    for (const { field, dim } of axes) {
      if (parentParams[field] === "FIXED" && parentParams[dim] === undefined) {
        parentParams[field] = "HUG";
        inferences.push({
          path: parentName, field, from: "FIXED", to: "HUG", confidence: "deterministic",
          reason: `FIXED without ${dim} — using HUG to size from content`,
        });
        hints.push({
          type: "confirm",
          message: `${field}:'FIXED' without ${dim} — using HUG to size from content + padding.`,
        });
        if (field === "layoutSizingHorizontal") parentCtx.sizingH = "HUG";
        else parentCtx.sizingV = "HUG";
      }
    }
  }

  const tree = buildInlineTree(parentParams.children, parentCtx, parentName);
  validateInlineTree(tree, parentParams, parentName, hints, inferences);

  const hasAmbiguity = inferences.some(i => i.confidence === "ambiguous");
  return { hasAmbiguity, inferences };
}
