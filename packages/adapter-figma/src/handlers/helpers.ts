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
 * Resolve any variable by name, optionally scoped to a collection name.
 * Throws if the name matches multiple variables across collections and no collectionName is given.
 */
export async function findVariableByName(name: string, collectionName?: string): Promise<any> {
  const all = await figma.variables.getLocalVariablesAsync();
  let matches = all.filter(v => v.name === name);
  if (matches.length === 0) {
    const lower = name.toLowerCase();
    matches = all.filter(v => v.name.toLowerCase() === lower);
  }
  if (matches.length === 0) return null;
  if (collectionName) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const col = collections.find(c => c.name === collectionName) ||
                collections.find(c => c.name.toLowerCase() === collectionName.toLowerCase());
    if (!col) throw new Error(`Collection '${collectionName}' not found`);
    const match = matches.find(v => v.variableCollectionId === col.id);
    if (!match) throw new Error(`Variable '${name}' not found in collection '${collectionName}'`);
    return match;
  }
  if (matches.length > 1) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const colNames = matches.map(v => collections.find(c => c.id === v.variableCollectionId)?.name || "?");
    throw new Error(`Variable '${name}' exists in multiple collections: [${colNames.join(", ")}]. Specify collectionName to disambiguate.`);
  }
  return matches[0];
}

/**
 * Resolve a color variable by name (case-insensitive, supports slash paths like "bg/primary").
 * Returns the Variable object or null.
 */
export async function findColorVariableByName(name: string): Promise<any> {
  const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
  const exact = colorVars.find(v => v.name === name);
  if (exact) return exact;
  const lower = name.toLowerCase();
  return colorVars.find(v => v.name.toLowerCase() === lower) || null;
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

/** Result from color matching: includes the hint AND auto-bind data when a match is found. */
export interface ColorMatchResult {
  hint: string;
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
): Promise<ColorMatchResult> {
  const hex = `#${[color.r, color.g, color.b].map(v => Math.round((v ?? 0) * 255).toString(16).padStart(2, "0")).join("")}`;
  const eps = 0.02;
  const cr = color.r ?? 0, cg = color.g ?? 0, cb = color.b ?? 0, ca = color.a ?? 1;

  // Check color variables first (preferred — supports multi-mode theming)
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
        return {
          hint: `Auto-bound color ${hex} → variable '${v.name}'.`,
          variable: v,
        };
      }
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
          hint: `Auto-bound color ${hex} → style '${style.name}'.`,
          paintStyleId: style.id,
        };
      }
    }
  }

  return { hint: `Hardcoded color ${hex} has no matching paint style or color variable. Create one with styles(method: "create", type: "paint") or variables(method: "create"), then use ${styleParam} for design token consistency.` };
}

/**
 * Apply fill to a node with full token resolution and auto-binding.
 * Priority: fillVariableId > fillVariableName > fillStyleName > fillColor (with auto-bind).
 * Returns hints array with auto-bind confirmations or errors.
 */
