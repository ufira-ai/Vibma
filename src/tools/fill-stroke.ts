import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";

// ─── Schemas ─────────────────────────────────────────────────────

const fillItem = z.object({
  nodeId: S.nodeId,
  color: flexJson(S.colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  styleName: z.string().optional().describe("Apply fill paint style by name instead of color. Omit to use color."),
});

const strokeItem = z.object({
  nodeId: S.nodeId,
  color: flexJson(S.colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  styleName: z.string().optional().describe("Apply stroke paint style by name instead of color. Omit to use color."),
});

const cornerItem = z.object({
  nodeId: S.nodeId,
  radius: z.coerce.number().min(0).describe("Corner radius"),
  corners: flexJson(z.array(flexBool(z.boolean())).length(4).optional())
    .describe("Which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Default: all corners [true,true,true,true]."),
});

const opacityItem = z.object({
  nodeId: S.nodeId,
  opacity: z.coerce.number().min(0).max(1).describe("Opacity (0-1)"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "set_fill_color",
    "Set fill color on nodes. Use styleName to apply a paint style by name, or provide color directly. Batch: pass multiple items.",
    { items: flexJson(z.array(fillItem)).describe("Array of {nodeId, color?, styleName?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_fill_color", params)); }
      catch (e) { return mcpError("Error setting fill", e); }
    }
  );

  server.tool(
    "set_stroke_color",
    "Set stroke color on nodes. Use styleName to apply a paint style by name. Batch: pass multiple items.",
    { items: flexJson(z.array(strokeItem)).describe("Array of {nodeId, color?, strokeWeight?, styleName?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_stroke_color", params)); }
      catch (e) { return mcpError("Error setting stroke", e); }
    }
  );

  server.tool(
    "set_corner_radius",
    "Set corner radius on nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(cornerItem)).describe("Array of {nodeId, radius, corners?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_corner_radius", params)); }
      catch (e) { return mcpError("Error setting corner radius", e); }
    }
  );

  server.tool(
    "set_opacity",
    "Set opacity on nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(opacityItem)).describe("Array of {nodeId, opacity}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_opacity", params)); }
      catch (e) { return mcpError("Error setting opacity", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function resolveStyle(name: string): Promise<{ id: string; name: string } | null> {
  const styles = await figma.getLocalPaintStylesAsync();
  const exact = styles.find(s => s.name === name);
  if (exact) return { id: exact.id, name: exact.name };
  const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  return fuzzy ? { id: fuzzy.id, name: fuzzy.name } : null;
}

async function setFillSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("fills" in node)) throw new Error(`Node does not support fills: ${p.nodeId}`);

  if (p.styleName && p.color) {
    const match = await resolveStyle(p.styleName);
    if (match) { await (node as any).setFillStyleIdAsync(match.id); return { matchedStyle: match.name, _hint: "Both styleName and color provided — used styleName, ignored color. Pass only one: styleName (paint style) or color (one-off)." }; }
    else throw new Error(`Fill style not found: "${p.styleName}"`);
  } else if (p.styleName) {
    const match = await resolveStyle(p.styleName);
    if (match) { await (node as any).setFillStyleIdAsync(match.id); return { matchedStyle: match.name }; }
    else throw new Error(`Fill style not found: "${p.styleName}"`);
  } else if (p.color) {
    const { r = 0, g = 0, b = 0, a = 1 } = p.color;
    (node as any).fills = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
    return { _hint: "Hardcoded fill color. Use styleName to apply a paint style, or use set_variable_binding to bind a color variable after creation." };
  }
  return {};
}

async function setStrokeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("strokes" in node)) throw new Error(`Node does not support strokes: ${p.nodeId}`);

  const result: any = {};
  if (p.styleName && p.color) {
    const match = await resolveStyle(p.styleName);
    if (match) { await (node as any).setStrokeStyleIdAsync(match.id); result.matchedStyle = match.name; result._hint = "Both styleName and color provided — used styleName, ignored color. Pass only one: styleName (paint style) or color (one-off)."; }
    else throw new Error(`Stroke style not found: "${p.styleName}"`);
  } else if (p.styleName) {
    const match = await resolveStyle(p.styleName);
    if (match) { await (node as any).setStrokeStyleIdAsync(match.id); result.matchedStyle = match.name; }
    else throw new Error(`Stroke style not found: "${p.styleName}"`);
  } else if (p.color) {
    const { r = 0, g = 0, b = 0, a = 1 } = p.color;
    (node as any).strokes = [{ type: "SOLID", color: { r, g, b }, opacity: a }];
    result._hint = "Hardcoded stroke color. Use styleName to apply a paint style, or use set_variable_binding to bind a color variable after creation.";
  }
  if (p.strokeWeight !== undefined && "strokeWeight" in node) (node as any).strokeWeight = p.strokeWeight;
  return result;
}

async function setCornerSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("cornerRadius" in node)) throw new Error(`Node does not support corner radius: ${p.nodeId}`);

  const corners = p.corners || [true, true, true, true];
  if ("topLeftRadius" in node && Array.isArray(corners) && corners.length === 4) {
    if (corners[0]) (node as any).topLeftRadius = p.radius;
    if (corners[1]) (node as any).topRightRadius = p.radius;
    if (corners[2]) (node as any).bottomRightRadius = p.radius;
    if (corners[3]) (node as any).bottomLeftRadius = p.radius;
  } else {
    (node as any).cornerRadius = p.radius;
  }
  return {};
}

async function setOpacitySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("opacity" in node)) throw new Error(`Node does not support opacity`);
  (node as any).opacity = p.opacity;
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_fill_color: (p) => batchHandler(p, setFillSingle),
  set_stroke_color: (p) => batchHandler(p, setStrokeSingle),
  set_corner_radius: (p) => batchHandler(p, setCornerSingle),
  set_opacity: (p) => batchHandler(p, setOpacitySingle),
};
