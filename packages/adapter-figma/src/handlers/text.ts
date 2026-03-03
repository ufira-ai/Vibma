import { batchHandler, suggestStyleForColor, suggestTextStyle } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

export function getFontStyle(weight: number): string {
  const map: Record<number, string> = {
    100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
    500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black",
  };
  return map[weight] || "Regular";
}

// ─── set_text_content ────────────────────────────────────────────

export interface TextContentContext {
  nodeMap: Map<string, TextNode>;
  setCharacters: (node: TextNode, text: string) => Promise<void>;
}

/**
 * Pre-resolve nodes and preload their fonts in one pass.
 */
async function prepSetTextContent(params: any): Promise<TextContentContext> {
  const items = params.items || [params];

  const nodeMap = new Map<string, TextNode>();
  const fontsToLoad = new Map<string, FontName>();
  fontsToLoad.set("Inter::Regular", { family: "Inter", style: "Regular" });

  for (const p of items) {
    const node = await figma.getNodeByIdAsync(p.nodeId);
    if (node?.type === "TEXT") {
      nodeMap.set(p.nodeId, node as TextNode);
      const fn = (node as TextNode).fontName;
      if (fn !== figma.mixed && fn) {
        fontsToLoad.set(`${(fn as FontName).family}::${(fn as FontName).style}`, fn as FontName);
      }
    }
  }

  await Promise.all([...fontsToLoad.values()].map(f => figma.loadFontAsync(f)));
  const { setCharacters } = await import("../utils/figma-helpers");
  return { nodeMap, setCharacters };
}

async function setTextContentSingle(p: any, ctx: TextContentContext): Promise<any> {
  const node = ctx.nodeMap.get(p.nodeId);
  if (!node) {
    const raw = await figma.getNodeByIdAsync(p.nodeId);
    if (!raw) throw new Error(`Node not found: ${p.nodeId}`);
    throw new Error(`Node is not a text node: ${p.nodeId}`);
  }
  await ctx.setCharacters(node, p.text);
  return {};
}

async function setTextContentBatch(params: any) {
  const ctx = await prepSetTextContent(params);
  return batchHandler(params, (item) => setTextContentSingle(item, ctx));
}

// ─── set_text_properties ─────────────────────────────────────────

export interface TextPropsContext {
  nodeMap: Map<string, TextNode>;
  textStyles: any[] | null;
}

/**
 * Pre-resolve nodes, preload current + target fonts, resolve text styles.
 */
export async function prepSetTextProperties(params: any): Promise<TextPropsContext> {
  const items = params.items || [params];

  const nodeMap = new Map<string, TextNode>();
  const fontsToLoad = new Map<string, FontName>();

  for (const p of items) {
    const node = await figma.getNodeByIdAsync(p.nodeId);
    if (node?.type === "TEXT") {
      const tn = node as TextNode;
      nodeMap.set(p.nodeId, tn);
      const fn = tn.fontName;
      if (fn !== figma.mixed && fn) {
        fontsToLoad.set(`${fn.family}::${fn.style}`, fn);
      }
      if (p.fontWeight !== undefined) {
        const style = getFontStyle(p.fontWeight);
        const family = (fn !== figma.mixed && fn) ? fn.family : "Inter";
        fontsToLoad.set(`${family}::${style}`, { family, style });
      }
    }
  }

  await Promise.all([...fontsToLoad.values()].map(f => figma.loadFontAsync(f)));

  let textStyles: any[] | null = null;
  const styleNames = new Set<string>();
  for (const p of items) {
    if (p.textStyleName && !p.textStyleId) styleNames.add(p.textStyleName);
  }
  if (styleNames.size > 0) textStyles = await figma.getLocalTextStylesAsync();

  return { nodeMap, textStyles };
}

