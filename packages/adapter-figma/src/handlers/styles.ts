import { batchHandler } from "./helpers";
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
  paint: "PAINT", text: "TEXT", effect: "EFFECT",
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
  } else if (style.type === "EFFECT") {
    r.effects = (style as EffectStyle).effects;
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
  if (!typeFilter)                            fetchers.push(figma.getLocalGridStylesAsync());

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
  const style = await figma.getStyleByIdAsync(ensureStyleId(p.id));
  if (!style) throw new Error(`Style not found: ${p.id}`);
  style.remove();
  return "ok";
}

async function createPaintStyleSingle(p: any) {
  const style = figma.createPaintStyle();
  style.name = p.name;
  const { r, g, b, a = 1 } = p.color;
  style.paints = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
  return { id: style.id };
}

async function createTextStyleSingle(p: any) {
  const style = figma.createTextStyle();
  style.name = p.name;
  const fontStyle = p.fontStyle || "Regular";
  // Font already preloaded by batch prep
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

  // WCAG recommendations for text styles
  const result: any = { id: style.id };
  const hints: string[] = [];
  if (p.fontSize < 12) {
    hints.push("WCAG: Min 12px text recommended.");
  }
  if (p.lineHeight !== undefined && p.lineHeight !== "AUTO") {
    let lhPx: number | null = null;
    if (typeof p.lineHeight === "number") lhPx = p.lineHeight;
    else if (p.lineHeight.unit === "PIXELS") lhPx = p.lineHeight.value;
    else if (p.lineHeight.unit === "PERCENT") lhPx = (p.lineHeight.value / 100) * p.fontSize;
    if (lhPx !== null && lhPx / p.fontSize < 1.5) {
      hints.push(`WCAG: Line height ${Math.ceil(p.fontSize * 1.5)}px (1.5x) recommended.`);
    }
  }
  if (hints.length > 0) result.warning = hints.join(" ");

  return result;
}

