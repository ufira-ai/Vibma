import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";
import * as S from "./schemas";
import type { ToolDef } from "./types";
import { batchHandler } from "./helpers";
import { setFillSingle, setStrokeSingle, setCornerSingle, setOpacitySingle } from "./fill-stroke";
import { setEffectsSingle, setConstraintsSingle, setExportSettingsSingle, setNodePropertiesSingle } from "./effects";
import { moveSingle, resizeSingle } from "./modify-node";
import { updateFrameSingle } from "./update-frame";
import { prepSetTextProperties, setTextPropertiesSingle } from "./text";
import type { TextPropsContext } from "./text";

// ─── Schema ──────────────────────────────────────────────────────

const exportSettingEntry = z.object({
  format: z.enum(["PNG", "JPG", "SVG", "PDF"]),
  suffix: z.string().optional(),
  contentsOnly: flexBool(z.boolean()).optional(),
  constraint: flexJson(z.object({
    type: z.enum(["SCALE", "WIDTH", "HEIGHT"]),
    value: z.coerce.number(),
  })).optional(),
});

const patchNodeItem = z.object({
  nodeId: S.nodeId,

  // Geometry (flat)
  x: z.coerce.number().optional().describe("X position"),
  y: z.coerce.number().optional().describe("Y position"),
  width: z.coerce.number().positive().optional().describe("Width (must provide height too)"),
  height: z.coerce.number().positive().optional().describe("Height (must provide width too)"),

  // Appearance (nested)
  fill: flexJson(z.object({
    color: flexJson(S.colorRgba).optional(),
    styleName: z.string().optional().describe("Paint style name (preferred over color)"),
  })).optional().describe("Fill color or style"),

  stroke: flexJson(z.object({
    color: flexJson(S.colorRgba).optional(),
    weight: z.coerce.number().positive().optional().describe("Stroke weight"),
    styleName: z.string().optional().describe("Paint style name (preferred over color)"),
  })).optional().describe("Stroke color/weight or style"),

  cornerRadius: flexJson(z.object({
    radius: z.coerce.number().min(0).describe("Corner radius"),
    corners: flexJson(z.array(flexBool(z.boolean())).length(4)).optional()
      .describe("Which corners [topLeft, topRight, bottomRight, bottomLeft]. Default: all."),
  })).optional().describe("Corner radius"),

  opacity: z.coerce.number().min(0).max(1).optional().describe("Opacity (0-1)"),

  effects: flexJson(z.object({
    effects: flexJson(z.array(S.effectEntry)).optional().describe("Effect objects"),
    styleName: z.string().optional().describe("Effect style name (preferred over raw effects)"),
  })).optional().describe("Effects or effect style"),

  constraints: flexJson(z.object({
    horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
    vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
  })).optional().describe("Layout constraints"),

  exportSettings: flexJson(z.array(exportSettingEntry)).optional().describe("Export settings"),

  // Layout (nested)
  layout: flexJson(z.object({
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional(),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional(),
    paddingTop: z.coerce.number().optional(),
    paddingRight: z.coerce.number().optional(),
    paddingBottom: z.coerce.number().optional(),
    paddingLeft: z.coerce.number().optional(),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    itemSpacing: z.coerce.number().optional(),
    counterAxisSpacing: z.coerce.number().optional(),
  })).optional().describe("Auto-layout properties"),

  // Text (nested)
  text: flexJson(z.object({
    fontSize: z.coerce.number().optional(),
    fontWeight: z.coerce.number().optional(),
    fontColor: flexJson(S.colorRgba).optional(),
    textStyleId: z.string().optional(),
    textStyleName: z.string().optional(),
    textAlignHorizontal: z.enum(["LEFT", "CENTER", "RIGHT", "JUSTIFIED"]).optional(),
    textAlignVertical: z.enum(["TOP", "CENTER", "BOTTOM"]).optional(),
    textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional(),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  })).optional().describe("Text properties (font, alignment, sizing)"),

  // Escape hatch
  properties: flexJson(z.record(z.string(), z.unknown())).optional()
    .describe("Arbitrary key-value properties to set directly on the node"),
});

