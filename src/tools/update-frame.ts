import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";

// ─── Schema ──────────────────────────────────────────────────────

const updateFrameItem = z.object({
  nodeId: S.nodeId,
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction"),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
  paddingTop: z.coerce.number().optional().describe("Top padding"),
  paddingRight: z.coerce.number().optional().describe("Right padding"),
  paddingBottom: z.coerce.number().optional().describe("Bottom padding"),
  paddingLeft: z.coerce.number().optional().describe("Left padding"),
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment"),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment"),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (works on any node in auto-layout)"),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (works on any node in auto-layout)"),
  itemSpacing: z.coerce.number().optional().describe("Spacing between children"),
  counterAxisSpacing: z.coerce.number().optional().describe("Spacing between wrapped rows/columns (WRAP only)"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "update_frame",
    "Update layout properties on frames. Combines layout mode, padding, alignment, sizing, and spacing in one call. Batch: pass multiple items.",
    { items: flexJson(z.array(updateFrameItem)).describe("Array of {nodeId, ...layout properties}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("update_frame", params)); }
      catch (e) { return mcpError("Error updating frame", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

const LAYOUT_TYPES = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"];

async function updateFrameSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);

  const isLayoutType = LAYOUT_TYPES.includes(node.type);
  const settingLayoutMode = p.layoutMode !== undefined;
  // Auto-layout is active if already set OR being set in this call
  const hasAutoLayout = settingLayoutMode
    ? p.layoutMode !== "NONE"
    : (isLayoutType && (node as any).layoutMode !== "NONE");

  // 1. Layout mode & wrap
  if (settingLayoutMode) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support layoutMode`);
    (node as any).layoutMode = p.layoutMode;
    if (p.layoutMode !== "NONE" && p.layoutWrap) (node as any).layoutWrap = p.layoutWrap;
  } else if (p.layoutWrap !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support layoutWrap`);
    if (!hasAutoLayout) throw new Error("layoutWrap requires auto-layout (layoutMode !== NONE)");
    (node as any).layoutWrap = p.layoutWrap;
  }

  // 2. Padding
  const hasPadding = p.paddingTop !== undefined || p.paddingRight !== undefined ||
                     p.paddingBottom !== undefined || p.paddingLeft !== undefined;
  if (hasPadding) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support padding`);
    if (!hasAutoLayout) throw new Error("Padding requires auto-layout (layoutMode !== NONE)");
    if (p.paddingTop !== undefined) (node as any).paddingTop = p.paddingTop;
    if (p.paddingRight !== undefined) (node as any).paddingRight = p.paddingRight;
    if (p.paddingBottom !== undefined) (node as any).paddingBottom = p.paddingBottom;
    if (p.paddingLeft !== undefined) (node as any).paddingLeft = p.paddingLeft;
  }

  // 3. Alignment
  if (p.primaryAxisAlignItems !== undefined || p.counterAxisAlignItems !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support axis alignment`);
    if (!hasAutoLayout) throw new Error("Axis alignment requires auto-layout (layoutMode !== NONE)");
    if (p.primaryAxisAlignItems !== undefined) (node as any).primaryAxisAlignItems = p.primaryAxisAlignItems;
    if (p.counterAxisAlignItems !== undefined) (node as any).counterAxisAlignItems = p.counterAxisAlignItems;
  }

  // 4. Sizing (no type check — works on any node in auto-layout)
  if (p.layoutSizingHorizontal !== undefined) (node as any).layoutSizingHorizontal = p.layoutSizingHorizontal;
  if (p.layoutSizingVertical !== undefined) (node as any).layoutSizingVertical = p.layoutSizingVertical;

  // 5. Spacing
  if (p.itemSpacing !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support item spacing`);
    if (!hasAutoLayout) throw new Error("Item spacing requires auto-layout (layoutMode !== NONE)");
    (node as any).itemSpacing = p.itemSpacing;
  }
  if (p.counterAxisSpacing !== undefined) {
    if (!isLayoutType) throw new Error(`Node type ${node.type} does not support counter-axis spacing`);
    if (!hasAutoLayout) throw new Error("Counter-axis spacing requires auto-layout");
    const wrap = p.layoutWrap || (node as any).layoutWrap;
    if (wrap !== "WRAP") throw new Error("counterAxisSpacing requires layoutWrap=WRAP");
    (node as any).counterAxisSpacing = p.counterAxisSpacing;
  }

  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  update_frame: (p) => batchHandler(p, updateFrameSingle),
};
