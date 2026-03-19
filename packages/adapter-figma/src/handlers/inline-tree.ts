/**
 * Inline Children Tree Model — validates parent-child sizing before Figma node creation.
 *
 * ## Rule Set
 *
 * ### Level 1: Parent Layout Resolution
 * | Parent state                              | Children FILL/HUG? | Action                                           |
 * |-------------------------------------------|--------------------|--------------------------------------------------|
 * | Explicit layoutMode                       | —                  | Use as-is                                        |
 * | Has AL params (padding/spacing/alignment) | —                  | Already inferred VERTICAL by resolveLayoutMode   |
 * | width+height, no layoutMode               | Yes                | Promote to VERTICAL (fixed-size AL container)    |
 * | No dimensions, no layoutMode              | Yes                | Promote to VERTICAL (HUG — L2 warns on FILL)    |
 * | Explicit layoutMode:"NONE"                | Yes                | REJECT                                           |
 *
 * ### Level 2: Per-Axis Sizing (child vs resolved parent)
 * | Parent sizing | Child sizing | Action                   |
 * |---------------|-------------|---------------------------|
 * | HUG           | FILL        | WARN (Figma resolves via widest sibling) |
 * | FIXED/FILL    | FILL        | Pass                      |
 * | Any           | HUG         | Pass                      |
 * | Any           | FIXED       | Pass (see Level 3)        |
 *
 * ### Level 3: Child Sizing Inference (direction-aware, inside AL)
 * Axis roles: VERTICAL parent → H=cross, V=primary. HORIZONTAL → H=primary, V=cross.
 *
 * | Axis role | Dimension? | Sizing   | Action                                   |
 * |-----------|-----------|----------|------------------------------------------|
 * | Cross     | No        | omitted  | Default FILL (parent constrained) or HUG |
 * | Cross     | No        | FILL     | Allow                                    |
 * | Cross     | No        | FIXED    | Warn → FILL                              |
 * | Cross     | Yes       | FILL     | REJECT (conflict)                        |
 * | Cross     | Yes       | omit/FIX | Allow                                    |
 * | Primary   | No        | omitted  | Default HUG                              |
 * | Primary   | No        | FILL     | Allow                                    |
 * | Primary   | No        | FIXED    | Warn → HUG                               |
 * | Primary   | Yes       | FILL     | REJECT (conflict)                        |
 * | Primary   | Yes       | omit/FIX | Allow                                    |
 */

import type { Hint } from "./helpers";

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

// ─── Build Tree ─────────────────────────────────────────────────

function buildInlineTree(children: any[], parentCtx: ParentContext): InlineNode[] {
  return children.map(child => {
    const type = child.type || "unknown";
    const name = childName(child);

    // Leaf nodes (text, instance) have no layout mode
    if (type === "text" || type === "instance" || type === "unknown") {
      return { raw: child, type, name, parent: parentCtx, layoutMode: "NONE", explicitNone: false, children: [] };
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
      ? buildInlineTree(child.children, childCtx)
      : [];

    return { raw: child, type, name, parent: parentCtx, layoutMode: mode, explicitNone, children: nested };
  });
}

// ─── Validate Tree ──────────────────────────────────────────────

function validateInlineTree(nodes: InlineNode[], parentRaw: any, hints: Hint[]): void {
  // ── Level 1: Parent layout promotion ──
  const parentIsNone = (parentRaw.layoutMode || "NONE") === "NONE" && !parentRaw.layoutMode;
  const parentExplicitNone = parentRaw.layoutMode === "NONE";
  const anyChildNeedsAL = nodes.some(n => childHasFillOrHug(n.raw));

  if (anyChildNeedsAL && parentExplicitNone) {
    const culprit = nodes.find(n => childHasFillOrHug(n.raw))!;
    throw new Error(
      `layoutMode:'NONE' conflicts with child '${culprit.name}' using FILL/HUG sizing. ` +
      `Remove layoutMode:'NONE' to let auto-layout be inferred, or use FIXED sizing on children.`
    );
  }

  if (anyChildNeedsAL && parentIsNone) {
    parentRaw.layoutMode = "VERTICAL";
    const culprit = nodes.find(n => childHasFillOrHug(n.raw))!;
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
    const { parent, raw } = node;

    // Skip validation for non-AL parents (after potential promotion, if still NONE it means no children needed AL)
    if (parent.layoutMode === "NONE") {
      // Recurse into frame/component children (they have their own context)
      if (node.children.length) {
        validateInlineTree(node.children, raw, hints);
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

      // Level 2: HUG parent + FILL child — warn but allow.
      // Figma resolves this: widest content determines parent width, FILL children stretch to match.
      // Valid for top-level containers (buttons, cards) but may surprise for deeply nested layouts.
      if (parentSizing === "HUG" && sizing === "FILL") {
        hints.push({
          type: "warn",
          message: `Child '${node.name}' has ${field}:'FILL' inside HUG parent — FILL children adopt the width of the widest sibling. Set ${dimName} on parent for explicit sizing.`,
        });
      }

      // Level 3: Direction-aware inference
      if (sizing === "FILL" && dimension !== undefined) {
        // FILL + explicit dimension = conflict
        throw new Error(
          `Child '${node.name}' has both ${field}:'FILL' and ${dimName} — these conflict. ` +
          `Use FILL to stretch to parent, or set ${dimName} with ${field}:'FIXED'.`
        );
      }

      if (sizing === "FIXED" && dimension === undefined) {
        // FIXED without dimension — infer from axis role
        if (role === "cross") {
          raw[field] = "FILL";
          hints.push({
            type: "confirm",
            message: `Child '${node.name}' has ${field}:'FIXED' on cross-axis without ${dimName} — using FILL to stretch to parent.`,
          });
        } else {
          raw[field] = "HUG";
          hints.push({
            type: "confirm",
            message: `Child '${node.name}' has ${field}:'FIXED' on primary axis without ${dimName} — using HUG to content-size.`,
          });
        }
      }
    }

    // Recurse into frame/component children
    if (node.children.length) {
      validateInlineTree(node.children, raw, hints);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Validate and fix inline children before Figma node creation.
 * Builds an annotated tree model, then applies sizing rules.
 * Mutates `parentParams` (may promote layoutMode) and `parentParams.children` (may fix sizing).
 * Throws on unresolvable conflicts.
 */
export function validateAndFixInlineChildren(parentParams: any, hints: Hint[]): void {
  const parentLM = parentParams.layoutMode || "";
  const explicitNone = parentParams.layoutMode === "NONE";
  const parentCtx: ParentContext = {
    layoutMode: parentLM || "NONE",
    explicitNone,
    sizingH: resolveEffectiveSizing(parentParams, "H"),
    sizingV: resolveEffectiveSizing(parentParams, "V"),
  };
  const tree = buildInlineTree(parentParams.children, parentCtx);
  validateInlineTree(tree, parentParams, hints);
}