export async function setTextPropertiesSingle(p: any, ctx: TextPropsContext) {
  const node = ctx.nodeMap.get(p.nodeId);
  if (!node) {
    const raw = await figma.getNodeByIdAsync(p.nodeId);
    if (!raw) throw new Error(`Node not found: ${p.nodeId}`);
    throw new Error(`Not a text node: ${p.nodeId}`);
  }

  // Text style takes priority
  let resolvedStyleId = p.textStyleId;
  if (!resolvedStyleId && p.textStyleName && ctx.textStyles) {
    const exact = ctx.textStyles.find((s: any) => s.name === p.textStyleName);
    if (exact) resolvedStyleId = exact.id;
    else {
      const fuzzy = ctx.textStyles.find((s: any) => s.name.toLowerCase().includes(p.textStyleName.toLowerCase()));
      if (fuzzy) resolvedStyleId = fuzzy.id;
    }
  }
  if (resolvedStyleId) {
    const s = await figma.getStyleByIdAsync(resolvedStyleId);
    if (s?.type === "TEXT") await (node as any).setTextStyleIdAsync(s.id);
  } else {
    if (p.fontWeight !== undefined) {
      const family = (node.fontName !== figma.mixed && node.fontName) ? node.fontName.family : "Inter";
      node.fontName = { family, style: getFontStyle(p.fontWeight) };
    }
    if (p.fontSize !== undefined) node.fontSize = p.fontSize;
  }

  if (p.fontColor) {
    node.fills = [{
      type: "SOLID",
      color: { r: p.fontColor.r ?? 0, g: p.fontColor.g ?? 0, b: p.fontColor.b ?? 0 },
      opacity: p.fontColor.a ?? 1,
    }];
  }

  if (p.textAlignHorizontal) node.textAlignHorizontal = p.textAlignHorizontal;
  if (p.textAlignVertical) node.textAlignVertical = p.textAlignVertical;
  if (p.textAutoResize) node.textAutoResize = p.textAutoResize;
  if (p.layoutSizingHorizontal) {
    try { node.layoutSizingHorizontal = p.layoutSizingHorizontal; } catch {}
  }
  if (p.layoutSizingVertical) {
    try { node.layoutSizingVertical = p.layoutSizingVertical; } catch {}
  }

  // Warnings
  const warnings: string[] = [];
  if (p.textStyleName && p.textStyleId) {
    warnings.push("Both textStyleName and textStyleId provided — used textStyleId. Pass only one.");
  }
  if (!resolvedStyleId && !p.textStyleName && !p.textStyleId &&
      (p.fontSize !== undefined || p.fontWeight !== undefined)) {
    const fs = p.fontSize ?? (typeof node.fontSize === "number" ? node.fontSize : 14);
    const fw = p.fontWeight ?? 400;
    warnings.push(await suggestTextStyle(fs, fw));
  }
  if (p.fontColor) {
    const suggestion = await suggestStyleForColor(p.fontColor, "fontColorStyleName");
    if (suggestion) warnings.push(suggestion);
  }

  const result: any = {};
  if (warnings.length > 0) result.warning = warnings.join(" ");
  return result;
}

async function setTextPropertiesBatch(params: any) {
  const ctx = await prepSetTextProperties(params);
  return batchHandler(params, (item) => setTextPropertiesSingle(item, ctx));
}

// ─── scan_text_nodes ─────────────────────────────────────────────

async function scanTextSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);

  const limit = p.limit ?? 50;
  const opts = { includePath: p.includePath !== false, includeGeometry: p.includeGeometry !== false };
  const textNodes: any[] = [];
  await collectTextNodes(node, [], [], 0, textNodes, limit, opts);
  const truncated = textNodes.length >= limit;
  return { nodeId: p.nodeId, count: textNodes.length, truncated, textNodes };
}

async function collectTextNodes(node: any, namePath: string[], idPath: string[], depth: number, out: any[], limit: number, opts: { includePath: boolean; includeGeometry: boolean }) {
  if (out.length >= limit) return;
  if (node.visible === false) return;
  const names = [...namePath, node.name || `Unnamed ${node.type}`];
  const ids = [...idPath, node.id];

  if (node.type === "TEXT") {
    let fontFamily = "", fontStyle = "";
    if (node.fontName && typeof node.fontName === "object") {
      if ("family" in node.fontName) fontFamily = node.fontName.family;
      if ("style" in node.fontName) fontStyle = node.fontName.style;
    }
    const entry: any = {
      id: node.id,
      name: node.name || "Text",
      characters: node.characters,
      fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
      fontFamily,
      fontStyle,
    };
    if (opts.includeGeometry) {
      const bounds = node.absoluteBoundingBox ?? node.absoluteRenderBounds;
      entry.absoluteX = bounds ? bounds.x : null;
      entry.absoluteY = bounds ? bounds.y : null;
      entry.width = bounds ? bounds.width : (node.width ?? 0);
      entry.height = bounds ? bounds.height : (node.height ?? 0);
    }
    if (opts.includePath) {
      entry.path = names.join(" > ");
      entry.pathIds = ids.join(" > ");
      entry.depth = depth;
    }
    out.push(entry);
  }

  if ("children" in node) {
    for (const child of (node as any).children) {
      if (out.length >= limit) break;
      await collectTextNodes(child, names, ids, depth + 1, out, limit, opts);
    }
  }
}

// ─── Legacy handler ──────────────────────────────────────────────

// Legacy handler: set_multiple_text_contents maps to set_text_content
async function setMultipleTextContentsFigma(params: any) {
  // Legacy format: { nodeId: "parent", text: [{ nodeId, text }] }
  const items = params.text || params.items || [];
  return setTextContentBatch({ items, depth: params.depth });
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_text_content: setTextContentBatch,
  set_text_properties: setTextPropertiesBatch,
  scan_text_nodes: (p) => batchHandler(p, scanTextSingle),
  // Legacy alias
  set_multiple_text_contents: setMultipleTextContentsFigma,
};
