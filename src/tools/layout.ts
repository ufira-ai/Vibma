import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";

// ─── Schemas ─────────────────────────────────────────────────────

const layoutModeItem = z.object({
  nodeId: S.nodeId,
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode"),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
});

const paddingItem = z.object({
  nodeId: S.nodeId,
  paddingTop: z.coerce.number().optional().describe("Top padding (default: unchanged)"),
  paddingRight: z.coerce.number().optional().describe("Right padding (default: unchanged)"),
  paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: unchanged)"),
  paddingLeft: z.coerce.number().optional().describe("Left padding (default: unchanged)"),
});

const axisAlignItem = z.object({
  nodeId: S.nodeId,
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional()
    .describe("Primary axis alignment"),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional()
    .describe("Counter axis alignment"),
});

const layoutSizingItem = z.object({
  nodeId: S.nodeId,
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional(),
});

const itemSpacingItem = z.object({
  nodeId: S.nodeId,
  itemSpacing: z.coerce.number().optional().describe("Distance between children. Default: unchanged."),
  counterAxisSpacing: z.coerce.number().optional().describe("Distance between wrapped rows/columns (WRAP only). Default: unchanged."),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "set_layout_mode",
    "Set layout mode and wrap on frames. Batch: pass multiple items.",
    { items: flexJson(z.array(layoutModeItem)).describe("Array of {nodeId, layoutMode, layoutWrap?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_layout_mode", params)); }
      catch (e) { return mcpError("Error setting layout mode", e); }
    }
  );

  server.tool(
    "set_padding",
    "Set padding on auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z.array(paddingItem)).describe("Array of {nodeId, paddingTop?, paddingRight?, paddingBottom?, paddingLeft?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_padding", params)); }
      catch (e) { return mcpError("Error setting padding", e); }
    }
  );

  server.tool(
    "set_axis_align",
    "Set primary/counter axis alignment on auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z.array(axisAlignItem)).describe("Array of {nodeId, primaryAxisAlignItems?, counterAxisAlignItems?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_axis_align", params)); }
      catch (e) { return mcpError("Error setting axis alignment", e); }
    }
  );

  server.tool(
    "set_layout_sizing",
    "Set horizontal/vertical sizing modes on auto-layout nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(layoutSizingItem)).describe("Array of {nodeId, layoutSizingHorizontal?, layoutSizingVertical?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_layout_sizing", params)); }
      catch (e) { return mcpError("Error setting layout sizing", e); }
    }
  );

  server.tool(
    "set_item_spacing",
    "Set spacing between children in auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z.array(itemSpacingItem)).describe("Array of {nodeId, itemSpacing?, counterAxisSpacing?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_item_spacing", params)); }
      catch (e) { return mcpError("Error setting item spacing", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

const LAYOUT_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

async function setLayoutModeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support layoutMode`);
  (node as any).layoutMode = p.layoutMode;
  if (p.layoutMode !== "NONE" && p.layoutWrap) (node as any).layoutWrap = p.layoutWrap;
  return {};
}

async function setPaddingSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support padding`);
  if ((node as any).layoutMode === "NONE") throw new Error("Padding requires auto-layout (layoutMode !== NONE)");
  if (p.paddingTop !== undefined) (node as any).paddingTop = p.paddingTop;
  if (p.paddingRight !== undefined) (node as any).paddingRight = p.paddingRight;
  if (p.paddingBottom !== undefined) (node as any).paddingBottom = p.paddingBottom;
  if (p.paddingLeft !== undefined) (node as any).paddingLeft = p.paddingLeft;
  return {};
}

async function setAxisAlignSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support axis alignment`);
  if ((node as any).layoutMode === "NONE") throw new Error("Axis alignment requires auto-layout");
  if (p.primaryAxisAlignItems !== undefined) (node as any).primaryAxisAlignItems = p.primaryAxisAlignItems;
  if (p.counterAxisAlignItems !== undefined) (node as any).counterAxisAlignItems = p.counterAxisAlignItems;
  return {};
}

async function setLayoutSizingSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (p.layoutSizingHorizontal !== undefined) (node as any).layoutSizingHorizontal = p.layoutSizingHorizontal;
  if (p.layoutSizingVertical !== undefined) (node as any).layoutSizingVertical = p.layoutSizingVertical;
  return {};
}

async function setItemSpacingSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!LAYOUT_TYPES.includes(node.type)) throw new Error(`Node type ${node.type} does not support item spacing`);
  if ((node as any).layoutMode === "NONE") throw new Error("Item spacing requires auto-layout");
  if (p.itemSpacing !== undefined) (node as any).itemSpacing = p.itemSpacing;
  if (p.counterAxisSpacing !== undefined) {
    if ((node as any).layoutWrap !== "WRAP") throw new Error("counterAxisSpacing requires layoutWrap=WRAP");
    (node as any).counterAxisSpacing = p.counterAxisSpacing;
  }
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_layout_mode: (p) => batchHandler(p, setLayoutModeSingle),
  set_padding: (p) => batchHandler(p, setPaddingSingle),
  set_axis_align: (p) => batchHandler(p, setAxisAlignSingle),
  set_layout_sizing: (p) => batchHandler(p, setLayoutSizingSingle),
  set_item_spacing: (p) => batchHandler(p, setItemSpacingSingle),
};
