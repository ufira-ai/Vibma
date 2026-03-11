import { batchHandler, appendToParent, checkOverlappingSiblings, coerceColor, suggestTextStyle, applyFontColorWithAutoBind, styleNotFoundHint, type Hint } from "./helpers";

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
  if (!_fontCache) _fontCache = await figma.listAvailableFontsAsync();
  const familyFonts = _fontCache.filter(f => f.family.toLowerCase() === family.toLowerCase());
  const stripped = stripStyle(style);
  const match = familyFonts.find(f => stripStyle(f.style) === stripped);
  if (match) {
    await figma.loadFontAsync(match);
    return match;
  }

  // 4. Case-insensitive family match (agent might say "inter" instead of "Inter")
  if (familyFonts.length === 0) {
    const looseFamilyFonts = _fontCache.filter(f => f.family.toLowerCase() === family.toLowerCase());
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

interface CreateTextContext {
  textStyles: any[] | null;
  paintStyles: any[] | null;
  resolvedTextStyleMap: Map<string, any>;
  resolvedFontMap: Map<string, FontName>;
  setCharacters: (node: TextNode, text: string) => Promise<void>;
}

/**
 * Batch-level prep: collect fonts, resolve styles, preload everything once.
 */
async function prepCreateText(params: any): Promise<CreateTextContext> {
  const items = params.items || [params];

  clearFontCache();

  // Normalize fill* → fontColor* aliases early so preload checks see them
  for (const p of items) {
    if (p.fillColor && !p.fontColor) p.fontColor = p.fillColor;
    if (p.fillVariableName && !p.fontColorVariableName) p.fontColorVariableName = p.fillVariableName;
    if (p.fillStyleName && !p.fontColorStyleName) p.fontColorStyleName = p.fillStyleName;
  }

  // Resolve text styles by name once (not per-item)
  const styleNames = new Set<string>();
  for (const p of items) {
    if (p.textStyleName && !p.textStyleId) styleNames.add(p.textStyleName);
  }
  let textStyles: any[] | null = null;
  if (styleNames.size > 0) {
    textStyles = await figma.getLocalTextStylesAsync();
  }

  // Preload paint styles if any item uses fontColorStyleName
  const hasFontColorStyle = items.some((p: any) => p.fontColorStyleName);
  let paintStyles: any[] | null = null;
  if (hasFontColorStyle) {
    paintStyles = await figma.getLocalPaintStylesAsync();
  }

  // Collect font requirements from items and text styles
  const fontRequests: Array<{ family: string; style: string }> = [];
  for (const p of items) {
    fontRequests.push({
      family: p.fontFamily || "Inter",
      style: p.fontStyle || getFontStyle(p.fontWeight || 400),
    });
  }

  // Resolve text style IDs and collect their fonts
  const resolvedTextStyleMap = new Map<string, any>();
  for (const p of items) {
    let sid = p.textStyleId;
    if (!sid && p.textStyleName && textStyles) {
      const exact = textStyles.find((s: any) => s.name === p.textStyleName);
      if (exact) sid = exact.id;
      else {
        const fuzzy = textStyles.find((s: any) => s.name.toLowerCase().includes(p.textStyleName.toLowerCase()));
        if (fuzzy) sid = fuzzy.id;
      }
    }
    if (sid && !resolvedTextStyleMap.has(sid)) {
      const s = await figma.getStyleByIdAsync(sid);
      if (s?.type === "TEXT") {
        resolvedTextStyleMap.set(sid, s);
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
  return { textStyles, paintStyles, resolvedTextStyleMap, resolvedFontMap, setCharacters };
}

/**
 * Create a single text node. Returns { id, warning? }.
 * batchHandler handles depth enrichment, warning hoisting, and error wrapping.
 */
async function createTextSingle(p: any, ctx: CreateTextContext) {
  const {
    x = 0, y = 0, text = "Text", fontSize = 14, fontWeight = 400,
    fontFamily = "Inter", fontStyle,
    fontColor: rawFontColor, fontColorVariableId, fontColorVariableName, fontColorStyleName, name = "",
    parentId, textStyleId, textStyleName,
    textAlignHorizontal, textAlignVertical,
    layoutSizingHorizontal, layoutSizingVertical, textAutoResize,
  } = p;

  const textNode = figma.createText();
  textNode.x = x;
  textNode.y = y;
  textNode.name = name || text;

  const fontColor = rawFontColor ? coerceColor(rawFontColor) : undefined;
  const requestedStyle = fontStyle || getFontStyle(fontWeight);
  const resolvedFont = ctx.resolvedFontMap.get(`${fontFamily}::${requestedStyle}`) ?? { family: fontFamily, style: requestedStyle };
  textNode.fontName = resolvedFont;
  textNode.fontSize = parseInt(String(fontSize));

  await ctx.setCharacters(textNode, text);

  if (textAlignHorizontal) textNode.textAlignHorizontal = textAlignHorizontal;
  if (textAlignVertical) textNode.textAlignVertical = textAlignVertical;

  // Font color: shared helper handles variableName > variableId > styleName > color (with auto-bind)
  const hints: Hint[] = [];
  const colorTokenized = await applyFontColorWithAutoBind(
    textNode,
    { fontColorVariableId, fontColorVariableName, fontColorStyleName, fontColor },
    hints,
    ctx.paintStyles,
  );
  if (!colorTokenized && !fontColor && !fontColorVariableId && !fontColorVariableName && !fontColorStyleName) {
    // Default black for text with no color specified
    textNode.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 }];
  }

  // Text style: by name > by ID (fonts already preloaded)
  let resolvedStyleId = textStyleId;
  if (!resolvedStyleId && textStyleName && ctx.textStyles) {
    const exact = ctx.textStyles.find((s: any) => s.name === textStyleName);
    if (exact) resolvedStyleId = exact.id;
    else {
      const fuzzy = ctx.textStyles.find((s: any) => s.name.toLowerCase().includes(textStyleName.toLowerCase()));
      if (fuzzy) resolvedStyleId = fuzzy.id;
    }
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
    hints.push(styleNotFoundHint("textStyleName", textStyleName, ctx.textStyles!.map((s: any) => s.name)));
  } else {
    hints.push(await suggestTextStyle(fontSize, fontWeight));
  }

  const parent = await appendToParent(textNode, parentId);
  checkOverlappingSiblings(textNode, parent, hints);

  if (fontSize < 12) {
    hints.push({ type: "suggest", message: "WCAG: Min 12px text recommended." });
  }

  if (textAutoResize) {
    textNode.textAutoResize = textAutoResize;
  } else if (layoutSizingHorizontal === "FILL" || layoutSizingHorizontal === "FIXED") {
    textNode.textAutoResize = "HEIGHT";
  }

  if (layoutSizingHorizontal) {
    const parentIsAL = textNode.parent && "layoutMode" in textNode.parent && (textNode.parent as any).layoutMode !== "NONE";
    if (parentIsAL || layoutSizingHorizontal !== "FILL") { textNode.layoutSizingHorizontal = layoutSizingHorizontal; }
    else { hints.push({ type: "warn", message: `layoutSizingHorizontal '${layoutSizingHorizontal}' ignored — text node is not inside an auto-layout frame.` }); }
  }
  if (layoutSizingVertical) {
    const parentIsAL = textNode.parent && "layoutMode" in textNode.parent && (textNode.parent as any).layoutMode !== "NONE";
    if (parentIsAL || layoutSizingVertical !== "FILL") { textNode.layoutSizingVertical = layoutSizingVertical; }
    else { hints.push({ type: "warn", message: `layoutSizingVertical '${layoutSizingVertical}' ignored — text node is not inside an auto-layout frame.` }); }
  }

  const result: any = { id: textNode.id };
  if (hints.length > 0) result.hints = hints;
  return result;
}

/**
 * Batch create_text: preload fonts/styles, then delegate to batchHandler.
 */
async function createTextBatch(params: any) {
  const ctx = await prepCreateText(params);
  return batchHandler(params, (item) => createTextSingle(item, ctx));
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_text: createTextBatch,
};
