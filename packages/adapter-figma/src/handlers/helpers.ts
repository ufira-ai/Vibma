import { serializeNode, DEFAULT_NODE_BUDGET } from "../utils/serialize-node";
import type { BatchResult } from "@ufira/vibma/types";

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
export async function batchHandler<TItem, TResult>(
  params: { items?: TItem[]; depth?: number } & Record<string, unknown>,
  fn: (item: TItem) => Promise<TResult>,
): Promise<BatchResult<TResult>> {
  const items = (params.items || [params]) as TItem[];
  const depth = params.depth;
  const results: Array<TResult | "ok" | { error: string }> = [];
  const warningSet = new Set<string>();
  for (const item of items) {
    try {
      let result: any = await fn(item);
      if (depth !== undefined && result?.id) {
        const snapshot = await nodeSnapshot(result.id, depth);
        if (snapshot) result = { ...result, ...snapshot };
      }
      // Hoist warnings to batch level (deduplicated)
      if (result?.warning) {
        warningSet.add(result.warning);
        delete result.warning;
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
  }
  const out: BatchResult<TResult> = { results };
  if (warningSet.size > 0) {
    out.warnings = [...warningSet];
    out._action = "Fix these warnings before proceeding. Each warning describes the issue and the exact tool call to resolve it.";
  }
  return out;
}

/**
 * Append a node to a parent (by ID) or the current page.
 * Returns the parent node if parentId was given, null otherwise.
 */
export async function appendToParent(node: SceneNode, parentId?: string): Promise<BaseNode | null> {
  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) throw new Error(`Parent not found: ${parentId}`);
    if (!("appendChild" in parent))
      throw new Error(`Parent does not support children: ${parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
    (parent as any).appendChild(node);
    return parent;
  }
  figma.currentPage.appendChild(node);
  return null;
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
 * Format a "style not found" hint that includes available style names
 * so the agent can self-correct (e.g. "Heading" → "Heading/H2").
 */
export function styleNotFoundHint(param: string, value: string, available: string[], limit = 20): string {
  if (available.length === 0) return `${param} '${value}' not found (no local styles of this type exist).`;
  const names = available.slice(0, limit);
  const suffix = available.length > limit ? `, … and ${available.length - limit} more` : "";
  return `${param} '${value}' not found. Available: [${names.join(", ")}${suffix}]`;
}

/**
 * Check if a hardcoded color matches any local paint style or color variable.
 * Returns a hint suggesting the exact style/variable name if matched,
 * or a prompt to create one if no match.
 */
export async function suggestStyleForColor(
  color: { r: number, g: number, b: number, a?: number },
  styleParam: string,
): Promise<string> {
  const hex = `#${[color.r, color.g, color.b].map(v => Math.round((v ?? 0) * 255).toString(16).padStart(2, "0")).join("")}`;
  const eps = 0.02;
  const cr = color.r ?? 0, cg = color.g ?? 0, cb = color.b ?? 0, ca = color.a ?? 1;

  // Check paint styles
  const styles = await figma.getLocalPaintStylesAsync();
  for (const style of styles) {
    const paints = style.paints;
    if (paints.length === 1 && paints[0].type === "SOLID") {
      const sc = (paints[0] as SolidPaint).color;
      const so = (paints[0] as SolidPaint).opacity ?? 1;
      if (Math.abs(sc.r - cr) < eps && Math.abs(sc.g - cg) < eps &&
          Math.abs(sc.b - cb) < eps && Math.abs(so - ca) < eps) {
        return `Hardcoded color ${hex} matches style '${style.name}'. Use ${styleParam}: '${style.name}' to link to the design token.`;
      }
    }
  }

  // Check color variables (default mode values)
  const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
  if (colorVars.length > 0) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const defaultModes = new Map(collections.map(c => [c.id, c.defaultModeId]));
    for (const v of colorVars) {
      const modeId = defaultModes.get(v.variableCollectionId);
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (!val || typeof val !== "object" || "type" in val) continue;
      const vc = val as { r: number; g: number; b: number; a?: number };
      if (Math.abs(vc.r - cr) < eps && Math.abs(vc.g - cg) < eps &&
          Math.abs(vc.b - cb) < eps && Math.abs((vc.a ?? 1) - ca) < eps) {
        return `Hardcoded color ${hex} matches variable '${v.name}' (${v.id}). Bind it via frames(method:"update", items:[{id, bindings:[{field:"fills/0/color", variableId:"${v.id}"}]}]).`;
      }
    }
  }

  return `Hardcoded color ${hex} has no matching paint style or color variable. Create one with styles(method: "create", type: "paint") or variables(method: "create"), then use ${styleParam} for design token consistency.`;
}

/**
 * Check if manual font properties match any local text style.
 * Returns a hint suggesting the matching style name if found,
 * or a prompt to create a text style if no match.
 */
export async function suggestTextStyle(
  fontSize: number,
  fontWeight: number,
): Promise<string> {
  const styles = await figma.getLocalTextStylesAsync();
  const matching = styles.filter(s => s.fontSize === fontSize);
  if (matching.length > 0) {
    const names = matching.map(s => s.name).slice(0, 5);
    return `Manual font (${fontSize}px / ${fontWeight}w) — text styles at same size: [${names.join(", ")}]. Use textStyleName to link to a design token.`;
  }
  return `Manual font (${fontSize}px / ${fontWeight}w) has no text style. Create one with styles(method: "create", type: "text"), then use textStyleName for design token consistency.`;
}
