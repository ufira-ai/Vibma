import { z } from "zod";
import { flexJson, flexBool } from "../../utils/coercion";
import type { ToolDef } from "../types";

export const tools: ToolDef[] = [
  {
    name: "get_node_info",
    description: "Get detailed information about one or more nodes. Always pass an array of IDs. Use `fields` to select only the properties you need (reduces context size).",
    schema: {
      nodeIds: flexJson(z.array(z.string())).describe('Array of node IDs. Example: ["1:2","1:3"]'),
      depth: z.coerce.number().optional().describe("Child recursion depth (default: unlimited). 0=stubs only."),
      fields: flexJson(z.array(z.string())).optional().describe('Whitelist of property names to include. Example: ["absoluteBoundingBox","layoutMode","fills"]. Omit to return all properties.'),
    },
    tier: "read",
  },
  {
    name: "search_nodes",
    description: "Search nodes on the current page by name and/or type. Use set_current_page first to search other pages. Paginated (default 50).",
    schema: {
      query: z.string().optional().describe("Name search (case-insensitive substring). Omit to match all names."),
      types: flexJson(z.array(z.string())).optional().describe('Filter by types. Example: ["FRAME","TEXT"]. Omit to match all types.'),
      scopeNodeId: z.string().optional().describe("Node ID to search within (defaults to current page)"),
      caseSensitive: flexBool(z.boolean()).optional().describe("Case-sensitive name match (default false)"),
      limit: z.coerce.number().optional().describe("Max results (default 50)"),
      offset: z.coerce.number().optional().describe("Skip N results for pagination (default 0)"),
    },
    tier: "read",
  },
  {
    name: "export_node_as_image",
    description: "Export a node as an image from Figma",
    schema: {
      nodeId: z.string().describe("The node ID to export"),
      format: z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format (default: PNG)"),
      scale: z.coerce.number().positive().optional().describe("Export scale (default: 1)"),
    },
    tier: "read",
    formatResponse: (result: unknown) => {
      const r = result as any;
      return {
        content: [{ type: "image" as const, data: r.imageData, mimeType: r.mimeType || "image/png" }],
      };
    },
  },
];
