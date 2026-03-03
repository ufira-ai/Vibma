import { z } from "zod";
import { flexJson, flexBool } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

const textContentItem = z.object({
  nodeId: z.string().describe("Text node ID"),
  text: z.string().describe("New text content"),
});

const scanTextItem = z.object({
  nodeId: S.nodeId,
  limit: z.coerce.number().optional().describe("Max text nodes to return (default: 50)"),
  includePath: flexBool(z.boolean()).optional().describe("Include ancestor path strings (default: true). Set false to reduce payload."),
  includeGeometry: flexBool(z.boolean()).optional().describe("Include absoluteX/absoluteY/width/height (default: true). Set false to reduce payload."),
});

export const tools: ToolDef[] = [
  {
    name: "set_text_content",
    description: "Set text content on text nodes. Batch: pass multiple items to replace text in multiple nodes at once.",
    schema: { items: flexJson(z.array(textContentItem)).describe("Array of {nodeId, text}"), depth: S.depth },
    tier: "edit",
  },
  {
    name: "scan_text_nodes",
    description: "Scan all text nodes within a node tree. Batch: pass multiple items.",
    schema: { items: flexJson(z.array(scanTextItem)).describe("Array of {nodeId}") },
    tier: "read",
  },
];
