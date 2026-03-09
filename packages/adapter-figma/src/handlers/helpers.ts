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

export async function batchHandler<TItem, TResult>(
  params: { items?: TItem[]; depth?: number } & Record<string, unknown>,
  fn: (item: TItem) => Promise<TResult>,
): Promise<BatchResult<TResult>> {
  const items = (params.items || [params]) as TItem[];
  const depth = params.depth;
  const commandId = (params as any).commandId;

  const useProgress = items.length > 3 && commandId;
  if (useProgress) sendBatchProgress(commandId, 0, items.length, "started");

  const results: Array<TResult | "ok" | { error: string }> = [];
  const warningSet = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    try {
      let result: any = await fn(items[i]);
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
    if (useProgress && (i + 1) % 3 === 0) {
      sendBatchProgress(commandId, i + 1, items.length, "in_progress");
    }
  }
  if (useProgress) sendBatchProgress(commandId, items.length, items.length, "completed");

  const out: BatchResult<TResult> = { results };
  if (warningSet.size > 0) {
    out.warnings = [...warningSet];
    // Only prompt action for actual problems, not informational auto-bind confirmations
    const hasActionable = out.warnings.some(w =>
      !w.startsWith("Auto-bound") && !w.startsWith("Bound ")
    );
    if (hasActionable) {
      out._action = "Fix these warnings before proceeding. Each warning describes the issue and the exact tool call to resolve it.";
    }
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
/**
 * Shared variable lookup logic. Searches by exact name, case-insensitive fallback,
 * then "CollectionName/VarName" slash-path fallback. Returns null if not found.
 */
async function resolveVariable(
  name: string,
  typeFilter?: VariableResolvedDataType,
  collectionName?: string,
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
    return resolveVariable(name.substring(slashIdx + 1), typeFilter, name.substring(0, slashIdx));
  }
  if (matches.length === 0) return null;
  if (collectionName) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const col = collections.find(c => c.name === collectionName) ||
                collections.find(c => c.name.toLowerCase() === collectionName.toLowerCase());
    if (!col) return null;
    return matches.find(v => v.variableCollectionId === col.id) || null;
  }
  if (matches.length > 1) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const colNames = matches.map(v => collections.find(c => c.id === v.variableCollectionId)?.name || "?");
    throw new Error(`Variable '${name}' exists in multiple collections: [${colNames.join(", ")}]. Use "CollectionName/${name}" to disambiguate.`);
  }
  return matches[0];
}

export async function findVariableByName(name: string, collectionName?: string): Promise<Variable | null> {
  return resolveVariable(name, undefined, collectionName);
}

export async function findColorVariableByName(name: string, collectionName?: string): Promise<Variable | null> {
  return resolveVariable(name, "COLOR", collectionName);
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

    // Collect all matching variables, then pick the best by scope
    let scopedMatch: any = null;
    let fallbackMatch: any = null;

    for (const v of colorVars) {
      const modeId = defaultModes.get(v.variableCollectionId);
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (!val || typeof val !== "object" || "type" in val) continue;
      if (!colorMatches(val as any)) continue;

      const scopes: string[] = (v as any).scopes || [];
      const isAllScopes = scopes.length === 0 || scopes.includes("ALL_SCOPES");

      if (bindingContext && !isAllScopes && scopes.includes(bindingContext)) {
        // Exact scope match — best pick
        scopedMatch = v;
        break;
      } else if (!fallbackMatch) {
        fallbackMatch = v;
      }
    }

    const best = scopedMatch || fallbackMatch;
    if (best) {
      return {
        hint: `Auto-bound color ${hex} → variable '${best.name}'.`,
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
    const match = await suggestStyleForColor(p.fillColor, "fillStyleName", "ALL_FILLS");
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
  p: { strokeVariableId?: string; strokeVariableName?: string; strokeStyleName?: string; strokeColor?: any; strokeWeight?: number | string;
       strokeTopWeight?: number | string; strokeBottomWeight?: number | string; strokeLeftWeight?: number | string; strokeRightWeight?: number | string },
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
    const match = await suggestStyleForColor(p.strokeColor, "strokeStyleName", "STROKE_COLOR");
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
  const swFields: Record<string, number | string | undefined> = {};
  for (const f of ["strokeWeight", "strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"] as const) {
    if ((p as any)[f] !== undefined && f in node) swFields[f] = (p as any)[f];
  }
  await applyTokens(node, swFields, hints);
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
    const match = await suggestStyleForColor(fc, "fontColorStyleName", "TEXT_FILL");
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
export async function applyCornerRadius(node: any, p: any, hints: string[]): Promise<void> {
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
    if (!bound) {
      hints.push(`Hardcoded cornerRadius. Use an existing FLOAT variable or create one with variables(method:"create"), then pass the variable name string instead of a number.`);
    }
  }
}

/**
 * Apply a token value (number or variable name string) to a node property.
 * Returns true if a variable was bound, false if hardcoded numeric.
 */
export async function applyToken(
  node: any, field: string, value: number | string, hints: string[],
): Promise<boolean> {
  const parsed = parseToken(value);
  if ("varName" in parsed) {
    await bindNumericVariable(node, field, parsed.varName, hints);
    return true;
  }
  node[field] = parsed.num;
  return false;
}

/**
 * Apply multiple token fields at once, emitting a single grouped warning
 * for any hardcoded values. Skips undefined values.
 */
export async function applyTokens(
  node: any, fields: Record<string, number | string | undefined>, hints: string[],
): Promise<void> {
  const hardcoded: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    if (value !== undefined) {
      const bound = await applyToken(node, field, value, hints);
      if (!bound) hardcoded.push(field);
    }
  }
  if (hardcoded.length > 0) {
    hints.push(`Hardcoded ${hardcoded.join(", ")}. Use an existing FLOAT variable or create one with variables(method:"create"), then pass the variable name string instead of a number.`);
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
  hints: string[],
): Promise<boolean> {
  const v = await findVariableByName(variableName);
  if (!v) {
    const floatVars = await figma.variables.getLocalVariablesAsync("FLOAT");
    const names = floatVars.map(v => v.name).slice(0, 20);
    hints.push(`Variable '${variableName}' not found. Available FLOAT variables: [${names.join(", ")}]`);
    return false;
  }
  if (v.resolvedType !== "FLOAT") {
    hints.push(`Variable '${variableName}' is ${v.resolvedType}, expected FLOAT.`);
    return false;
  }
  const fieldList = Array.isArray(fields) ? fields : [fields];
  for (const f of fieldList) {
    node.setBoundVariable(f, v);
  }
  const label = fieldList.length > 1 ? fieldList[0].replace(/^topLeftRadius$/, "cornerRadius") : fieldList[0];
  hints.push(`Bound ${label} → variable '${v.name}'.`);
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
): Promise<string> {
  const styles = await figma.getLocalTextStylesAsync();
  const matching = styles.filter(s => s.fontSize === fontSize);
  if (matching.length > 0) {
    const names = matching.map(s => s.name).slice(0, 5);
    return `Manual font (${fontSize}px / ${fontWeight}w) — text styles at same size: [${names.join(", ")}]. Use textStyleName to link to a design token.`;
  }
  return `Manual font (${fontSize}px / ${fontWeight}w) has no text style. Create one with styles(method: "create", type: "text"), then use textStyleName for design token consistency.`;
}
