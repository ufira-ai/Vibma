import { batchHandler, coerceColor, findColorVariableByName, suggestStyleForColor, type Hint } from "./helpers";
import { resolveFontAsync, clearFontCache } from "./create-text";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";
import type { ListResponse } from "@ufira/vibma/endpoint";

// ─── TypeScript Types ────────────────────────────────────────────

interface PaintStyleItem  { name: string; color: { r: number; g: number; b: number; a?: number } }
interface TextStyleItem   { name: string; fontFamily: string; fontStyle?: string; fontSize: number; lineHeight?: any; letterSpacing?: any; textCase?: string; textDecoration?: string }
interface EffectStyleItem  { name: string; effects: any[] }
interface PatchPaintItem  { id: string; name?: string; color?: { r: number; g: number; b: number; a?: number } }
interface PatchTextItem   { id: string; name?: string; fontFamily?: string; fontStyle?: string; fontSize?: number; lineHeight?: any; letterSpacing?: any; textCase?: string; textDecoration?: string }
interface PatchEffectItem  { id: string; name?: string; effects?: any[] }
interface PatchAnyItem    { id: string; name?: string; color?: any; fontFamily?: string; fontStyle?: string; fontSize?: number; lineHeight?: any; letterSpacing?: any; textCase?: string; textDecoration?: string; effects?: any[] }

type StyleParams =
  | { method: "create"; type: "paint";  items: PaintStyleItem[];  depth?: number }
  | { method: "create"; type: "text";   items: TextStyleItem[];   depth?: number }
  | { method: "create"; type: "effect"; items: EffectStyleItem[]; depth?: number }
  | { method: "get";    id: string; fields?: string[] }
  | { method: "list";   type?: "paint" | "text" | "effect"; fields?: string[]; offset?: number; limit?: number }
  | { method: "update"; type: "paint";  items: PatchPaintItem[] }
  | { method: "update"; type: "text";   items: PatchTextItem[] }
  | { method: "update"; type: "effect"; items: PatchEffectItem[] }
  | { method: "update"; items: PatchAnyItem[] }   // type omitted -- permissive
  | { method: "delete"; id?: string; items?: Array<{ id: string }> };

// ─── Figma Handlers ──────────────────────────────────────────────

/** Ensure Figma-internal trailing comma is present for API lookups.
 *  Accepts both raw (S:hex,) and stripped (S:hex) formats for backward compat. */
function ensureStyleId(id: string): string {
  return id.startsWith("S:") && !id.endsWith(",") ? id + "," : id;
}

const TYPE_FILTER_MAP: Record<string, string> = {
  paint: "PAINT", text: "TEXT", effect: "EFFECT", grid: "GRID",
};