async function createEffectStyleSingle(p: any) {
  const style = figma.createEffectStyle();
  style.name = p.name;
  style.effects = p.effects.map((e: any) => {
    const eff: any = { type: e.type, radius: e.radius, visible: e.visible ?? true };
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
    if (e.color) eff.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a ?? 1 };
    if (e.offset) eff.offset = { x: e.offset.x, y: e.offset.y };
    if (e.spread !== undefined) eff.spread = e.spread;
    return eff;
  });
  return { id: style.id };
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
  const [paints, texts, effects] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
  ]);
  const all = [...paints, ...texts, ...effects];
  const exact = all.find(s => s.name === idOrName);
  if (exact) return exact;
  const fuzzy = all.find(s => s.name.toLowerCase().includes(idOrName.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Style not found: '${idOrName}'`);
}

// ─── Patch Styles Handler ────────────────────────────────────────

// Fields applicable to each style type (excluding shared fields: id, name)
const PAINT_FIELDS = ["color"];
const TEXT_FIELDS = ["fontFamily", "fontStyle", "fontSize", "lineHeight", "letterSpacing", "textCase", "textDecoration"];
const EFFECT_FIELDS = ["effects"];
const TYPE_FIELDS: Record<string, string[]> = { PAINT: PAINT_FIELDS, TEXT: TEXT_FIELDS, EFFECT: EFFECT_FIELDS };

async function patchStyleSingle(p: any) {
  const style = await resolveAnyStyle(p.id);
  if (p.name !== undefined) style.name = p.name;

  // Warn about inapplicable fields
  const applicable = TYPE_FIELDS[style.type] || [];
  const allTypeFields = [...PAINT_FIELDS, ...TEXT_FIELDS, ...EFFECT_FIELDS];
  const ignored = allTypeFields.filter(f => p[f] !== undefined && !applicable.includes(f));

  if (style.type === "PAINT") {
    const ps = style as PaintStyle;
    if (p.color !== undefined) {
      const { r, g, b, a = 1 } = p.color;
      ps.paints = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
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
  } else if (style.type === "EFFECT") {
    const es = style as EffectStyle;
    if (p.effects !== undefined) {
      es.effects = p.effects.map((e: any) => {
        const eff: any = { type: e.type, radius: e.radius, visible: e.visible ?? true };
        if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
        if (e.color) eff.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a ?? 1 };
        if (e.offset) eff.offset = { x: e.offset.x, y: e.offset.y };
        if (e.spread !== undefined) eff.spread = e.spread;
        return eff;
      });
    }
  }

  // Collect warnings
  const hints: string[] = [];
  if (ignored.length > 0) {
    hints.push(`${ignored.join(", ")} not applicable for ${style.type} style, ignored.`);
  }

  // WCAG recommendations for text styles
  if (style.type === "TEXT") {
    const ts = style as TextStyle;
    if (ts.fontSize < 12) hints.push("WCAG: Min 12px text recommended.");
    const lh = ts.lineHeight as any;
    if (lh && lh.unit !== "AUTO") {
      let lhPx: number | null = null;
      if (lh.unit === "PIXELS") lhPx = lh.value;
      else if (lh.unit === "PERCENT") lhPx = (lh.value / 100) * ts.fontSize;
      if (lhPx !== null && lhPx / ts.fontSize < 1.5) {
        hints.push(`WCAG: Line height ${Math.ceil(ts.fontSize * 1.5)}px (1.5x) recommended.`);
      }
    }
  }

  if (hints.length > 0) return { warning: hints.join(" ") };
  return "ok";
}

// Max unique fonts to load per batch -- prevents timeouts with many font families
const MAX_FONTS_PER_BATCH = 5;

// Batch prep: preload fonts in parallel, cap unique fonts to avoid timeout
async function createTextStyleBatch(params: any) {
  const items: any[] = params.items || [params];

  // Map each item to its font key
  const itemFontKeys = items.map(p => `${p.fontFamily}::${p.fontStyle || "Regular"}`);
  const uniqueFonts = [...new Set(itemFontKeys)];

  // If within cap, process all
  if (uniqueFonts.length <= MAX_FONTS_PER_BATCH) {
    await Promise.all(
      uniqueFonts.map(key => {
        const [family, style] = key.split("::");
        return figma.loadFontAsync({ family, style });
      })
    );
    return batchHandler(params, createTextStyleSingle);
  }

  // Over cap: process items whose fonts fit, return remaining
  const loadedFonts = new Set(uniqueFonts.slice(0, MAX_FONTS_PER_BATCH));
  await Promise.all(
    [...loadedFonts].map(key => {
      const [family, style] = key.split("::");
      return figma.loadFontAsync({ family, style });
    })
  );

  const processItems: any[] = [];
  const deferredItems: any[] = [];
  for (let i = 0; i < items.length; i++) {
    if (loadedFonts.has(itemFontKeys[i])) processItems.push(items[i]);
    else deferredItems.push(items[i]);
  }

  const deferredFonts = uniqueFonts.slice(MAX_FONTS_PER_BATCH).map(k => k.replace("::", " "));
  const result = await batchHandler({ ...params, items: processItems }, createTextStyleSingle);
  result.deferred = `${deferredItems.length} text style(s) using fonts [${deferredFonts.join(", ")}] were NOT created to avoid timeout. Call styles(method: "create", type: "text") again with those items.`;
  return result;
}

async function patchStylesBatch(params: any) {
  const items: any[] = params.items || [params];

  // Resolve styles and collect font requirements for text styles
  // Errors here are non-fatal -- batchHandler will catch them per-item
  const fontKeys: string[] = [];
  for (const p of items) {
    try {
      const style = await resolveAnyStyle(p.id);
      if (style.type === "TEXT") {
        const ts = style as TextStyle;
        const family = p.fontFamily ?? ts.fontName.family;
        const fontStyle = p.fontStyle ?? ts.fontName.style;
        fontKeys.push(`${family}::${fontStyle}`);
      }
    } catch { /* skip -- will error in batchHandler */ }
  }

  // Preload fonts for text styles
  const uniqueFonts = [...new Set(fontKeys)];
  if (uniqueFonts.length > 0) {
    const toLoad = uniqueFonts.slice(0, MAX_FONTS_PER_BATCH);
    await Promise.all(
      toLoad.map(key => {
        const [family, style] = key.split("::");
        return figma.loadFontAsync({ family, style });
      })
    );

    if (uniqueFonts.length > MAX_FONTS_PER_BATCH) {
      // Identify which items have unloaded fonts and defer them
      const loadedSet = new Set(toLoad);
      const processItems: any[] = [];
      const deferredItems: any[] = [];
      let fontIdx = 0;
      for (const p of items) {
        try {
          const style = await resolveAnyStyle(p.id);
          if (style.type === "TEXT") {
            if (loadedSet.has(fontKeys[fontIdx])) processItems.push(p);
            else deferredItems.push(p);
            fontIdx++;
          } else {
            processItems.push(p);
          }
        } catch {
          processItems.push(p); // let batchHandler report per-item error
        }
      }
      const deferredFonts = uniqueFonts.slice(MAX_FONTS_PER_BATCH).map(k => k.replace("::", " "));
      const result = await batchHandler({ ...params, items: processItems }, patchStyleSingle);
      result.deferred = `${deferredItems.length} text style(s) using fonts [${deferredFonts.join(", ")}] were NOT updated to avoid timeout. Call styles(method: "update") again with those items.`;
      return result;
    }
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
        default: throw new Error(`create requires type: "paint", "text", or "effect"`);
      }
    },
    get:    (p: StyleParams & { method: "get" })    => getStyleByIdFigma(p),
    list:   (p: StyleParams & { method: "list" })   => listStylesFigma(p),
    update: (p: StyleParams & { method: "update" }) => patchStylesBatch(p),
    delete: (p: StyleParams & { method: "delete" }) => batchHandler(p, removeStyleSingle),
  }),
};
