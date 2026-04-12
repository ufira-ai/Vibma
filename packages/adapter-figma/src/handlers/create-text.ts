import { batchHandler, appendToParent, checkParentOverflow, checkOverlappingSiblings, suggestTextStyle, applyFillWithAutoBind, applySizing, styleNotFoundHint, bindTextToComponentProperty, findComponentForBinding, warnCrossAxisHug, resolveTextStylesForBatch, type Hint } from "./helpers";
import { textCreate } from "@ufira/vibma/guards";
import { applyAnnotations } from "./annotations";

// ─── Figma Handlers ──────────────────────────────────────────────

function getFontStyle(weight: number): string {
  const map: Record<number, string> = {
    100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
    500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black",
  };
  return map[weight] || "Regular";
}

/** Strip a font style to lowercase letters only for fuzzy comparison. */
function stripStyle(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, "");
}

/**
 * Resolve a font family + style to the exact Figma font name.
 * Tries: exact → camelCase split → case-insensitive fuzzy → suggests available.
 * Caches listAvailableFontsAsync results for the duration of the batch.
 */
let _fontCache: FontName[] | null = null;
export async function resolveFontAsync(family: string, style: string): Promise<FontName> {
  // 1. Exact match
  try { await figma.loadFontAsync({ family, style }); return { family, style }; } catch {}

  // 2. CamelCase split: "SemiBold" → "Semi Bold"
  const normalized = style.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (normalized !== style) {
    try { await figma.loadFontAsync({ family, style: normalized }); return { family, style: normalized }; } catch {}
  }

  // 3. Fuzzy match against available fonts
  // listAvailableFontsAsync returns Font[] ({fontName: FontName}), normalize to FontName[]
  if (!_fontCache) {
    const raw = await figma.listAvailableFontsAsync();
    _fontCache = raw.map((f: any) => f.fontName ?? f);
  }
  const familyFonts = _fontCache.filter(f => f.family?.toLowerCase() === family.toLowerCase());
  const stripped = stripStyle(style);
  const match = familyFonts.find(f => stripStyle(f.style) === stripped);
  if (match) {
    await figma.loadFontAsync(match);
    return match;
  }

  // 4. Case-insensitive family match (agent might say "inter" instead of "Inter")
  if (familyFonts.length === 0) {
    const looseFamilyFonts = _fontCache.filter(f => f.family?.toLowerCase() === family.toLowerCase());
    const looseMatch = looseFamilyFonts.find(f => stripStyle(f.style) === stripped);
    if (looseMatch) {
      await figma.loadFontAsync(looseMatch);
      return looseMatch;
    }
  }

  const available = [...new Set(familyFonts.map(f => f.style))];
  throw new Error(`Font "${family}" style "${style}" not found. Available styles: [${available.join(", ")}]. Use fonts(method: "list") to see all fonts.`);
}

/** Clear font cache between batches. */
export function clearFontCache() { _fontCache = null; }

/** Compat wrapper for imports that use normalizeFontStyle — delegates to the sync portion. */
export function normalizeFontStyle(style: string): string {
  return style.replace(/([a-z])([A-Z])/g, "$1 $2");
}

// Schema keys + handler-level extensions not in YAML
const TEXT_CREATE_KEYS = new Set([
  ...textCreate,
  "fontColorVariableId", // accepted but not in schema
  "fillColor", "fillVariableName", "fillStyleName", // aliases → fills via batchHandler
]) as ReadonlySet<string>;

export interface CreateTextContext {
  textStyles: any[] | null;
  /** name → resolved BaseStyle (local first, library fallback). Preferred lookup path. */
  textStyleByName: Map<string, any>;
  paintStyles: any[] | null;
  resolvedTextStyleMap: Map<string, any>;
  resolvedFontMap: Map<string, FontName>;
  setCharacters: (node: TextNode, text: string) => Promise<void>;
}

/**
 * Batch-level prep: collect fonts, resolve styles, preload everything once.
 */
