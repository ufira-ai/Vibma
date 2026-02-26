import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler, appendToParent } from "./helpers";

// ─── Schema ──────────────────────────────────────────────────────

const textItem = z.object({
  text: z.string().describe("Text content"),
  name: z.string().optional().describe("Layer name (default: text content)"),
  x: S.xPos,
  y: S.yPos,
  fontSize: z.coerce.number().optional().describe("Font size (default: 14)"),
  fontWeight: z.coerce.number().optional().describe("Font weight: 100-900 (default: 400)"),
  fontColor: flexJson(S.colorRgba.optional()).describe('Font color. Hex "#000000" or {r,g,b,a?} 0-1. Default: black.'),
  fontColorVariableId: z.string().optional().describe("Bind a color variable to the text fill instead of hardcoded fontColor."),
  parentId: S.parentId,
  textStyleId: z.string().optional().describe("Text style ID to apply (overrides fontSize/fontWeight). Omit to skip."),
  textStyleName: z.string().optional().describe("Text style name (case-insensitive match). Omit to skip."),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. FILL auto-sets textAutoResize to HEIGHT."),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
  textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior (default: WIDTH_AND_HEIGHT when FILL)"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "create_text",
    "Create text nodes in Figma. Uses Inter font. Max 10 items per batch. Use textStyleName to apply styles by name.",
    { items: flexJson(z.array(textItem).max(10)).describe("Array of text nodes to create (max 10)"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_text", params)); }
      catch (e) { return mcpError("Error creating text", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

function getFontStyle(weight: number): string {
  const map: Record<number, string> = {
    100: "Thin", 200: "Extra Light", 300: "Light", 400: "Regular",
    500: "Medium", 600: "Semi Bold", 700: "Bold", 800: "Extra Bold", 900: "Black",
  };
  return map[weight] || "Regular";
}

/**
 * Batch create_text with font preloading.
 * Collects all unique fonts + text styles upfront, loads them in one Promise.all,
 * then creates nodes without per-item font loading overhead.
 */
async function createTextBatch(params: any): Promise<{ results: any[] }> {
  const items = params.items || [params];
  const depth = params.depth;

  // 1. Collect unique font keys needed (family::style format)
  const fontKeys = new Set<string>();
  for (const p of items) {
    const style = getFontStyle(p.fontWeight || 400);
    fontKeys.add(`Inter::${style}`);
  }

  // 2. Resolve text styles by name once (not per-item)
  const styleNames = new Set<string>();
  for (const p of items) {
    if (p.textStyleName && !p.textStyleId) styleNames.add(p.textStyleName);
  }
  let textStyles: any[] | null = null;
  if (styleNames.size > 0) {
    textStyles = await figma.getLocalTextStylesAsync();
  }

  // 2b. Resolve text style IDs and collect their fonts for preloading
  const resolvedTextStyleMap = new Map<string, any>(); // textStyleId → style object
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

  // 3. Preload all fonts in parallel (Inter styles + text style fonts)
  await Promise.all(
    [...fontKeys].map(key => {
      const [family, style] = key.split("::");
      return figma.loadFontAsync({ family, style });
    })
  );

  // 4. Import setCharacters once
  const { setCharacters } = await import("../utils/figma-helpers");

  // 5. Create nodes (font already loaded, no await per item for fonts)
  const results = [];
  for (const p of items) {
    try {
      const {
        x = 0, y = 0, text = "Text", fontSize = 14, fontWeight = 400,
        fontColor, fontColorVariableId, name = "",
        parentId, textStyleId, textStyleName,
        layoutSizingHorizontal, layoutSizingVertical, textAutoResize,
      } = p;

      const textNode = figma.createText();
      textNode.x = x;
      textNode.y = y;
      textNode.name = name || text;

      const style = getFontStyle(fontWeight);
      textNode.fontName = { family: "Inter", style };
      textNode.fontSize = parseInt(String(fontSize));

      await setCharacters(textNode, text);

      // Font color: variableId > direct color > default black
      let colorTokenized = false;
      const fc = fontColor || { r: 0, g: 0, b: 0, a: 1 };
      textNode.fills = [{
        type: "SOLID",
        color: { r: fc.r ?? 0, g: fc.g ?? 0, b: fc.b ?? 0 },
        opacity: fc.a ?? 1,
      }];
      if (fontColorVariableId) {
        const v = await figma.variables.getVariableByIdAsync(fontColorVariableId);
        if (v) {
          const bound = figma.variables.setBoundVariableForPaint(textNode.fills[0], "color", v);
          textNode.fills = [bound];
          colorTokenized = true;
        }
      }

      // Text style: by name > by ID (fonts already preloaded in step 2b/3)
      let resolvedStyleId = textStyleId;
      if (!resolvedStyleId && textStyleName && textStyles) {
        const exact = textStyles.find((s: any) => s.name === textStyleName);
        if (exact) resolvedStyleId = exact.id;
        else {
          const fuzzy = textStyles.find((s: any) => s.name.toLowerCase().includes(textStyleName.toLowerCase()));
          if (fuzzy) resolvedStyleId = fuzzy.id;
        }
      }
      if (resolvedStyleId) {
        const cached = resolvedTextStyleMap.get(resolvedStyleId);
        if (cached) await (textNode as any).setTextStyleIdAsync(cached.id);
      }

      await appendToParent(textNode, parentId);

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

      let result: any = { id: textNode.id };
      if (depth !== undefined) {
        const { nodeSnapshot } = await import("./helpers");
        const snapshot = await nodeSnapshot(textNode.id, depth);
        if (snapshot) result = { ...result, ...snapshot };
      }
      // Creation-time hints
      const hints: string[] = [];
      if (fontColor && fontColorVariableId) {
        hints.push("Multiple font color sources — used fontColorVariableId, ignored fontColor. Pass only one: fontColorVariableId (variable token) or fontColor (one-off).");
      } else if (fontColor && !colorTokenized) {
        // Suppress hint for intentional white/black on variable-bound parent
        const isNeutral = (fontColor.r === 0 && fontColor.g === 0 && fontColor.b === 0) || (fontColor.r === 1 && fontColor.g === 1 && fontColor.b === 1);
        const parent = textNode.parent;
        const parentHasBoundFill = parent && "boundVariables" in parent && (parent as any).boundVariables?.fills?.length > 0;
        if (!(isNeutral && parentHasBoundFill)) {
          hints.push("Hardcoded font color. Use fontColorVariableId to bind a color variable. Only use fontColor for one-off colors not in your design system.");
        }
      }
      if (textStyleName && textStyleId) {
        hints.push("Both textStyleName and textStyleId provided — used textStyleId. Pass only one: textStyleName (by name lookup) or textStyleId (direct ID).");
      } else if (!resolvedStyleId) {
        hints.push("No text style applied. Use textStyleName to apply a text style that controls fontSize, fontWeight, and lineHeight together.");
      }
      if (hints.length > 0) {
        hints.push("Run lint_node after building to catch these patterns across your design.");
        result._hint = hints.join(" ");
      }
      results.push(result);
    } catch (e: any) {
      results.push({ error: e.message });
    }
  }
  return { results };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_text: createTextBatch,
};