// ─── Tool Definitions ───────────────────────────────────────────

export const tools: ToolDef[] = [
  {
    name: "patch_nodes",
    description: "Patch properties on nodes. Combines geometry (x/y/width/height), appearance (fill, stroke, cornerRadius, opacity, effects, constraints, exportSettings), layout (auto-layout), text (font props), and arbitrary properties in one call. Prefer styleName over hardcoded colors. Batch: pass multiple items.",
    schema: { items: flexJson(z.array(patchNodeItem)).describe("Array of nodes to patch"), depth: S.depth },
    tier: "edit",
  },
];

// ─── Figma Handlers ──────────────────────────────────────────────

async function patchSingleNode(item: any, textCtx: TextPropsContext | null): Promise<any> {
  const result: any = {};

  // 1. Geometry: move
  if (item.x !== undefined || item.y !== undefined) {
    await moveSingle({ nodeId: item.nodeId, x: item.x, y: item.y });
  }

  // 2. Geometry: resize
  if (item.width !== undefined || item.height !== undefined) {
    if (item.width === undefined || item.height === undefined) {
      throw new Error("width and height must both be provided for resize");
    }
    await resizeSingle({ nodeId: item.nodeId, width: item.width, height: item.height });
  }

  // 3. Fill
  if (item.fill) {
    const r = await setFillSingle({ nodeId: item.nodeId, ...item.fill });
    if (r.matchedStyle) result.matchedFillStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 4. Stroke
  if (item.stroke) {
    const r = await setStrokeSingle({
      nodeId: item.nodeId,
      color: item.stroke.color,
      strokeWeight: item.stroke.weight,
      styleName: item.stroke.styleName,
    });
    if (r.matchedStyle) result.matchedStrokeStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 5. Corner radius
  if (item.cornerRadius) {
    await setCornerSingle({ nodeId: item.nodeId, ...item.cornerRadius });
  }

  // 6. Opacity
  if (item.opacity !== undefined) {
    await setOpacitySingle({ nodeId: item.nodeId, opacity: item.opacity });
  }

  // 7. Effects
  if (item.effects) {
    const r = await setEffectsSingle({
      nodeId: item.nodeId,
      effects: item.effects.effects,
      effectStyleName: item.effects.styleName,
    });
    if (r.matchedStyle) result.matchedEffectStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 8. Constraints
  if (item.constraints) {
    await setConstraintsSingle({ nodeId: item.nodeId, ...item.constraints });
  }

  // 9. Export settings
  if (item.exportSettings) {
    await setExportSettingsSingle({ nodeId: item.nodeId, settings: item.exportSettings });
  }

  // 10. Layout
  if (item.layout) {
    await updateFrameSingle({ nodeId: item.nodeId, ...item.layout });
  }

  // 11. Text
  if (item.text && textCtx) {
    const r = await setTextPropertiesSingle({ nodeId: item.nodeId, ...item.text }, textCtx);
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 12. Properties escape hatch (last)
  if (item.properties) {
    await setNodePropertiesSingle({ nodeId: item.nodeId, properties: item.properties });
  }

  return result;
}

function appendWarning(existing: string | undefined, addition: string): string {
  return existing ? `${existing} ${addition}` : addition;
}

async function patchNodesBatch(params: any) {
  const items = params.items || [params];

  // Phase 1: Prep text context if any items have text sub-object
  let textCtx: TextPropsContext | null = null;
  const textItems = items.filter((item: any) => item.text);
  if (textItems.length > 0) {
    const syntheticItems = textItems.map((item: any) => ({
      nodeId: item.nodeId,
      ...item.text,
    }));
    textCtx = await prepSetTextProperties({ items: syntheticItems });
  }

  // Phase 2: Process each item
  return batchHandler(params, (item: any) => patchSingleNode(item, textCtx));
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  patch_nodes: patchNodesBatch,
};