export async function prepCreateText(params: any): Promise<CreateTextContext> {
  const items = params.items || [params];

  clearFontCache();

  // Note: fill*/fontColor* aliases are normalized to `fills` by batchHandler

  // Resolve text styles: local first, library fallback via _textStyleKey.
  const { byName: textStyleByName, fontsToLoad: styleFonts, localStyles } = await resolveTextStylesForBatch(items);
  const textStyles: any[] | null = localStyles.length > 0 || items.some((p: any) => p.textStyleName) ? localStyles : null;

  // Preload paint styles if any item uses a style-tagged fill
  const hasFillStyle = items.some((p: any) => p.fills?._style || p.fontColorStyleName);
  let paintStyles: any[] | null = null;
  if (hasFillStyle) {
    paintStyles = await figma.getLocalPaintStylesAsync();
  }

  // Collect font requirements.
  const fontRequests: Array<{ family: string; style: string }> = [];
  for (const p of items) {
    fontRequests.push({
      family: p.fontFamily || "Inter",
      style: p.fontStyle || getFontStyle(p.fontWeight || 400),
    });
  }
  for (const fn of styleFonts) {
    fontRequests.push({ family: fn.family, style: fn.style });
  }

  // Resolved text style cache by ID.
  const resolvedTextStyleMap = new Map<string, any>();
  for (const [, style] of textStyleByName) {
    if (style?.id) resolvedTextStyleMap.set(style.id, style);
  }
  for (const p of items) {
    if (p.textStyleId && !resolvedTextStyleMap.has(p.textStyleId)) {
      const s = await figma.getStyleByIdAsync(p.textStyleId);
      if (s?.type === "TEXT") {
        resolvedTextStyleMap.set(p.textStyleId, s);
        const fn = (s as TextStyle).fontName;
        if (fn) fontRequests.push({ family: fn.family, style: fn.style });
      }
    }
  }

  // Resolve all fonts with fuzzy matching (dedup by key)
  const resolvedFontMap = new Map<string, FontName>();
  const seen = new Set<string>();
  for (const { family, style } of fontRequests) {
    const key = `${family}::${style}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const resolved = await resolveFontAsync(family, style);
    resolvedFontMap.set(key, resolved);
  }

  const { setCharacters } = await import("../utils/figma-helpers");
  return { textStyles, textStyleByName, paintStyles, resolvedTextStyleMap, resolvedFontMap, setCharacters };
}

/**
 * Create a single text node. Returns { id, warning? }.
 * batchHandler handles depth enrichment, warning hoisting, and error wrapping.
 */
export async function createTextSingle(p: any, ctx: CreateTextContext) {
  const {
    x = 0, y = 0, text = p.characters ?? "Text", fontSize = 14, fontWeight = 400, // characters: legacy fallback, aliased to text at MCP level
    fontFamily = "Inter", fontStyle,
    fills, name = "",
    parentId, textStyleId, textStyleName,
    textAlignHorizontal, textAlignVertical,
    layoutSizingHorizontal, layoutSizingVertical, textAutoResize,
    componentPropertyName, componentId,
    width,
  } = p;

  const textNode = figma.createText();
  try {
    textNode.x = x;
    textNode.y = y;
    textNode.name = name || text;

    const requestedStyle = fontStyle || getFontStyle(fontWeight);
    const resolvedFont = ctx.resolvedFontMap.get(`${fontFamily}::${requestedStyle}`) ?? { family: fontFamily, style: requestedStyle };
    textNode.fontName = resolvedFont;
    textNode.fontSize = parseInt(String(fontSize));

    // Text properties: lineHeight, letterSpacing, textCase, textDecoration
    if (p.lineHeight !== undefined) {
      if (typeof p.lineHeight === "number") textNode.lineHeight = { value: p.lineHeight, unit: "PIXELS" };
      else if (p.lineHeight.unit === "AUTO") textNode.lineHeight = { unit: "AUTO" };
      else textNode.lineHeight = { value: p.lineHeight.value, unit: p.lineHeight.unit };
    }
    if (p.letterSpacing !== undefined) {
      if (typeof p.letterSpacing === "number") textNode.letterSpacing = { value: p.letterSpacing, unit: "PIXELS" };
      else textNode.letterSpacing = { value: p.letterSpacing.value, unit: p.letterSpacing.unit };
    }
    if (p.textCase) textNode.textCase = p.textCase;
    if (p.textDecoration) textNode.textDecoration = p.textDecoration;

    await ctx.setCharacters(textNode, text);

    if (textAlignHorizontal) textNode.textAlignHorizontal = textAlignHorizontal;
    if (textAlignVertical) textNode.textAlignVertical = textAlignVertical;

    // Text color: fills is canonical (normalized from fontColor/fontColorVariableName/fontColorStyleName by batchHandler)
    const hints: Hint[] = [];

    // lineHeight sanity warnings
    if (p.lineHeight !== undefined && typeof p.lineHeight === "number" && p.lineHeight < 10) {
      hints.push({ type: "warn", message: `lineHeight ${p.lineHeight}px looks wrong — did you mean {value: ${Math.round(p.lineHeight * 100)}, unit: "PERCENT"}? Bare numbers are pixels.` });
    }
    if (p.lineHeight !== undefined && typeof p.lineHeight === "object" && p.lineHeight.unit === "PERCENT" && p.lineHeight.value < 10) {
      hints.push({ type: "warn", message: `lineHeight ${p.lineHeight.value}% looks wrong — did you mean ${Math.round(p.lineHeight.value * 100)}%? PERCENT uses whole percentages (e.g. 150 = 1.5×).` });
    }
    const colorSet = await applyFillWithAutoBind(textNode, { fills }, hints);
    if (!colorSet && fills === undefined) {
      // Default black for text with no color specified
      textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
    }

    // Text style: by name (resolved map) or by ID.
    let resolvedStyleId = textStyleId;
    if (!resolvedStyleId && textStyleName) {
      const resolved = ctx.textStyleByName.get(textStyleName);
      if (resolved?.id) resolvedStyleId = resolved.id;
    }
    if (resolvedStyleId) {
      const cached = ctx.resolvedTextStyleMap.get(resolvedStyleId);
      if (cached) {
        try {
          await (textNode as any).setTextStyleIdAsync(cached.id);
        } catch (e: any) {
          hints.push({ type: "error", message: `textStyleName '${textStyleName || resolvedStyleId}' matched but failed to apply: ${e.message}` });
        }
      } else {
        hints.push({ type: "error", message: `textStyleName '${textStyleName || resolvedStyleId}' matched style ID '${resolvedStyleId}' but the style could not be loaded. It may be from a remote library or deleted.` });
      }
    } else if (textStyleName) {
      hints.push(styleNotFoundHint("textStyleName", textStyleName, (ctx.textStyles || []).map((s: any) => s.name)));
    } else {
      hints.push(await suggestTextStyle(fontSize, fontWeight));
    }

    const parent = await appendToParent(textNode, parentId);
    checkOverlappingSiblings(textNode, parent, hints);
    checkParentOverflow(parent, hints);

    // Component property binding: bind text to a component TEXT property
    const comp = await findComponentForBinding(textNode, componentId, hints);
    if (componentPropertyName) {
      if (!comp) {
        if (!componentId) hints.push({ type: "error", message: `componentPropertyName '${componentPropertyName}' ignored — no ancestor component found.` });
      } else {
        bindTextToComponentProperty(textNode, comp, componentPropertyName, hints);
      }
    } else if (comp) {
      // Auto-bind: match text node name to component TEXT property name
      // Variant components delegate property definitions to their parent COMPONENT_SET
      const defOwner = comp.type === "COMPONENT" && comp.parent?.type === "COMPONENT_SET" ? comp.parent : comp;
      const defs = defOwner.componentPropertyDefinitions;
      const textProps = Object.keys(defs).filter(k => defs[k].type === "TEXT");
      if (textProps.length > 0) {
        const nodeName = textNode.name.toLowerCase();
        const match = textProps.find(k => {
          const baseName = k.split("#")[0].toLowerCase();
          return baseName === nodeName;
        });
        if (match) {
          (textNode as any).componentPropertyReferences = { characters: match };
        } else {
          const available = textProps.map(k => k.split("#")[0]);
          hints.push({ type: "warn", message: `Text "${textNode.name}" added to component "${comp.name}" but not bound to any TEXT property. Pass componentPropertyName on text.create or text/frames(method:"update") to bind, or rename to match an existing property: [${available.join(", ")}].` });
        }
      } else {
        hints.push({ type: "warn", message: `Text "${textNode.name}" inside component "${comp.name}" is not exposed as a property — instances cannot override this text. Pass componentPropertyName to bind it.` });
      }
    }

    if (fontSize < 12) {
      hints.push({ type: "suggest", message: "WCAG: Min 12px text recommended." });
    }

    // Apply explicit width — implies FIXED sizing and HEIGHT auto-resize
    if (width !== undefined) {
      textNode.resize(width, textNode.height);
    }

    // Let applySizing handle alignment-aware inference (FILL vs HUG on cross-axis).
    // Only pre-resolve: explicit width → FIXED, explicit sizing → pass through.
    applySizing(textNode, parent, {
      layoutSizingHorizontal: layoutSizingHorizontal || (width !== undefined ? "FIXED" : undefined),
      layoutSizingVertical: layoutSizingVertical,
    }, hints);

    // Set textAutoResize based on resolved sizing (after applySizing chose FILL/HUG/FIXED)
    if (textAutoResize) {
      textNode.textAutoResize = textAutoResize;
    } else {
      const resolvedH = (textNode as any).layoutSizingHorizontal;
      if (resolvedH === "FILL" || resolvedH === "FIXED") {
        textNode.textAutoResize = "HEIGHT";
      }
    }

    warnCrossAxisHug(textNode, textNode.parent, hints, "Text");

    applyAnnotations(textNode, p, hints);

    const result: any = { id: textNode.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    textNode.remove();
    throw e;
  }
}

/**
 * Batch create_text: preload fonts/styles, then delegate to batchHandler.
 */
async function createTextBatch(params: any) {
  const ctx = await prepCreateText(params);
  return batchHandler(params, (item) => createTextSingle(item, ctx), { keys: TEXT_CREATE_KEYS, help: 'text(method: "help", topic: "create")' });
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_text: createTextBatch,
};
