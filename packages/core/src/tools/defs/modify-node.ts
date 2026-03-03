import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

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

export const tools: ToolDef[] = [
  {
    name: "delete_node",
    description: "Delete nodes. Batch: pass multiple items.",
    schema: { items: flexJson(z.array(deleteItem)).describe("Array of {nodeId}") },
    tier: "edit",
  },
  {
    name: "clone_node",
    description: "Clone nodes. Batch: pass multiple items.",
    schema: { items: flexJson(z.array(cloneItem)).describe("Array of {nodeId, x?, y?}"), depth: S.depth },
    tier: "create",
  },
  {
    name: "insert_child",
    description: "Move nodes into a parent at a specific index (reorder/reparent). Batch: pass multiple items.",
    schema: { items: flexJson(z.array(insertItem)).describe("Array of {parentId, childId, index?}"), depth: S.depth },
    tier: "edit",
  },
];
