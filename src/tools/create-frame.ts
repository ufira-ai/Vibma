import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler, appendToParent, solidPaint } from "./helpers";

// ─── Schema ──────────────────────────────────────────────────────

const frameItem = z.object({
  name: z.string().optional().describe("Frame name (default: 'Frame')"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 100)"),
  height: z.coerce.number().optional().describe("Height (default: 100)"),
  parentId: S.parentId,
  fillColor: flexJson(S.colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: no fill (empty fills array).'),
  strokeColor: flexJson(S.colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: none.'),
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
  // Style/variable references
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

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "create_frame",
    "Create frames in Figma. Supports batch. Prefer fillStyleName or fillVariableId over hardcoded fillColor for design token consistency.",
    { items: flexJson(z.array(frameItem)).describe("Array of frames to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_frame", params)); }
      catch (e) { return mcpError("Error creating frames", e); }
    }
  );

  server.tool(
    "create_auto_layout",
    "Wrap existing nodes in an auto-layout frame. One call replaces create_frame + set_layout_mode + insert_child × N.",
    { items: flexJson(z.array(autoLayoutItem)).describe("Array of auto-layout wraps to perform"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_auto_layout", params)); }
      catch (e) { return mcpError("Error creating auto layout", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

function colorConflictHints(prop: string, variableId: any, styleName: any, color: any, tokenized: boolean): string[] {
  const sources = [variableId && "VariableId", styleName && "StyleName", color && "Color"].filter(Boolean) as string[];
  if (sources.length > 1) {
    const used = variableId ? "VariableId" : styleName ? "StyleName" : "Color";
    const ignored = sources.filter(s => s !== used);
    return [`Multiple ${prop} sources — used ${prop}${used}, ignored ${ignored.map(s => prop + s).join(", ")}. Pass only one: ${prop}VariableId (variable token), ${prop}StyleName (paint style), or ${prop}Color (one-off).`];
  }
  if (sources.length === 1 && color && !tokenized) {
    return [`Hardcoded ${prop} color. Use ${prop}StyleName to apply a paint style, or ${prop}VariableId to bind a color variable. Only use ${prop}Color for one-off colors not in your design system.`];
  }
  return [];
}

async function resolveStyleId(name: string, styleType: "paint" | "text" | "effect"): Promise<string | null> {
  if (styleType === "paint") {
    const styles = await figma.getLocalPaintStylesAsync();
    const exact = styles.find(s => s.name === name);
    if (exact) return exact.id;
    const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
    return fuzzy?.id ?? null;
  }
  return null;
}

async function createSingleFrame(p: any) {
  const {
    x = 0, y = 0, width = 100, height = 100, name = "Frame", parentId,
    fillColor, strokeColor, strokeWeight, cornerRadius,
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0,
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    itemSpacing = 0,
    fillStyleName, strokeStyleName,
    fillVariableId, strokeVariableId,
  } = p;

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;
  frame.fills = []; // no fill by default
  if (cornerRadius !== undefined) frame.cornerRadius = cornerRadius;

  const deferH = parentId && layoutSizingHorizontal === "FILL";
  const deferV = parentId && layoutSizingVertical === "FILL";

  if (layoutMode !== "NONE") {
    frame.layoutMode = layoutMode;
    frame.layoutWrap = layoutWrap;
    frame.paddingTop = paddingTop;
    frame.paddingRight = paddingRight;
    frame.paddingBottom = paddingBottom;
    frame.paddingLeft = paddingLeft;
    frame.primaryAxisAlignItems = primaryAxisAlignItems;
    frame.counterAxisAlignItems = counterAxisAlignItems;
    frame.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
    frame.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
    frame.itemSpacing = itemSpacing;
  }

  // Fill: variableId > styleName > direct color
  let fillTokenized = false;
  if (fillVariableId) {
    const v = await figma.variables.getVariableByIdAsync(fillVariableId);
    if (v) {
      frame.fills = [solidPaint(fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(frame.fills[0], "color", v);
      frame.fills = [bound];
      fillTokenized = true;
    }
  } else if (fillStyleName) {
    const sid = await resolveStyleId(fillStyleName, "paint");
    if (sid) { await (frame as any).setFillStyleIdAsync(sid); fillTokenized = true; }
  } else if (fillColor) {
    frame.fills = [solidPaint(fillColor)];
  }

  // Stroke: variableId > styleName > direct color
  let strokeTokenized = false;
  if (strokeVariableId) {
    const v = await figma.variables.getVariableByIdAsync(strokeVariableId);
    if (v) {
      frame.strokes = [solidPaint(strokeColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(frame.strokes[0], "color", v);
      frame.strokes = [bound];
      strokeTokenized = true;
    }
  } else if (strokeStyleName) {
    const sid = await resolveStyleId(strokeStyleName, "paint");
    if (sid) { await (frame as any).setStrokeStyleIdAsync(sid); strokeTokenized = true; }
  } else if (strokeColor) {
    frame.strokes = [solidPaint(strokeColor)];
  }
  if (strokeWeight !== undefined) frame.strokeWeight = strokeWeight;

  // Append to parent or page (with deferred FILL sizing)
  const parent = await appendToParent(frame, parentId);
  if (parent) {
    if (deferH) { try { frame.layoutSizingHorizontal = "FILL"; } catch {} }
    if (deferV) { try { frame.layoutSizingVertical = "FILL"; } catch {} }
  }

  const result: any = { id: frame.id };
  const hints: string[] = [];
  hints.push(...colorConflictHints("fill", fillVariableId, fillStyleName, fillColor, fillTokenized));
  hints.push(...colorConflictHints("stroke", strokeVariableId, strokeStyleName, strokeColor, strokeTokenized));
  if (hints.length > 0) {
    hints.push("Run lint_node after building to catch these patterns across your design.");
    result._hint = hints.join(" ");
  }
  return result;
}

async function createSingleAutoLayout(p: any) {
  if (!p.nodeIds?.length) throw new Error("Missing nodeIds");

  const nodes: SceneNode[] = [];
  for (const id of p.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node as SceneNode);
  }

  const originalParent = nodes[0].parent || figma.currentPage;

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if ("x" in n && "y" in n && "width" in n && "height" in n) {
      const nx = (n as any).x, ny = (n as any).y, nw = (n as any).width, nh = (n as any).height;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    }
  }

  const frame = figma.createFrame();
  frame.name = p.name || "Auto Layout";
  frame.fills = [];
  if (minX !== Infinity) {
    frame.x = minX;
    frame.y = minY;
    frame.resize(maxX - minX, maxY - minY);
  }

  if ("appendChild" in originalParent) (originalParent as any).appendChild(frame);
  for (const node of nodes) frame.appendChild(node);

  frame.layoutMode = p.layoutMode || "VERTICAL";
  frame.itemSpacing = p.itemSpacing ?? 0;
  frame.paddingTop = p.paddingTop ?? 0;
  frame.paddingRight = p.paddingRight ?? 0;
  frame.paddingBottom = p.paddingBottom ?? 0;
  frame.paddingLeft = p.paddingLeft ?? 0;
  if (p.primaryAxisAlignItems) frame.primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems) frame.counterAxisAlignItems = p.counterAxisAlignItems;
  frame.layoutSizingHorizontal = p.layoutSizingHorizontal || "HUG";
  frame.layoutSizingVertical = p.layoutSizingVertical || "HUG";
  if (p.layoutWrap) frame.layoutWrap = p.layoutWrap;

  return { id: frame.id };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_frame: (p) => batchHandler(p, createSingleFrame),
  create_auto_layout: (p) => batchHandler(p, createSingleAutoLayout),
};