function rgbaToHex(color: any): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? Math.round(color.a * 255) : 255;
  if (a === 255) return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
  return `#${[r, g, b, a].map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Serialize a Figma BaseStyle to a plain object. Shared by get and list. */
function serializeStyle(style: BaseStyle): Record<string, any> {
  const r: any = { id: style.id, name: style.name, type: style.type };
  if (style.description) r.description = style.description;
  if (style.type === "PAINT") {
    r.paints = (style as PaintStyle).paints.map((p: any) => {
      const paint = { ...p };
      if (paint.color) paint.color = rgbaToHex(paint.color);
      return paint;
    });
  } else if (style.type === "TEXT") {
    const ts = style as TextStyle;
    r.fontSize = ts.fontSize; r.fontName = ts.fontName;
    r.letterSpacing = ts.letterSpacing; r.lineHeight = ts.lineHeight;
    r.textCase = ts.textCase; r.textDecoration = ts.textDecoration;
    r.paragraphIndent = ts.paragraphIndent; r.paragraphSpacing = ts.paragraphSpacing;
    if ("leadingTrim" in ts) r.leadingTrim = (ts as any).leadingTrim;
  } else if (style.type === "EFFECT") {
    r.effects = (style as EffectStyle).effects;
  } else if (style.type === "GRID") {
    r.layoutGrids = (style as GridStyle).layoutGrids;
  }
  return r;
}

async function listStylesFigma(params: StyleParams & { method: "list" }): Promise<ListResponse<any>> {
  const typeFilter = params.type ? TYPE_FILTER_MAP[params.type] : null;

  // Fetch only the requested type, or all
  const fetchers: Array<Promise<BaseStyle[]>> = [];
  if (!typeFilter || typeFilter === "PAINT")  fetchers.push(figma.getLocalPaintStylesAsync());
  if (!typeFilter || typeFilter === "TEXT")   fetchers.push(figma.getLocalTextStylesAsync());
  if (!typeFilter || typeFilter === "EFFECT") fetchers.push(figma.getLocalEffectStylesAsync());
  if (!typeFilter || typeFilter === "GRID")   fetchers.push(figma.getLocalGridStylesAsync());

  const groups = await Promise.all(fetchers);
  const allStyles = groups.flat();

  // Paginate first, then serialize only the page
  const paged = paginate(allStyles, params.offset, params.limit);
  const fields = params.fields;
  const items = paged.items.map(s => {
    const full = serializeStyle(s);
    // Stubs by default; fields to request more; ["*"] for everything
    if (!fields?.length) return pickFields(full, []);
    return pickFields(full, fields);
  });

  return { ...paged, items };
}

async function getStyleByIdFigma(params: any) {
  const style = await figma.getStyleByIdAsync(ensureStyleId(params.id));
  if (!style) throw new Error(`Style not found: ${params.id}`);
  return serializeStyle(style);
}

async function removeStyleSingle(p: any) {
  const identifier = p.id || p.styleName; // styleName kept for backward compat
  if (!identifier) throw new Error("Each item requires 'id' (accepts ID or name).");
  const style = await resolveAnyStyle(identifier);
  style.remove();
  return "ok";
}

async function createPaintStyleSingle(p: any) {
  const c = coerceColor(p.color);
  if (!c) throw new Error(`Invalid color for paint style "${p.name}": ${JSON.stringify(p.color)}`);
  const style = figma.createPaintStyle();
  style.name = p.name;
  if (p.description) style.description = p.description;
  style.paints = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
  const result: any = { id: style.id };
  if (p.colorVariableName) {
    const v = await findColorVariableByName(p.colorVariableName);
    if (v) {
      const bound = figma.variables.setBoundVariableForPaint(style.paints[0] as SolidPaint, "color", v);
      style.paints = [bound];
      result.boundVariable = v.name;
    } else {
      style.remove();
      const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
      const names = colorVars.map(v => v.name).slice(0, 20);
      throw new Error(`colorVariableName '${p.colorVariableName}' not found. Available: [${names.join(", ")}]`);
    }
  } else {
    // Auto-bind: find matching color variable
    const match = await suggestStyleForColor(c, "colorVariableName", "ALL_FILLS");
    if (match.variable) {
      const bound = figma.variables.setBoundVariableForPaint(style.paints[0] as SolidPaint, "color", match.variable);
      style.paints = [bound];
      result.boundVariable = match.variable.name;
    }
  }
  return result;
}

async function createTextStyleSingle(p: any) {
  const style = figma.createTextStyle();
  style.name = p.name;
  if (p.description) style.description = p.description;
  // Font already resolved + preloaded by batch prep; use stored resolved name
  const fontStyle = p._resolvedFontStyle ?? p.fontStyle ?? "Regular";
  style.fontName = { family: p.fontFamily, style: fontStyle };
  style.fontSize = p.fontSize;
  if (p.lineHeight !== undefined) {
    if (typeof p.lineHeight === "number") style.lineHeight = { value: p.lineHeight, unit: "PIXELS" };
    else if (p.lineHeight.unit === "AUTO") style.lineHeight = { unit: "AUTO" };
    else style.lineHeight = { value: p.lineHeight.value, unit: p.lineHeight.unit };
  }
  if (p.letterSpacing !== undefined) {
    if (typeof p.letterSpacing === "number") style.letterSpacing = { value: p.letterSpacing, unit: "PIXELS" };
    else style.letterSpacing = { value: p.letterSpacing.value, unit: p.letterSpacing.unit };
  }
  if (p.textCase) style.textCase = p.textCase;
  if (p.textDecoration) style.textDecoration = p.textDecoration;
  if (p.paragraphIndent !== undefined) style.paragraphIndent = p.paragraphIndent;
  if (p.paragraphSpacing !== undefined) style.paragraphSpacing = p.paragraphSpacing;
  if (p.leadingTrim !== undefined) (style as any).leadingTrim = p.leadingTrim;

  // WCAG recommendations for text styles
  const result: any = { id: style.id };
  const hints: Hint[] = [];
  if (p.fontSize < 12) {
    hints.push({ type: "warn", message: "WCAG: Min 12px text recommended." });
  }
  if (p.lineHeight !== undefined && p.lineHeight !== "AUTO") {
    let lhPx: number | null = null;
    if (typeof p.lineHeight === "number") lhPx = p.lineHeight;
    else if (p.lineHeight.unit === "PIXELS") lhPx = p.lineHeight.value;
    else if (p.lineHeight.unit === "PERCENT") lhPx = (p.lineHeight.value / 100) * p.fontSize;
    if (lhPx !== null && lhPx / p.fontSize < 1.5) {
      hints.push({ type: "warn", message: `WCAG: Line height ${Math.ceil(p.fontSize * 1.5)}px (1.5x) recommended.` });
    }
  }
  if (hints.length > 0) result.hints = hints;

  return result;
}

async function createEffectStyleSingle(p: any) {
  const effects = mapEffects(p.effects);
  const style = figma.createEffectStyle();
  style.name = p.name;
  if (p.description) style.description = p.description;
  style.effects = effects;
  return { id: style.id };
}

async function createGridStyleSingle(p: any) {
  const style = figma.createGridStyle();
  style.name = p.name;
  if (p.description) style.description = p.description;
  style.layoutGrids = p.layoutGrids;
  return { id: style.id };
}

/** Map effect descriptors to Figma Effect objects, coercing hex color strings. */
function mapEffects(effects: any[]): any[] {
  return effects.map((e: any) => {
    const eff: any = { type: e.type, radius: e.radius, visible: e.visible ?? true };
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
    if (e.color) {
      const c = coerceColor(e.color);
      if (c) eff.color = c;
    }
    if (e.offset) eff.offset = { x: e.offset.x ?? 0, y: e.offset.y ?? 0 };
    if (e.spread !== undefined) eff.spread = e.spread;
    return eff;
  });
}

// ─── Style Resolution Helpers ────────────────────────────────────

async function resolvePaintStyle(idOrName: string): Promise<PaintStyle> {
  // Try by ID first
  const byId = await figma.getStyleByIdAsync(ensureStyleId(idOrName));
  if (byId?.type === "PAINT") return byId as PaintStyle;
  // Fallback to name search
  const all = await figma.getLocalPaintStylesAsync();
  const exact = all.find(s => s.name === idOrName);
  if (exact) return exact;
  const fuzzy = all.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Paint style not found: '${idOrName}'`);
}