export async function applyFillWithAutoBind(
  node: any,
  p: { fillVariableId?: string; fillVariableName?: string; fillStyleName?: string; fillColor?: any },
  hints: string[],
): Promise<boolean> {
  // 1. Explicit variable ID
  if (p.fillVariableId) {
    const v = await findVariableById(p.fillVariableId);
    if (v) {
      node.fills = [solidPaint(p.fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", v);
      node.fills = [bound];
      return true;
    }
    hints.push(`fillVariableId '${p.fillVariableId}' not found.`);
    return false;
  }

  // 2. Variable by name (new!)
  if (p.fillVariableName) {
    const v = await findColorVariableByName(p.fillVariableName);
    if (v) {
      node.fills = [solidPaint(p.fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", v);
      node.fills = [bound];
      hints.push(`Bound fill → variable '${v.name}'.`);
      return true;
    }
    const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
    const names = colorVars.map(v => v.name).slice(0, 20);
    hints.push(`fillVariableName '${p.fillVariableName}' not found. Available: [${names.join(", ")}]`);
    return false;
  }

  // 3. Paint style by name
  if (p.fillStyleName) {
    const styles = await figma.getLocalPaintStylesAsync();
    const available = styles.map(s => s.name);
    const exact = styles.find(s => s.name === p.fillStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.fillStyleName!.toLowerCase()));
    if (match) {
      try { await node.setFillStyleIdAsync(match.id); return true; }
      catch (e: any) { hints.push(`fillStyleName '${p.fillStyleName}' matched but failed to apply: ${e.message}`); return false; }
    }
    hints.push(styleNotFoundHint("fillStyleName", p.fillStyleName, available));
    return false;
  }

  // 4. Direct color — auto-bind if matching variable/style exists
  if (p.fillColor) {
    node.fills = [solidPaint(p.fillColor)];
    const match = await suggestStyleForColor(p.fillColor, "fillStyleName");
    if (match.variable) {
      // Auto-bind to matching variable
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0] as SolidPaint, "color", match.variable);
      node.fills = [bound];
      hints.push(match.hint);
      return true;
    }
    if (match.paintStyleId) {
      // Auto-apply matching paint style
      try {
        await node.setFillStyleIdAsync(match.paintStyleId);
        hints.push(match.hint);
        return true;
      } catch { /* fall through to keep direct color */ }
    }
    hints.push(match.hint);
    return false;
  }

  return false;
}

/**
 * Apply stroke to a node with full token resolution and auto-binding.
 * Priority: strokeVariableId > strokeVariableName > strokeStyleName > strokeColor (with auto-bind).
 */
export async function applyStrokeWithAutoBind(
  node: any,
  p: { strokeVariableId?: string; strokeVariableName?: string; strokeStyleName?: string; strokeColor?: any; strokeWeight?: number;
       strokeTopWeight?: number; strokeBottomWeight?: number; strokeLeftWeight?: number; strokeRightWeight?: number },
  hints: string[],
): Promise<void> {
  if (p.strokeVariableId) {
    const v = await findVariableById(p.strokeVariableId);
    if (v) {
      node.strokes = [solidPaint(p.strokeColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", v);
      node.strokes = [bound];
    } else {
      hints.push(`strokeVariableId '${p.strokeVariableId}' not found.`);
    }
  } else if (p.strokeVariableName) {
    const v = await findColorVariableByName(p.strokeVariableName);
    if (v) {
      node.strokes = [solidPaint(p.strokeColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", v);
      node.strokes = [bound];
      hints.push(`Bound stroke → variable '${v.name}'.`);
    } else {
      const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
      hints.push(`strokeVariableName '${p.strokeVariableName}' not found. Available: [${colorVars.map(v => v.name).slice(0, 20).join(", ")}]`);
    }
  } else if (p.strokeStyleName) {
    const styles = await figma.getLocalPaintStylesAsync();
    const available = styles.map(s => s.name);
    const exact = styles.find(s => s.name === p.strokeStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.strokeStyleName!.toLowerCase()));
    if (match) {
      try { await node.setStrokeStyleIdAsync(match.id); }
      catch (e: any) { hints.push(`strokeStyleName '${p.strokeStyleName}' matched but failed to apply: ${e.message}`); }
    } else {
      hints.push(styleNotFoundHint("strokeStyleName", p.strokeStyleName, available));
    }
  } else if (p.strokeColor) {
    node.strokes = [solidPaint(p.strokeColor)];
    const match = await suggestStyleForColor(p.strokeColor, "strokeStyleName");
    if (match.variable) {
      const bound = figma.variables.setBoundVariableForPaint(node.strokes[0] as SolidPaint, "color", match.variable);
      node.strokes = [bound];
      hints.push(match.hint);
    } else if (match.paintStyleId) {
      try { await node.setStrokeStyleIdAsync(match.paintStyleId); hints.push(match.hint); } catch {}
    } else {
      hints.push(match.hint);
    }
  }
  if (p.strokeWeight !== undefined) node.strokeWeight = p.strokeWeight;
  if (p.strokeTopWeight !== undefined) node.strokeTopWeight = p.strokeTopWeight;
  if (p.strokeBottomWeight !== undefined) node.strokeBottomWeight = p.strokeBottomWeight;
  if (p.strokeLeftWeight !== undefined) node.strokeLeftWeight = p.strokeLeftWeight;
  if (p.strokeRightWeight !== undefined) node.strokeRightWeight = p.strokeRightWeight;
}

/**
 * Apply font color to a text node with auto-binding.
 * Priority: fontColorVariableId > fontColorVariableName > fontColorStyleName > fontColor (with auto-bind).
 */
export async function applyFontColorWithAutoBind(
  textNode: any,
  p: { fontColorVariableId?: string; fontColorVariableName?: string; fontColorStyleName?: string; fontColor?: any },
  hints: string[],
  paintStyles?: any[] | null,
): Promise<boolean> {
  const makeSolid = (fc: any) => ({ type: "SOLID" as const, color: { r: fc.r ?? 0, g: fc.g ?? 0, b: fc.b ?? 0 }, opacity: fc.a ?? 1 });

  if (p.fontColorVariableId) {
    const v = await findVariableById(p.fontColorVariableId);
    if (v) {
      const fc = p.fontColor || { r: 0, g: 0, b: 0, a: 1 };
      textNode.fills = [makeSolid(fc)];
      const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0] as SolidPaint, "color", v);
      textNode.fills = [bound];
      return true;
    }
    hints.push(`fontColorVariableId '${p.fontColorVariableId}' not found.`);
    return false;
  }

  if (p.fontColorVariableName) {
    const v = await findColorVariableByName(p.fontColorVariableName);
    if (v) {
      const fc = p.fontColor || { r: 0, g: 0, b: 0, a: 1 };
      textNode.fills = [makeSolid(fc)];
      const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0] as SolidPaint, "color", v);
      textNode.fills = [bound];
      hints.push(`Bound font color → variable '${v.name}'.`);
      return true;
    }
    const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
    hints.push(`fontColorVariableName '${p.fontColorVariableName}' not found. Available: [${colorVars.map(v => v.name).slice(0, 20).join(", ")}]`);
    return false;
  }

  if (p.fontColorStyleName) {
    const styles = paintStyles || await figma.getLocalPaintStylesAsync();
    const exact = styles.find((s: any) => s.name === p.fontColorStyleName);
    const match = exact || styles.find((s: any) => s.name.toLowerCase().includes(p.fontColorStyleName!.toLowerCase()));
    if (match) {
      try { await textNode.setFillStyleIdAsync(match.id); return true; }
      catch (e: any) { hints.push(`fontColorStyleName '${p.fontColorStyleName}' failed: ${e.message}`); return false; }
    }
    hints.push(styleNotFoundHint("fontColorStyleName", p.fontColorStyleName, styles.map((s: any) => s.name)));
    return false;
  }

  // Direct color with auto-bind
  if (p.fontColor) {
    const fc = p.fontColor;
    textNode.fills = [makeSolid(fc)];
    const match = await suggestStyleForColor(fc, "fontColorStyleName");
    if (match.variable) {
      const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0] as SolidPaint, "color", match.variable);
      textNode.fills = [bound];
      hints.push(match.hint);
      return true;
    }
    if (match.paintStyleId) {
      try { await textNode.setFillStyleIdAsync(match.paintStyleId); hints.push(match.hint); return true; } catch {}
    }
    hints.push(match.hint);
    return false;
  }

  return false;
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
