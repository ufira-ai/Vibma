import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

const frameItem = z.object({
  name: z.string().optional().describe("Frame name (default: 'Frame')"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 100)"),
  height: z.coerce.number().optional().describe("Height (default: 100)"),
  parentId: S.parentId,
  fillColor: flexJson(S.colorRgba).optional().describe('Fill color. Default: no fill.'),
  strokeColor: flexJson(S.colorRgba).optional().describe('Stroke color. Default: none.'),
  strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: z.coerce.number().min(0).optional().describe("Corner radius (default: 0)"),
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
  paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
  fillStyleName: z.string().optional().describe("Apply a fill paint style by name (case-insensitive). Omit to skip."),
  strokeStyleName: z.string().optional().describe("Apply a stroke paint style by name. Omit to skip."),
  fillVariableId: z.string().optional().describe("Bind a color variable to the fill. Creates a solid fill and binds the variable to fills/0/color."),
  strokeVariableId: z.string().optional().describe("Bind a color variable to the stroke. Creates a solid stroke and binds the variable to strokes/0/color."),
});

const autoLayoutItem = z.object({
  nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to wrap"),
  name: z.string().optional().describe("Frame name (default: 'Auto Layout')"),
  layoutMode: z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Direction (default: VERTICAL)"),
  itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
  paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional(),
});

export const tools: ToolDef[] = [
  {
    name: "create_frame",
    description: "Create frames in Figma. Batch supported. Use fillStyleName/fillVariableId and strokeStyleName/strokeVariableId instead of hardcoded colors — hardcoded values skip design tokens and will trigger lint warnings.",
    schema: { items: flexJson(z.array(frameItem)).describe("Array of frames to create"), depth: S.depth },
    tier: "create",
  },
  {
    name: "create_auto_layout",
    description: "Wrap existing nodes in an auto-layout frame. One call replaces create_frame + update_frame + insert_child × N.",
    schema: { items: flexJson(z.array(autoLayoutItem)).describe("Array of auto-layout wraps to perform"), depth: S.depth },
    tier: "create",
  },
];
