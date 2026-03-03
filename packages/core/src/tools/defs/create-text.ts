import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

const textItem = z.object({
  text: z.string().describe("Text content"),
  name: z.string().optional().describe("Layer name (default: text content)"),
  x: S.xPos,
  y: S.yPos,
  fontFamily: z.string().optional().describe("Font family (default: Inter). Use get_available_fonts to list installed fonts."),
  fontStyle: z.string().optional().describe("Font style, e.g. 'Regular', 'Bold', 'Italic' (default: derived from fontWeight). Overrides fontWeight when set."),
  fontSize: z.coerce.number().optional().describe("Font size (default: 14)"),
  fontWeight: z.coerce.number().optional().describe("Font weight: 100-900 (default: 400). Ignored when fontStyle is set."),
  fontColor: flexJson(S.colorRgba).optional().describe('Font color. Default: black.'),
  fontColorVariableId: z.string().optional().describe("Bind a color variable to the text fill instead of hardcoded fontColor."),
  fontColorStyleName: z.string().optional().describe("Apply a paint style to the text fill by name (case-insensitive). Overrides fontColor."),
  parentId: S.parentId,
  textStyleId: z.string().optional().describe("Text style ID to apply (overrides fontSize/fontWeight). Omit to skip."),
  textStyleName: z.string().optional().describe("Text style name (case-insensitive match). Omit to skip."),
  textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional().describe("Horizontal text alignment (default: LEFT)"),
  textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional().describe("Vertical text alignment (default: TOP)"),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. FILL auto-sets textAutoResize to HEIGHT."),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
  textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior (default: WIDTH_AND_HEIGHT when FILL)"),
});

export const tools: ToolDef[] = [
  {
    name: "create_text",
    description: "Create text nodes. Max 10 per batch. Prefer textStyleName for typography and fontColorStyleName or fontColorVariableId for color — hardcoded values skip design tokens. Supports custom fonts via fontFamily.",
    schema: { items: flexJson(z.array(textItem).max(10)).describe("Array of text nodes to create (max 10)"), depth: S.depth },
    tier: "create",
  },
];
