import { batchHandler, appendToParent, styleNotFoundHint, suggestStyleForColor, suggestTextStyle, findVariableById } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

function getFontStyle(weight: number): string {
  const map: Record<number, string> = {
    100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
    500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black",
  };
  return map[weight] || "Regular";
}

interface CreateTextContext {
  textStyles: any[] | null;
  paintStyles: any[] | null;
  resolvedTextStyleMap: Map<string, any>;
  setCharacters: (node: TextNode, text: string) => Promise<void>;
}

/**
 * Batch-level prep: collect fonts, resolve styles, preload everything once.
 */
async function prepCreateText(params: any): Promise<CreateTextContext> {
  const items = params.items || [params];

  // Collect unique font keys needed (family::style format)
  const fontKeys = new Set<string>();
  for (const p of items) {
    const family = p.fontFamily || "Inter";
    const style = p.fontStyle || getFontStyle(p.fontWeight || 400);
    fontKeys.add(`${family}::${style}`);
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

  // Resolve paint styles for fontColorStyleName once
  const hasFontColorStyle = items.some((p: any) => p.fontColorStyleName);
  let paintStyles: any[] | null = null;
  if (hasFontColorStyle) {
    paintStyles = await figma.getLocalPaintStylesAsync();
  }

  // Resolve text style IDs and collect their fonts for preloading
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
        if (fn) fontKeys.add(`${fn.family}::${fn.style}`);
      }
    }
  }

  // Preload all fonts in parallel
  await Promise.all(
    [...fontKeys].map(key => {
      const [family, style] = key.split("::");
      return figma.loadFontAsync({ family, style });
    })
  );

  const { setCharacters } = await import("../utils/figma-helpers");
  return { textStyles, paintStyles, resolvedTextStyleMap, setCharacters };
}

/**
 * Create a single text node. Returns { id, warning? }.
 * batchHandler handles depth enrichment, warning hoisting, and error wrapping.
 */
async function createTextSingle(p: any, ctx: CreateTextContext) {
  const {
    x = 0, y = 0, text = "Text", fontSize = 14, fontWeight = 400,
    fontFamily = "Inter", fontStyle,
    fontColor, fontColorVariableId, fontColorStyleName, name = "",
    parentId, textStyleId, textStyleName,
    textAlignHorizontal, textAlignVertical,
    layoutSizingHorizontal, layoutSizingVertical, textAutoResize,
  } = p;

  const textNode = figma.createText();
  textNode.x = x;
  textNode.y = y;
  textNode.name = name || text;

  const style = fontStyle || getFontStyle(fontWeight);
  textNode.fontName = { family: fontFamily, style };
  textNode.fontSize = parseInt(String(fontSize));

  await ctx.setCharacters(textNode, text);

  if (textAlignHorizontal) textNode.textAlignHorizontal = textAlignHorizontal;
  if (textAlignVertical) textNode.textAlignVertical = textAlignVertical;

  // Font color: variableId > styleName > direct color > default black
  const hints: string[] = [];
  let colorTokenized = false;
  if (fontColorVariableId) {
    const v = await findVariableById(fontColorVariableId);
    if (v) {
      const fc = fontColor || { r: 0, g: 0, b: 0, a: 1 };
      textNode.fills = [{ type: "SOLID", color: { r: fc.r ?? 0, g: fc.g ?? 0, b: fc.b ?? 0 }, opacity: fc.a ?? 1 }];
      const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0] as SolidPaint, "color", v);
      textNode.fills = [bound];
      colorTokenized = true;
    } else {
      hints.push(`fontColorVariableId '${fontColorVariableId}' not found.`);
    }
  } else if (fontColorStyleName && ctx.paintStyles) {
    const exact = ctx.paintStyles.find((s: any) => s.name === fontColorStyleName);
    const match = exact || ctx.paintStyles.find((s: any) => s.name.toLowerCase().includes(fontColorStyleName.toLowerCase()));
    if (match) {
      try {
        await (textNode as any).setFillStyleIdAsync(match.id);
        colorTokenized = true;
      } catch (e: any) {
        hints.push(`fontColorStyleName '${fontColorStyleName}' matched '${match.name}' but failed to apply: ${e.message}`);
      }
    } else {
      hints.push(styleNotFoundHint("fontColorStyleName", fontColorStyleName, ctx.paintStyles!.map((s: any) => s.name)));
    }
  }
  if (!colorTokenized) {
    const fc = fontColor || { r: 0, g: 0, b: 0, a: 1 };
    textNode.fills = [{ type: "SOLID", color: { r: fc.r ?? 0, g: fc.g ?? 0, b: fc.b ?? 0 }, opacity: fc.a ?? 1 }];
    if (fontColor) {
      const suggestion = await suggestStyleForColor(fontColor, "fontColorStyleName");
      if (suggestion) hints.push(suggestion);
    }
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
        hints.push(`textStyleName '${textStyleName || resolvedStyleId}' matched but failed to apply: ${e.message}`);
      }
    } else {
      hints.push(`textStyleName '${textStyleName || resolvedStyleId}' matched style ID '${resolvedStyleId}' but the style could not be loaded. It may be from a remote library or deleted.`);
    }
  } else if (textStyleName) {
    hints.push(styleNotFoundHint("textStyleName", textStyleName, ctx.textStyles!.map((s: any) => s.name)));
  } else {
    hints.push(await suggestTextStyle(fontSize, fontWeight));
  }

  await appendToParent(textNode, parentId);

  if (fontSize < 12) {
    hints.push("WCAG: Min 12px text recommended.");
  }

  if (textAutoResize) {
    textNode.textAutoResize = textAutoResize;
  } else if (layoutSizingHorizontal === "FILL" || layoutSizingHorizontal === "FIXED") {
    textNode.textAutoResize = "HEIGHT";
  }

  if (layoutSizingHorizontal) {
    try { textNode.layoutSizingHorizontal = layoutSizingHorizontal; } catch {}
  }
  if (layoutSizingVertical) {
    try { textNode.layoutSizingVertical = layoutSizingVertical; } catch {}
  }

  const result: any = { id: textNode.id };
  if (hints.length > 0) result.warning = hints.join(" ");
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
