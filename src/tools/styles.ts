import { z } from "zod";
import { flexJson, flexBool, flexNum } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";
import type { IdResult, IdWithWarningResult, ApplyStyleItemResult, GetStylesResult, GetStyleByIdResult } from "./response-types";


// ─── Schemas ─────────────────────────────────────────────────────

const paintStyleItem = z.object({
  name: z.string().describe("Style name"),
  color: flexJson(S.colorRgba).describe('Color.'),
});

const textStyleItem = z.object({
  name: z.string().describe("Style name"),
  fontFamily: z.string().describe("Font family"),
  fontStyle: z.string().optional().describe("Font style (default: Regular)"),
  fontSize: z.coerce.number().describe("Font size"),
  lineHeight: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
  ])).optional().describe("Line height — number (px) or {value, unit}. Default: auto."),
  letterSpacing: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
  ])).optional().describe("Letter spacing — number (px) or {value, unit}. Default: 0."),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
});

const effectStyleItem = z.object({
  name: z.string().describe("Style name"),
  effects: flexJson(z.array(S.effectEntry)).describe("Array of effects"),
});

const patchStyleItem = z.object({
  id: z.string().describe("Style ID or name (case-insensitive match)"),
  name: z.string().optional().describe("Rename the style"),
  // Paint fields
  color: flexJson(S.colorRgba).optional().describe('New color (paint styles).'),
  // Text fields
  fontFamily: z.string().optional().describe("Font family (text styles)"),
  fontStyle: z.string().optional().describe("Font style, e.g. Regular, Bold (text styles)"),
  fontSize: z.coerce.number().optional().describe("Font size (text styles)"),
  lineHeight: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
  ])).optional().describe("Line height — number (px) or {value, unit} (text styles)"),
  letterSpacing: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
  ])).optional().describe("Letter spacing — number (px) or {value, unit} (text styles)"),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
  // Effect fields
  effects: flexJson(z.array(S.effectEntry)).optional().describe("Array of effects (effect styles)"),
});