async function resolveTextStyle(idOrName: string): Promise<TextStyle> {
  const byId = await figma.getStyleByIdAsync(ensureStyleId(idOrName));
  if (byId?.type === "TEXT") return byId as TextStyle;
  const all = await figma.getLocalTextStylesAsync();
  const exact = all.find(s => s.name === idOrName);
  if (exact) return exact;
  const fuzzy = all.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Text style not found: '${idOrName}'`);
}

async function resolveEffectStyle(idOrName: string): Promise<EffectStyle> {
  const byId = await figma.getStyleByIdAsync(ensureStyleId(idOrName));
  if (byId?.type === "EFFECT") return byId as EffectStyle;
  const all = await figma.getLocalEffectStylesAsync();
  const exact = all.find(s => s.name === idOrName);
  if (exact) return exact;
  const fuzzy = all.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Effect style not found: '${idOrName}'`);
}

/** Resolve any style by ID or name -- tries all types. */
async function resolveAnyStyle(idOrName: string): Promise<BaseStyle> {
  const byId = await figma.getStyleByIdAsync(ensureStyleId(idOrName));
  if (byId) return byId;
  // Fallback: search by name across all types
  const [paints, texts, effects, grids] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync(),
  ]);
  const all = [...paints, ...texts, ...effects, ...grids];
  const exact = all.find(s => s.name === idOrName);
  if (exact) return exact;
  const fuzzy = all.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Style not found: '${idOrName}'`);
}

// ─── Patch Styles Handler ────────────────────────────────────────

// Fields applicable to each style type (excluding shared fields: id, name)
const PAINT_FIELDS = ["color", "colorVariableName"];
const TEXT_FIELDS = ["fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration", "paragraphIndent", "paragraphSpacing", "leadingTrim"];
const EFFECT_FIELDS = ["effects"];
const GRID_FIELDS = ["layoutGrids"];
const TYPE_FIELDS: Record<string, string[]> = { PAINT: PAINT_FIELDS, TEXT: TEXT_FIELDS, EFFECT: EFFECT_FIELDS, GRID: GRID_FIELDS };

async function patchStyleSingle(p: any) {
  const identifier = p.id || p.styleName; // styleName kept for backward compat
  if (!identifier) throw new Error("Each item requires 'id' (accepts ID or name).");
  const style = await resolveAnyStyle(identifier);
  if (p.name !== undefined) style.name = p.name;
  if (p.description !== undefined) style.description = p.description;

  // Warn about inapplicable fields
  const applicable = TYPE_FIELDS[style.type] || [];
  const allTypeFields = [...PAINT_FIELDS, ...TEXT_FIELDS, ...EFFECT_FIELDS, ...GRID_FIELDS];
  const ignored = allTypeFields.filter(f => p[f] !== undefined && !applicable.includes(f));

  if (style.type === "PAINT") {
    const ps = style as PaintStyle;
    if (p.color !== undefined || p.colorVariableName !== undefined) {
      const c = p.color ? coerceColor(p.color) : null;
      ps.paints = [{ type: "SOLID", color: c ? { r: c.r, g: c.g, b: c.b } : (ps.paints[0] as SolidPaint)?.color ?? { r: 0, g: 0, b: 0 }, opacity: c?.a ?? 1 }];
      if (p.colorVariableName) {
        const v = await findColorVariableByName(p.colorVariableName);
        if (v) {
          const bound = figma.variables.setBoundVariableForPaint(ps.paints[0] as SolidPaint, "color", v);
          ps.paints = [bound];
        } else {
          const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
          const names = colorVars.map(v => v.name).slice(0, 20);
          throw new Error(`colorVariableName '${p.colorVariableName}' not found. Available: [${names.join(", ")}]`);
        }
      } else if (c) {
        // Auto-bind: find matching color variable
        const match = await suggestStyleForColor(c, "colorVariableName", "ALL_FILLS");
        if (match.variable) {
          const bound = figma.variables.setBoundVariableForPaint(ps.paints[0] as SolidPaint, "color", match.variable);
          ps.paints = [bound];
        }
      }
    }
  } else if (style.type === "TEXT") {
    const ts = style as TextStyle;
    // Font already preloaded by batch prep
    const newFamily = p.fontFamily ?? ts.fontName.family;
    const newFontStyle = p.fontStyle ?? ts.fontName.style;
    if (p.fontFamily !== undefined || p.fontStyle !== undefined) {
      ts.fontName = { family: newFamily, style: newFontStyle };
    }
    if (p.fontSize !== undefined) ts.fontSize = p.fontSize;
    if (p.lineHeight !== undefined) {
      if (typeof p.lineHeight === "number") ts.lineHeight = { value: p.lineHeight, unit: "PIXELS" };
      else if (p.lineHeight.unit === "AUTO") ts.lineHeight = { unit: "AUTO" };
      else ts.lineHeight = { value: p.lineHeight.value, unit: p.lineHeight.unit };
    }
    if (p.letterSpacing !== undefined) {
      if (typeof p.letterSpacing === "number") ts.letterSpacing = { value: p.letterSpacing, unit: "PIXELS" };
      else ts.letterSpacing = { value: p.letterSpacing.value, unit: p.letterSpacing.unit };
    }
    if (p.textCase !== undefined) ts.textCase = p.textCase;
    if (p.textDecoration !== undefined) ts.textDecoration = p.textDecoration;
    if (p.paragraphIndent !== undefined) ts.paragraphIndent = p.paragraphIndent;
    if (p.paragraphSpacing !== undefined) ts.paragraphSpacing = p.paragraphSpacing;
    if (p.leadingTrim !== undefined) (ts as any).leadingTrim = p.leadingTrim;
  } else if (style.type === "EFFECT") {
    const es = style as EffectStyle;
    if (p.effects !== undefined) {
      es.effects = mapEffects(p.effects);
    }
  } else if (style.type === "GRID") {
    const gs = style as GridStyle;
    if (p.layoutGrids !== undefined) gs.layoutGrids = p.layoutGrids;
  }

  // Collect warnings
  const hints: Hint[] = [];
  if (ignored.length > 0) {
    hints.push({ type: "warn", message: `${ignored.join(", ")} not applicable for ${style.type} style, ignored.` });
  }

  // WCAG recommendations for text styles
  if (style.type === "TEXT") {
    const ts = style as TextStyle;
    if (ts.fontSize < 12) hints.push({ type: "warn", message: "WCAG: Min 12px text recommended." });
    const lh = ts.lineHeight as any;
    if (lh && lh.unit !== "AUTO") {
      let lhPx: number | null = null;
      if (lh.unit === "PIXELS") lhPx = lh.value;
      else if (lh.unit === "PERCENT") lhPx = (lh.value / 100) * ts.fontSize;
      if (lhPx !== null && lhPx / ts.fontSize < 1.5) {
        hints.push({ type: "warn", message: `WCAG: Line height ${Math.ceil(ts.fontSize * 1.5)}px (1.5x) recommended.` });
      }
    }
  }

  if (hints.length > 0) return { hints };
  return "ok";
}

// Batch prep: preload fonts via fuzzy resolution
async function createTextStyleBatch(params: any) {
  clearFontCache();
  const items: any[] = params.items || [params];

  // Resolve all fonts with fuzzy matching and store resolved names on items
  const resolved = new Map<string, string>();
  for (const p of items) {
    const family = p.fontFamily;
    const style = p.fontStyle || "Regular";
    const key = `${family}::${style}`;
    if (!resolved.has(key)) {
      const font = await resolveFontAsync(family, style);
      resolved.set(key, font.style);
    }
    p._resolvedFontStyle = resolved.get(key);
  }

  return batchHandler(params, createTextStyleSingle);
}

async function patchStylesBatch(params: any) {
  clearFontCache();
  const items: any[] = params.items || [params];

  // Resolve fonts for text styles via fuzzy matching and store on items
  for (const p of items) {
    try {
      const style = await resolveAnyStyle(p.id || p.styleName);
      if (style.type === "TEXT") {
        const ts = style as TextStyle;
        const family = p.fontFamily ?? ts.fontName.family;
        const fontStyle = p.fontStyle ?? ts.fontName.style;
        const resolved = await resolveFontAsync(family, fontStyle);
        // Store resolved values so patchStyleSingle uses the correct names
        if (p.fontFamily !== undefined || p.fontStyle !== undefined) {
          if (p.fontFamily !== undefined) p.fontFamily = resolved.family;
          p.fontStyle = resolved.style;
        }
      }
    } catch { /* skip -- will error in batchHandler */ }
  }

  return batchHandler(params, patchStyleSingle);
}

// ─── Figma Dispatcher ────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  styles: createDispatcher({
    create: (p: StyleParams & { method: "create" }) => {
      switch (p.type) {
        case "paint":  return batchHandler(p, createPaintStyleSingle);
        case "text":   return createTextStyleBatch(p);
        case "effect": return batchHandler(p, createEffectStyleSingle);
        case "grid":   return batchHandler(p, createGridStyleSingle);
        default: throw new Error(`create requires type: "paint", "text", "effect", or "grid"`);
      }
    },
    get:    (p: StyleParams & { method: "get" })    => getStyleByIdFigma(p),
    list:   (p: StyleParams & { method: "list" })   => listStylesFigma(p),
    update: (p: StyleParams & { method: "update" }) => patchStylesBatch(p),
    delete: (p: StyleParams & { method: "delete" }) => batchHandler(p, removeStyleSingle),
  }),
};
