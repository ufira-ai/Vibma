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
  if (p.layoutWrap && p.layoutWrap !== "NO_WRAP") return { mode: "VERTICAL", explicitNone: false };
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

      // Level 2: HUG parent + FILL child — ambiguous, warn but allow.
      // Figma resolves: widest content determines parent width, FILL children stretch to match.
      if (parentSizing === "HUG" && sizing === "FILL") {
        inferences.push({
          path, field, from: "FILL", to: "FILL", confidence: "ambiguous",
          reason: `FILL inside HUG parent — siblings determine width`,
        });
        hints.push({
          type: "warn",
          message: `Child '${node.name}' has ${field}:'FILL' inside HUG parent — FILL children adopt the width of the widest sibling. Set ${dimName} on parent for explicit sizing.`,
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
 * Build a corrected payload from the mutated params.
 * Deep clones and strips internal fields.
 * Call AFTER validateAndFixInlineChildren but BEFORE setupFrameNode
 * (so the payload is in authoring-schema form, not internal form).
 */
export function buildCorrectedPayload(mutatedParams: any): any {
  const clone = JSON.parse(JSON.stringify(mutatedParams));
  stripInternalFields(clone);
  return clone;
}

const INTERNAL_FIELDS = new Set(["_skipOverlapCheck", "_inlineHints"]);

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
  const tree = buildInlineTree(parentParams.children, parentCtx, parentName);
  validateInlineTree(tree, parentParams, parentName, hints, inferences);

  const hasAmbiguity = inferences.some(i => i.confidence === "ambiguous");
  return { hasAmbiguity, inferences };
}