const applyStyleItem = z.object({
  nodeId: S.nodeId,
  styleId: z.string().optional().describe("Style ID. Provide either styleId or styleName."),
  styleName: z.string().optional().describe("Style name (case-insensitive substring match). Provide either styleId or styleName."),
  styleType: z.preprocess((v) => typeof v === "string" ? v.toLowerCase() : v, z.enum(["fill", "stroke", "text", "effect"])).describe("Type of style: fill, stroke, text, or effect (case-insensitive)"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "get_styles",
    "List local styles (paint, text, effect, grid). Returns IDs and names only.",
    {},
    async () => {
      try { return mcpJson(await sendCommand("get_styles")); }
      catch (e) { return mcpError("Error getting styles", e); }
    }
  );

  server.tool(
    "get_style_by_id",
    "Get detailed style info by ID. Returns full paint/font/effect/grid details.",
    { styleId: z.string().describe("Style ID") },
    async ({ styleId }: any) => {
      try { return mcpJson(await sendCommand("get_style_by_id", { styleId })); }
      catch (e) { return mcpError("Error getting style", e); }
    }
  );

  server.tool(
    "remove_style",
    "Delete a style by ID.",
    { styleId: z.string().describe("Style ID to remove") },
    async ({ styleId }: any) => {
      try { return mcpJson(await sendCommand("remove_style", { styleId })); }
      catch (e) { return mcpError("Error removing style", e); }
    }
  );

  server.tool(
    "create_paint_style",
    "Create color/paint styles. Batch: pass multiple items.",
    { items: flexJson(z.array(paintStyleItem)).describe("Array of {name, color}") },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_paint_style", params)); }
      catch (e) { return mcpError("Error creating paint style", e); }
    }
  );

  server.tool(
    "create_text_style",
    "Create text styles. Batch: pass multiple items.",
    { items: flexJson(z.array(textStyleItem)).describe("Array of text style definitions") },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_text_style", params)); }
      catch (e) { return mcpError("Error creating text style", e); }
    }
  );

  server.tool(
    "create_effect_style",
    "Create effect styles (shadows, blurs). Batch: pass multiple items.",
    { items: flexJson(z.array(effectStyleItem)).describe("Array of {name, effects}") },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_effect_style", params)); }
      catch (e) { return mcpError("Error creating effect style", e); }
    }
  );

  server.tool(
    "apply_style_to_node",
    "Apply a style to nodes by ID or name. Use styleName for convenience (case-insensitive). Batch: pass multiple items.",
    { items: flexJson(z.array(applyStyleItem)).describe("Array of {nodeId, styleId?, styleName?, styleType}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("apply_style_to_node", params)); }
      catch (e) { return mcpError("Error applying style", e); }
    }
  );

  server.tool(
    "patch_styles",
    "Update any style (paint/text/effect) by ID or name. Returns full updated style data. Type is auto-detected. Batch: pass multiple items.",
    { items: flexJson(z.array(patchStyleItem)).describe("Array of {id, name?, color?, fontFamily?, effects?, ...}") },
    async (params: any) => {
      try { return mcpJson(await sendCommand("patch_styles", params)); }
      catch (e) { return mcpError("Error patching styles", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

/** Ensure Figma-internal trailing comma is present for API lookups.
 *  Accepts both raw (S:hex,) and stripped (S:hex) formats for backward compat. */
function ensureStyleId(id: string): string {
  return id.startsWith("S:") && !id.endsWith(",") ? id + "," : id;
}

async function getStylesFigma(): Promise<GetStylesResult> {
  const [colors, texts, effects, grids] = await Promise.all([
    figma.getLocalPaintStylesAsync(),
    figma.getLocalTextStylesAsync(),
    figma.getLocalEffectStylesAsync(),
    figma.getLocalGridStylesAsync(),
  ]);
  return {
    colors: colors.map(s => ({ id: s.id, name: s.name })),
    texts: texts.map(s => ({ id: s.id, name: s.name })),
    effects: effects.map(s => ({ id: s.id, name: s.name })),
    grids: grids.map(s => ({ id: s.id, name: s.name })),
  };
}

function rgbaToHex(color: any): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? Math.round(color.a * 255) : 255;
  if (a === 255) return `#${[r, g, b].map(x => x.toString(16).padStart(2, "0")).join("")}`;
  return `#${[r, g, b, a].map(x => x.toString(16).padStart(2, "0")).join("")}`;
}

async function getStyleByIdFigma(params: any): Promise<GetStyleByIdResult> {
  const style = await figma.getStyleByIdAsync(ensureStyleId(params.styleId));
  if (!style) throw new Error(`Style not found: ${params.styleId}`);
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

async function removeStyleFigma(params: any) {
  const style = await figma.getStyleByIdAsync(ensureStyleId(params.styleId));
  if (!style) throw new Error(`Style not found: ${params.styleId}`);
  style.remove();
  return "ok";
}

async function createPaintStyleSingle(p: any): Promise<IdResult> {
  const style = figma.createPaintStyle();
  style.name = p.name;
  const { r, g, b, a = 1 } = p.color;
  style.paints = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
  return { id: style.id };
}

async function createTextStyleSingle(p: any): Promise<IdWithWarningResult> {
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
      hints.push(`WCAG: Line height ${Math.ceil(p.fontSize * 1.5)}px (1.5×) recommended.`);
    }
  }
  if (hints.length > 0) result.warning = hints.join(" ");

  return result;
}

async function createEffectStyleSingle(p: any): Promise<IdResult> {
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

async function applyStyleSingle(p: any): Promise<ApplyStyleItemResult> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);

  let styleId = p.styleId ? ensureStyleId(p.styleId) : null;
  let matchedStyle: string | undefined;
  if (!styleId && p.styleName) {
    const [paints, texts, effects] = await Promise.all([
      figma.getLocalPaintStylesAsync(), figma.getLocalTextStylesAsync(), figma.getLocalEffectStylesAsync(),
    ]);
    // Filter to styles relevant for the requested type
    const typeMap: Record<string, any[]> = { fill: paints, stroke: paints, text: texts, effect: effects };
    const relevant = typeMap[p.styleType] || [...paints, ...texts, ...effects];
    const exact = relevant.find(s => s.name === p.styleName);
    if (exact) { styleId = exact.id; matchedStyle = exact.name; }
    else {
      const fuzzy = relevant.find(s => s.name.toLowerCase().includes(p.styleName.toLowerCase()));
      if (!fuzzy) {
        const available = relevant.map(s => s.name).slice(0, 20);
        const suffix = relevant.length > 20 ? `, … and ${relevant.length - 20} more` : "";
        throw new Error(`styleName '${p.styleName}' not found for type '${p.styleType}'. Available: [${available.join(", ")}${suffix}]`);
      }
      styleId = fuzzy.id;
      matchedStyle = fuzzy.name;
    }
  }

  switch (p.styleType) {
    case "fill": await (node as any).setFillStyleIdAsync(styleId); break;
    case "stroke": await (node as any).setStrokeStyleIdAsync(styleId); break;
    case "text": await (node as any).setTextStyleIdAsync(styleId); break;
    case "effect": await (node as any).setEffectStyleIdAsync(styleId); break;
    default: throw new Error(`Unknown style type: ${p.styleType}`);
  }
  const result: any = { styleId: styleId };
  if (matchedStyle) result.matchedStyle = matchedStyle;
  // Hint when both styleId and styleName provided
  if (p.styleId && p.styleName) {
    result.warning = "Both styleId and styleName provided — used styleId. Pass only one: styleName (by name lookup) or styleId (direct ID).";
  }
  return result;
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

/** Resolve any style by ID or name — tries all types. */
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

async function patchStyleSingle(p: any) {
  const style = await resolveAnyStyle(p.id);
  if (p.name !== undefined) style.name = p.name;

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

  // WCAG recommendations for text styles
  if (style.type === "TEXT") {
    const ts = style as TextStyle;
    const hints: string[] = [];
    if (ts.fontSize < 12) hints.push("WCAG: Min 12px text recommended.");
    const lh = ts.lineHeight as any;
    if (lh && lh.unit !== "AUTO") {
      let lhPx: number | null = null;
      if (lh.unit === "PIXELS") lhPx = lh.value;
      else if (lh.unit === "PERCENT") lhPx = (lh.value / 100) * ts.fontSize;
      if (lhPx !== null && lhPx / ts.fontSize < 1.5) {
        hints.push(`WCAG: Line height ${Math.ceil(ts.fontSize * 1.5)}px (1.5×) recommended.`);
      }
    }
    if (hints.length > 0) return { warning: hints.join(" ") };
  }

  return "ok";
}

// Max unique fonts to load per batch — prevents timeouts with many font families
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
  result.deferred = `${deferredItems.length} text style(s) using fonts [${deferredFonts.join(", ")}] were NOT created to avoid timeout. Call create_text_style again with those items.`;
  return result;
}

async function patchStylesBatch(params: any) {
  const items: any[] = params.items || [params];

  // Resolve styles and collect font requirements for text styles
  // Errors here are non-fatal — batchHandler will catch them per-item
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
    } catch { /* skip — will error in batchHandler */ }
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
      result.deferred = `${deferredItems.length} text style(s) using fonts [${deferredFonts.join(", ")}] were NOT updated to avoid timeout. Call patch_styles again with those items.`;
      return result;
    }
  }

  return batchHandler(params, patchStyleSingle);
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_styles: getStylesFigma,
  get_style_by_id: getStyleByIdFigma,
  remove_style: removeStyleFigma,
  create_paint_style: (p) => batchHandler(p, createPaintStyleSingle),
  create_text_style: createTextStyleBatch,
  create_effect_style: (p) => batchHandler(p, createEffectStyleSingle),
  apply_style_to_node: (p) => batchHandler(p, applyStyleSingle),
  patch_styles: patchStylesBatch,
};
