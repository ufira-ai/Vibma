import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";

// ─── Schemas ─────────────────────────────────────────────────────

const moveItem = z.object({
  nodeId: S.nodeId,
  x: z.coerce.number().describe("New X"),
  y: z.coerce.number().describe("New Y"),
});
const resizeItem = z.object({
  nodeId: S.nodeId,
  width: z.coerce.number().positive().describe("New width"),
  height: z.coerce.number().positive().describe("New height"),
});
const deleteItem = z.object({
  nodeId: z.string().describe("Node ID to delete"),
});
const cloneItem = z.object({
  nodeId: z.string().describe("Node ID to clone"),
  parentId: z.string().optional().describe("Parent for the clone (e.g. a page ID). Defaults to same parent as original."),
  x: z.coerce.number().optional().describe("New X for clone. Omit to keep original position."),
  y: z.coerce.number().optional().describe("New Y for clone. Omit to keep original position."),
});
const insertItem = z.object({
  parentId: z.string().describe("Parent node ID"),
  childId: z.string().describe("Child node ID to move"),
  index: z.coerce.number().optional().describe("Index to insert at (0=first). Omit to append."),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "move_node",
    "Move nodes to new positions. Batch: pass multiple items.",
    { items: flexJson(z.array(moveItem)).describe("Array of {nodeId, x, y}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("move_node", params)); }
      catch (e) { return mcpError("Error moving nodes", e); }
    }
  );

  server.tool(
    "resize_node",
    "Resize nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(resizeItem)).describe("Array of {nodeId, width, height}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("resize_node", params)); }
      catch (e) { return mcpError("Error resizing nodes", e); }
    }
  );

  server.tool(
    "delete_node",
    "Delete nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(deleteItem)).describe("Array of {nodeId}") },
    async (params: any) => {
      try { return mcpJson(await sendCommand("delete_node", params)); }
      catch (e) { return mcpError("Error deleting nodes", e); }
    }
  );

  server.tool(
    "clone_node",
    "Clone nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(cloneItem)).describe("Array of {nodeId, x?, y?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("clone_node", params)); }
      catch (e) { return mcpError("Error cloning nodes", e); }
    }
  );

  server.tool(
    "insert_child",
    "Move nodes into a parent at a specific index (reorder/reparent). Batch: pass multiple items.",
    { items: flexJson(z.array(insertItem)).describe("Array of {parentId, childId, index?}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("insert_child", params)); }
      catch (e) { return mcpError("Error inserting children", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function moveSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("x" in node)) throw new Error(`Node does not support position: ${p.nodeId}`);
  (node as any).x = p.x;
  (node as any).y = p.y;
  return {};
}

async function resizeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if ("resize" in node) (node as any).resize(p.width, p.height);
  else if ("resizeWithoutConstraints" in node) (node as any).resizeWithoutConstraints(p.width, p.height);
  else throw new Error(`Node does not support resize: ${p.nodeId}`);
  return {};
}

async function deleteSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  node.remove();
  return {};
}

async function cloneSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  const clone = (node as any).clone();
  if (p.x !== undefined && "x" in clone) { clone.x = p.x; clone.y = p.y; }
  if (p.parentId) {
    const parent = await figma.getNodeByIdAsync(p.parentId);
    if (!parent || !("appendChild" in parent)) throw new Error(`Invalid parent: ${p.parentId}`);
    (parent as any).appendChild(clone);
  } else if (node.parent) {
    (node.parent as any).appendChild(clone);
  } else {
    figma.currentPage.appendChild(clone);
  }
  return { id: clone.id };
}

async function insertSingle(p: any) {
  const parent = await figma.getNodeByIdAsync(p.parentId);
  if (!parent) throw new Error(`Parent not found: ${p.parentId}`);
  if (!("insertChild" in parent)) throw new Error(`Parent does not support children: ${p.parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
  const child = await figma.getNodeByIdAsync(p.childId);
  if (!child) throw new Error(`Child not found: ${p.childId}`);
  if (p.index !== undefined) (parent as any).insertChild(p.index, child);
  else (parent as any).appendChild(child);
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  move_node: (p) => batchHandler(p, moveSingle),
  resize_node: (p) => batchHandler(p, resizeSingle),
  delete_node: (p) => batchHandler(p, deleteSingle),
  // Legacy alias
  delete_multiple_nodes: async (p) => batchHandler({ items: (p.nodeIds || []).map((id: string) => ({ nodeId: id })) }, deleteSingle),
  clone_node: (p) => batchHandler(p, cloneSingle),
  insert_child: (p) => batchHandler(p, insertSingle),
};
