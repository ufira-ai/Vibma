#!/usr/bin/env node
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// src/utils/color.ts
var init_color = __esm({
  "src/utils/color.ts"() {
  }
});

// src/utils/filter-node.ts
var init_filter_node = __esm({
  "src/utils/filter-node.ts"() {
    init_color();
  }
});

// src/tools/helpers.ts
var init_helpers = __esm({
  "src/tools/helpers.ts"() {
    init_filter_node();
  }
});

// src/talk_to_figma_mcp/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z as z19 } from "zod";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

// src/tools/document.ts
import { z } from "zod";

// src/tools/types.ts
var MAX_RESPONSE_CHARS = 5e4;
function mcpJson(data) {
  const text = JSON.stringify(data);
  if (text.length <= MAX_RESPONSE_CHARS) {
    return { content: [{ type: "text", text }] };
  }
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        _error: "response_too_large",
        _sizeKB: Math.round(text.length / 1024),
        _hint: "Response exceeds safe size. Use 'depth', 'fields', 'limit', or 'summaryOnly' parameters to reduce response size."
      })
    }]
  };
}
function mcpError(prefix, error) {
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `${prefix}: ${msg}` }] };
}

// src/tools/document.ts
function registerMcpTools(server2, sendCommand) {
  server2.tool(
    "get_document_info",
    "Get the document name, current page, and list of all pages.",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_document_info"));
      } catch (e) {
        return mcpError("Error getting document info", e);
      }
    }
  );
  server2.tool(
    "get_current_page",
    "Get the current page info and its top-level children. Always safe \u2014 never touches unloaded pages.",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_current_page"));
      } catch (e) {
        return mcpError("Error getting current page", e);
      }
    }
  );
  server2.tool(
    "get_pages",
    "Get all pages in the document with their IDs, names, and child counts.",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_pages"));
      } catch (e) {
        return mcpError("Error getting pages", e);
      }
    }
  );
  server2.tool(
    "set_current_page",
    "Switch to a different page. Provide either pageId or pageName.",
    {
      pageId: z.string().optional().describe("The page ID to switch to"),
      pageName: z.string().optional().describe("The page name (case-insensitive, partial match)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_current_page", params));
      } catch (e) {
        return mcpError("Error setting current page", e);
      }
    }
  );
  server2.tool(
    "create_page",
    "Create a new page in the document",
    { name: z.string().optional().describe("Name for the new page (default: 'New Page')") },
    async ({ name }) => {
      try {
        return mcpJson(await sendCommand("create_page", { name }));
      } catch (e) {
        return mcpError("Error creating page", e);
      }
    }
  );
  server2.tool(
    "rename_page",
    "Rename a page. Defaults to current page if no pageId given.",
    {
      newName: z.string().describe("New name for the page"),
      pageId: z.string().optional().describe("Page ID (default: current page)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("rename_page", params));
      } catch (e) {
        return mcpError("Error renaming page", e);
      }
    }
  );
}

// src/tools/selection.ts
import { z as z3 } from "zod";

// src/utils/coercion.ts
import { z as z2 } from "zod";
var flexBool = (inner) => z2.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, inner);
var flexJson = (inner) => z2.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}, inner);
var flexNum = (inner) => z2.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v);
    if (!isNaN(n) && v.trim() !== "") return n;
  }
  return v;
}, inner);

// src/tools/selection.ts
function registerMcpTools2(server2, sendCommand) {
  server2.tool(
    "get_selection",
    "Get information about the current selection in Figma",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_selection"));
      } catch (e) {
        return mcpError("Error getting selection", e);
      }
    }
  );
  server2.tool(
    "read_my_design",
    "Get detailed information about the current selection, including all node details. Use depth to control traversal.",
    { depth: z3.coerce.number().optional().describe("Levels of children to recurse. 0=selection only, -1 or omit for unlimited.") },
    async ({ depth: depth2 }) => {
      try {
        return mcpJson(await sendCommand("read_my_design", { depth: depth2 }));
      } catch (e) {
        return mcpError("Error reading design", e);
      }
    }
  );
  server2.tool(
    "set_selection",
    "Set selection to nodes and scroll viewport to show them. Also works as focus (single node).",
    {
      nodeIds: flexJson(z3.array(z3.string())).describe('Array of node IDs to select. Example: ["1:2","1:3"]')
    },
    async ({ nodeIds: nodeIds2 }) => {
      try {
        return mcpJson(await sendCommand("set_selection", { nodeIds: nodeIds2 }));
      } catch (e) {
        return mcpError("Error setting selection", e);
      }
    }
  );
  server2.tool(
    "zoom_into_view",
    "Zoom the viewport to fit specific nodes (like pressing Shift+1)",
    {
      nodeIds: flexJson(z3.array(z3.string())).describe("Array of node IDs to zoom into")
    },
    async ({ nodeIds: nodeIds2 }) => {
      try {
        return mcpJson(await sendCommand("zoom_into_view", { nodeIds: nodeIds2 }));
      } catch (e) {
        return mcpError("Error zooming", e);
      }
    }
  );
  server2.tool(
    "set_viewport",
    "Set viewport center position and/or zoom level",
    {
      center: flexJson(z3.object({ x: z3.coerce.number(), y: z3.coerce.number() }).optional()).describe("Viewport center point. Omit to keep current center."),
      zoom: z3.coerce.number().optional().describe("Zoom level (1 = 100%). Omit to keep current zoom.")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_viewport", params));
      } catch (e) {
        return mcpError("Error setting viewport", e);
      }
    }
  );
}

// src/tools/node-info.ts
import { z as z4 } from "zod";
init_filter_node();
function registerMcpTools3(server2, sendCommand) {
  server2.tool(
    "get_node_info",
    "Get detailed information about one or more nodes. Always pass an array of IDs. Use `fields` to select only the properties you need (reduces context size).",
    {
      nodeIds: flexJson(z4.array(z4.string())).describe('Array of node IDs. Example: ["1:2","1:3"]'),
      depth: z4.coerce.number().optional().describe("Child recursion depth (default: unlimited). 0=stubs only."),
      fields: flexJson(z4.array(z4.string()).optional()).describe('Whitelist of property names to include. Always includes id, name, type. Example: ["absoluteBoundingBox","layoutMode","fills"]. Omit to return all properties.')
    },
    async (params) => {
      try {
        const result = await sendCommand("get_node_info", params);
        return mcpJson(result);
      } catch (e) {
        return mcpError("Error getting node info", e);
      }
    }
  );
  server2.tool(
    "get_node_css",
    "Get CSS properties for a node (useful for dev handoff)",
    { nodeId: z4.string().describe("The node ID to get CSS for") },
    async ({ nodeId: nodeId2 }) => {
      try {
        return mcpJson(await sendCommand("get_node_css", { nodeId: nodeId2 }));
      } catch (e) {
        return mcpError("Error getting CSS", e);
      }
    }
  );
  server2.tool(
    "search_nodes",
    "Search for nodes by layer name and/or type. Searches current page only \u2014 use set_current_page to switch pages first. Matches layer names (text nodes are often auto-named from their content). Returns paginated results.",
    {
      query: z4.string().optional().describe("Name search (case-insensitive substring). Omit to match all names."),
      types: flexJson(z4.array(z4.string()).optional()).describe('Filter by types. Example: ["FRAME","TEXT"]. Omit to match all types.'),
      scopeNodeId: z4.string().optional().describe("Node ID to search within (defaults to current page)"),
      caseSensitive: flexBool(z4.boolean().optional()).describe("Case-sensitive name match (default false)"),
      limit: z4.coerce.number().optional().describe("Max results (default 50)"),
      offset: z4.coerce.number().optional().describe("Skip N results for pagination (default 0)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("search_nodes", params));
      } catch (e) {
        return mcpError("Error searching nodes", e);
      }
    }
  );
  server2.tool(
    "export_node_as_image",
    "Export a node as an image from Figma",
    {
      nodeId: z4.string().describe("The node ID to export"),
      format: z4.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format (default: PNG)"),
      scale: z4.coerce.number().positive().optional().describe("Export scale (default: 1)")
    },
    async ({ nodeId: nodeId2, format, scale }) => {
      try {
        const result = await sendCommand("export_node_as_image", { nodeId: nodeId2, format, scale });
        return {
          content: [{ type: "image", data: result.imageData, mimeType: result.mimeType || "image/png" }]
        };
      } catch (e) {
        return mcpError("Error exporting image", e);
      }
    }
  );
}

// src/tools/create-shape.ts
import { z as z6 } from "zod";

// src/tools/schemas.ts
import { z as z5 } from "zod";
var nodeId = z5.string().describe("Node ID");
var nodeIds = flexJson(z5.array(z5.string())).describe("Array of node IDs");
var parentId = z5.string().optional().describe("Parent node ID. Omit to place on current page.");
var depth = z5.coerce.number().optional().describe("Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited.");
var xPos = z5.coerce.number().optional().describe("X position (default: 0)");
var yPos = z5.coerce.number().optional().describe("Y position (default: 0)");
function parseHex(hex) {
  const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  if (h.length === 8) return { r, g, b, a: parseInt(h.slice(6, 8), 16) / 255 };
  return { r, g, b };
}
var colorRgba = z5.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, z5.object({
  r: z5.coerce.number().min(0).max(1),
  g: z5.coerce.number().min(0).max(1),
  b: z5.coerce.number().min(0).max(1),
  a: z5.coerce.number().min(0).max(1).optional()
}));
var effectEntry = z5.object({
  type: z5.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
  color: flexJson(colorRgba.optional()),
  offset: flexJson(z5.object({ x: z5.coerce.number(), y: z5.coerce.number() }).optional()),
  radius: z5.coerce.number(),
  spread: z5.coerce.number().optional(),
  visible: flexBool(z5.boolean().optional()),
  blendMode: z5.string().optional()
});

// src/tools/create-shape.ts
init_helpers();
var rectItem = z6.object({
  name: z6.string().optional().describe("Name (default: 'Rectangle')"),
  x: xPos,
  y: yPos,
  width: z6.coerce.number().optional().describe("Width (default: 100)"),
  height: z6.coerce.number().optional().describe("Height (default: 100)"),
  parentId
});
var ellipseItem = z6.object({
  name: z6.string().optional().describe("Layer name (default: 'Ellipse')"),
  x: xPos,
  y: yPos,
  width: z6.coerce.number().optional().describe("Width (default: 100)"),
  height: z6.coerce.number().optional().describe("Height (default: 100)"),
  parentId
});
var lineItem = z6.object({
  name: z6.string().optional().describe("Layer name (default: 'Line')"),
  x: xPos,
  y: yPos,
  length: z6.coerce.number().optional().describe("Length (default: 100)"),
  rotation: z6.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
  parentId
});
var sectionItem = z6.object({
  name: z6.string().optional().describe("Name (default: 'Section')"),
  x: xPos,
  y: yPos,
  width: z6.coerce.number().optional().describe("Width (default: 500)"),
  height: z6.coerce.number().optional().describe("Height (default: 500)"),
  parentId
});
var svgItem = z6.object({
  svg: z6.string().describe("SVG markup string"),
  name: z6.string().optional().describe("Layer name (default: 'SVG')"),
  x: xPos,
  y: yPos,
  parentId
});
var boolOpItem = z6.object({
  nodeIds: flexJson(z6.array(z6.string())).describe("Array of node IDs (min 2)"),
  operation: z6.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
  name: z6.string().optional().describe("Name for the result. Omit to auto-generate.")
});
function registerMcpTools4(server2, sendCommand) {
  server2.tool(
    "create_rectangle",
    "Create rectangles (leaf nodes \u2014 cannot have children). For containers/cards/panels, use create_frame instead. Batch: pass multiple items.",
    { items: flexJson(z6.array(rectItem)).describe("Array of rectangles to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_rectangle", params));
      } catch (e) {
        return mcpError("Error creating rectangles", e);
      }
    }
  );
  server2.tool(
    "create_ellipse",
    "Create ellipses (leaf nodes \u2014 cannot have children). For circular containers, use create_frame with cornerRadius instead. Batch: pass multiple items.",
    { items: flexJson(z6.array(ellipseItem)).describe("Array of ellipses to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_ellipse", params));
      } catch (e) {
        return mcpError("Error creating ellipses", e);
      }
    }
  );
  server2.tool(
    "create_line",
    "Create lines (leaf nodes \u2014 cannot have children). For dividers inside layouts, use create_frame with a thin height and fill color instead. Batch: pass multiple items.",
    { items: flexJson(z6.array(lineItem)).describe("Array of lines to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_line", params));
      } catch (e) {
        return mcpError("Error creating lines", e);
      }
    }
  );
  server2.tool(
    "create_section",
    "Create section nodes to organize content on the canvas.",
    { items: flexJson(z6.array(sectionItem)).describe("Array of sections to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_section", params));
      } catch (e) {
        return mcpError("Error creating sections", e);
      }
    }
  );
  server2.tool(
    "create_node_from_svg",
    "Create nodes from SVG strings.",
    { items: flexJson(z6.array(svgItem)).describe("Array of SVG items to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_node_from_svg", params));
      } catch (e) {
        return mcpError("Error creating SVG nodes", e);
      }
    }
  );
  server2.tool(
    "create_boolean_operation",
    "Create a boolean operation (union, intersect, subtract, exclude) from multiple nodes.",
    { items: flexJson(z6.array(boolOpItem)).describe("Array of boolean operations to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_boolean_operation", params));
      } catch (e) {
        return mcpError("Error creating boolean operations", e);
      }
    }
  );
}

// src/tools/create-frame.ts
import { z as z7 } from "zod";
init_helpers();
var frameItem = z7.object({
  name: z7.string().optional().describe("Frame name (default: 'Frame')"),
  x: xPos,
  y: yPos,
  width: z7.coerce.number().optional().describe("Width (default: 100)"),
  height: z7.coerce.number().optional().describe("Height (default: 100)"),
  parentId,
  fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: no fill (empty fills array).'),
  strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: none.'),
  strokeWeight: z7.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: z7.coerce.number().min(0).optional().describe("Corner radius (default: 0)"),
  layoutMode: z7.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
  layoutWrap: z7.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
  paddingTop: z7.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z7.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z7.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z7.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z7.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z7.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z7.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z7.enum(["FIXED", "HUG", "FILL"]).optional(),
  itemSpacing: z7.coerce.number().optional().describe("Spacing between children (default: 0)"),
  // Style/variable references
  fillStyleName: z7.string().optional().describe("Apply a fill paint style by name (case-insensitive). Omit to skip."),
  strokeStyleName: z7.string().optional().describe("Apply a stroke paint style by name. Omit to skip."),
  fillVariableId: z7.string().optional().describe("Bind a color variable to the fill. Creates a solid fill and binds the variable to fills/0/color."),
  strokeVariableId: z7.string().optional().describe("Bind a color variable to the stroke. Creates a solid stroke and binds the variable to strokes/0/color.")
});
var autoLayoutItem = z7.object({
  nodeIds: flexJson(z7.array(z7.string())).describe("Array of node IDs to wrap"),
  name: z7.string().optional().describe("Frame name (default: 'Auto Layout')"),
  layoutMode: z7.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Direction (default: VERTICAL)"),
  itemSpacing: z7.coerce.number().optional().describe("Spacing between children (default: 0)"),
  paddingTop: z7.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z7.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z7.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z7.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z7.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: z7.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: z7.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z7.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutWrap: z7.enum(["NO_WRAP", "WRAP"]).optional()
});
function registerMcpTools5(server2, sendCommand) {
  server2.tool(
    "create_frame",
    "Create frames in Figma. Supports batch. Prefer fillStyleName or fillVariableId over hardcoded fillColor for design token consistency.",
    { items: flexJson(z7.array(frameItem)).describe("Array of frames to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_frame", params));
      } catch (e) {
        return mcpError("Error creating frames", e);
      }
    }
  );
  server2.tool(
    "create_auto_layout",
    "Wrap existing nodes in an auto-layout frame. One call replaces create_frame + set_layout_mode + insert_child \xD7 N.",
    { items: flexJson(z7.array(autoLayoutItem)).describe("Array of auto-layout wraps to perform"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_auto_layout", params));
      } catch (e) {
        return mcpError("Error creating auto layout", e);
      }
    }
  );
}

// src/tools/create-text.ts
import { z as z8 } from "zod";
init_helpers();
var textItem = z8.object({
  text: z8.string().describe("Text content"),
  name: z8.string().optional().describe("Layer name (default: text content)"),
  x: xPos,
  y: yPos,
  fontSize: z8.coerce.number().optional().describe("Font size (default: 14)"),
  fontWeight: z8.coerce.number().optional().describe("Font weight: 100-900 (default: 400)"),
  fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000000" or {r,g,b,a?} 0-1. Default: black.'),
  fontColorVariableId: z8.string().optional().describe("Bind a color variable to the text fill instead of hardcoded fontColor."),
  parentId,
  textStyleId: z8.string().optional().describe("Text style ID to apply (overrides fontSize/fontWeight). Omit to skip."),
  textStyleName: z8.string().optional().describe("Text style name (case-insensitive match). Omit to skip."),
  layoutSizingHorizontal: z8.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. FILL auto-sets textAutoResize to HEIGHT."),
  layoutSizingVertical: z8.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
  textAutoResize: z8.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior (default: WIDTH_AND_HEIGHT when FILL)")
});
function registerMcpTools6(server2, sendCommand) {
  server2.tool(
    "create_text",
    "Create text nodes in Figma. Uses Inter font. Max 10 items per batch. Use textStyleName to apply styles by name.",
    { items: flexJson(z8.array(textItem).max(10)).describe("Array of text nodes to create (max 10)"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_text", params));
      } catch (e) {
        return mcpError("Error creating text", e);
      }
    }
  );
}

// src/tools/modify-node.ts
import { z as z9 } from "zod";
init_helpers();
var moveItem = z9.object({
  nodeId,
  x: z9.coerce.number().describe("New X"),
  y: z9.coerce.number().describe("New Y")
});
var resizeItem = z9.object({
  nodeId,
  width: z9.coerce.number().positive().describe("New width"),
  height: z9.coerce.number().positive().describe("New height")
});
var deleteItem = z9.object({
  nodeId: z9.string().describe("Node ID to delete")
});
var cloneItem = z9.object({
  nodeId: z9.string().describe("Node ID to clone"),
  parentId: z9.string().optional().describe("Parent for the clone (e.g. a page ID). Defaults to same parent as original."),
  x: z9.coerce.number().optional().describe("New X for clone. Omit to keep original position."),
  y: z9.coerce.number().optional().describe("New Y for clone. Omit to keep original position.")
});
var insertItem = z9.object({
  parentId: z9.string().describe("Parent node ID"),
  childId: z9.string().describe("Child node ID to move"),
  index: z9.coerce.number().optional().describe("Index to insert at (0=first). Omit to append.")
});
function registerMcpTools7(server2, sendCommand) {
  server2.tool(
    "move_node",
    "Move nodes to new positions. Batch: pass multiple items.",
    { items: flexJson(z9.array(moveItem)).describe("Array of {nodeId, x, y}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("move_node", params));
      } catch (e) {
        return mcpError("Error moving nodes", e);
      }
    }
  );
  server2.tool(
    "resize_node",
    "Resize nodes. Batch: pass multiple items.",
    { items: flexJson(z9.array(resizeItem)).describe("Array of {nodeId, width, height}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("resize_node", params));
      } catch (e) {
        return mcpError("Error resizing nodes", e);
      }
    }
  );
  server2.tool(
    "delete_node",
    "Delete nodes. Batch: pass multiple items.",
    { items: flexJson(z9.array(deleteItem)).describe("Array of {nodeId}") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("delete_node", params));
      } catch (e) {
        return mcpError("Error deleting nodes", e);
      }
    }
  );
  server2.tool(
    "clone_node",
    "Clone nodes. Batch: pass multiple items.",
    { items: flexJson(z9.array(cloneItem)).describe("Array of {nodeId, x?, y?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("clone_node", params));
      } catch (e) {
        return mcpError("Error cloning nodes", e);
      }
    }
  );
  server2.tool(
    "insert_child",
    "Move nodes into a parent at a specific index (reorder/reparent). Batch: pass multiple items.",
    { items: flexJson(z9.array(insertItem)).describe("Array of {parentId, childId, index?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("insert_child", params));
      } catch (e) {
        return mcpError("Error inserting children", e);
      }
    }
  );
}

// src/tools/fill-stroke.ts
import { z as z10 } from "zod";
init_helpers();
var fillItem = z10.object({
  nodeId,
  color: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  styleName: z10.string().optional().describe("Apply fill paint style by name instead of color. Omit to use color.")
});
var strokeItem = z10.object({
  nodeId,
  color: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  strokeWeight: z10.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  styleName: z10.string().optional().describe("Apply stroke paint style by name instead of color. Omit to use color.")
});
var cornerItem = z10.object({
  nodeId,
  radius: z10.coerce.number().min(0).describe("Corner radius"),
  corners: flexJson(z10.array(flexBool(z10.boolean())).length(4).optional()).describe("Which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Default: all corners [true,true,true,true].")
});
var opacityItem = z10.object({
  nodeId,
  opacity: z10.coerce.number().min(0).max(1).describe("Opacity (0-1)")
});
function registerMcpTools8(server2, sendCommand) {
  server2.tool(
    "set_fill_color",
    "Set fill color on nodes. Use styleName to apply a paint style by name, or provide color directly. Batch: pass multiple items.",
    { items: flexJson(z10.array(fillItem)).describe("Array of {nodeId, color?, styleName?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_fill_color", params));
      } catch (e) {
        return mcpError("Error setting fill", e);
      }
    }
  );
  server2.tool(
    "set_stroke_color",
    "Set stroke color on nodes. Use styleName to apply a paint style by name. Batch: pass multiple items.",
    { items: flexJson(z10.array(strokeItem)).describe("Array of {nodeId, color?, strokeWeight?, styleName?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_stroke_color", params));
      } catch (e) {
        return mcpError("Error setting stroke", e);
      }
    }
  );
  server2.tool(
    "set_corner_radius",
    "Set corner radius on nodes. Batch: pass multiple items.",
    { items: flexJson(z10.array(cornerItem)).describe("Array of {nodeId, radius, corners?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_corner_radius", params));
      } catch (e) {
        return mcpError("Error setting corner radius", e);
      }
    }
  );
  server2.tool(
    "set_opacity",
    "Set opacity on nodes. Batch: pass multiple items.",
    { items: flexJson(z10.array(opacityItem)).describe("Array of {nodeId, opacity}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_opacity", params));
      } catch (e) {
        return mcpError("Error setting opacity", e);
      }
    }
  );
}

// src/tools/layout.ts
import { z as z11 } from "zod";
init_helpers();
var layoutModeItem = z11.object({
  nodeId,
  layoutMode: z11.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode"),
  layoutWrap: z11.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)")
});
var paddingItem = z11.object({
  nodeId,
  paddingTop: z11.coerce.number().optional().describe("Top padding (default: unchanged)"),
  paddingRight: z11.coerce.number().optional().describe("Right padding (default: unchanged)"),
  paddingBottom: z11.coerce.number().optional().describe("Bottom padding (default: unchanged)"),
  paddingLeft: z11.coerce.number().optional().describe("Left padding (default: unchanged)")
});
var axisAlignItem = z11.object({
  nodeId,
  primaryAxisAlignItems: z11.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment"),
  counterAxisAlignItems: z11.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment")
});
var layoutSizingItem = z11.object({
  nodeId,
  layoutSizingHorizontal: z11.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z11.enum(["FIXED", "HUG", "FILL"]).optional()
});
var itemSpacingItem = z11.object({
  nodeId,
  itemSpacing: z11.coerce.number().optional().describe("Distance between children. Default: unchanged."),
  counterAxisSpacing: z11.coerce.number().optional().describe("Distance between wrapped rows/columns (WRAP only). Default: unchanged.")
});
function registerMcpTools9(server2, sendCommand) {
  server2.tool(
    "set_layout_mode",
    "Set layout mode and wrap on frames. Batch: pass multiple items.",
    { items: flexJson(z11.array(layoutModeItem)).describe("Array of {nodeId, layoutMode, layoutWrap?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_layout_mode", params));
      } catch (e) {
        return mcpError("Error setting layout mode", e);
      }
    }
  );
  server2.tool(
    "set_padding",
    "Set padding on auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z11.array(paddingItem)).describe("Array of {nodeId, paddingTop?, paddingRight?, paddingBottom?, paddingLeft?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_padding", params));
      } catch (e) {
        return mcpError("Error setting padding", e);
      }
    }
  );
  server2.tool(
    "set_axis_align",
    "Set primary/counter axis alignment on auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z11.array(axisAlignItem)).describe("Array of {nodeId, primaryAxisAlignItems?, counterAxisAlignItems?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_axis_align", params));
      } catch (e) {
        return mcpError("Error setting axis alignment", e);
      }
    }
  );
  server2.tool(
    "set_layout_sizing",
    "Set horizontal/vertical sizing modes on auto-layout nodes. Batch: pass multiple items.",
    { items: flexJson(z11.array(layoutSizingItem)).describe("Array of {nodeId, layoutSizingHorizontal?, layoutSizingVertical?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_layout_sizing", params));
      } catch (e) {
        return mcpError("Error setting layout sizing", e);
      }
    }
  );
  server2.tool(
    "set_item_spacing",
    "Set spacing between children in auto-layout frames. Batch: pass multiple items.",
    { items: flexJson(z11.array(itemSpacingItem)).describe("Array of {nodeId, itemSpacing?, counterAxisSpacing?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_item_spacing", params));
      } catch (e) {
        return mcpError("Error setting item spacing", e);
      }
    }
  );
}

// src/tools/effects.ts
import { z as z12 } from "zod";
init_helpers();
var effectItem = z12.object({
  nodeId,
  effects: flexJson(z12.array(effectEntry).optional()).describe("Array of effect objects. Ignored when effectStyleName is set."),
  effectStyleName: z12.string().optional().describe("Apply an effect style by name (case-insensitive). Omit to use raw effects.")
});
var constraintItem = z12.object({
  nodeId,
  horizontal: z12.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
  vertical: z12.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"])
});
var exportSettingEntry = z12.object({
  format: z12.enum(["PNG", "JPG", "SVG", "PDF"]),
  suffix: z12.string().optional(),
  contentsOnly: flexBool(z12.boolean().optional()),
  constraint: flexJson(z12.object({
    type: z12.enum(["SCALE", "WIDTH", "HEIGHT"]),
    value: z12.coerce.number()
  }).optional())
});
var exportSettingsItem = z12.object({
  nodeId,
  settings: flexJson(z12.array(exportSettingEntry)).describe("Export settings array")
});
var nodePropertiesItem = z12.object({
  nodeId,
  properties: flexJson(z12.record(z12.unknown())).describe("Key-value properties to set")
});
function registerMcpTools10(server2, sendCommand) {
  server2.tool(
    "set_effects",
    "Set effects (shadows, blurs) on nodes. Use effectStyleName to apply by name, or provide raw effects. Batch: pass multiple items.",
    { items: flexJson(z12.array(effectItem)).describe("Array of {nodeId, effects}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_effects", params));
      } catch (e) {
        return mcpError("Error setting effects", e);
      }
    }
  );
  server2.tool(
    "set_constraints",
    "Set constraints on nodes. Batch: pass multiple items.",
    { items: flexJson(z12.array(constraintItem)).describe("Array of {nodeId, horizontal, vertical}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_constraints", params));
      } catch (e) {
        return mcpError("Error setting constraints", e);
      }
    }
  );
  server2.tool(
    "set_export_settings",
    "Set export settings on nodes. Batch: pass multiple items.",
    { items: flexJson(z12.array(exportSettingsItem)).describe("Array of {nodeId, settings}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_export_settings", params));
      } catch (e) {
        return mcpError("Error setting export settings", e);
      }
    }
  );
  server2.tool(
    "set_node_properties",
    "Set arbitrary properties on nodes. Batch: pass multiple items.",
    { items: flexJson(z12.array(nodePropertiesItem)).describe("Array of {nodeId, properties}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_node_properties", params));
      } catch (e) {
        return mcpError("Error setting node properties", e);
      }
    }
  );
}

// src/tools/text.ts
import { z as z13 } from "zod";
init_helpers();
var textContentItem = z13.object({
  nodeId: z13.string().describe("Text node ID"),
  text: z13.string().describe("New text content")
});
var textPropsItem = z13.object({
  nodeId: z13.string().describe("Text node ID"),
  fontSize: z13.coerce.number().optional().describe("Font size"),
  fontWeight: z13.coerce.number().optional().describe("Font weight: 100-900"),
  fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000" or {r,g,b,a?} 0-1.'),
  textStyleId: z13.string().optional().describe("Text style ID to apply (overrides font props)"),
  textStyleName: z13.string().optional().describe("Text style name (case-insensitive match)"),
  textAutoResize: z13.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional(),
  layoutSizingHorizontal: z13.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: z13.enum(["FIXED", "HUG", "FILL"]).optional()
});
var scanTextItem = z13.object({
  nodeId,
  limit: z13.coerce.number().optional().describe("Max text nodes to return (default: 50)"),
  includePath: flexBool(z13.boolean().optional()).describe("Include ancestor path strings (default: true). Set false to reduce payload."),
  includeGeometry: flexBool(z13.boolean().optional()).describe("Include absoluteX/absoluteY/width/height (default: true). Set false to reduce payload.")
});
function registerMcpTools11(server2, sendCommand) {
  server2.tool(
    "set_text_content",
    "Set text content on text nodes. Batch: pass multiple items to replace text in multiple nodes at once.",
    { items: flexJson(z13.array(textContentItem)).describe("Array of {nodeId, text}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_text_content", params));
      } catch (e) {
        return mcpError("Error setting text content", e);
      }
    }
  );
  server2.tool(
    "set_text_properties",
    "Set font properties on existing text nodes (fontSize, fontWeight, fontColor, textStyle). Batch: pass multiple items.",
    { items: flexJson(z13.array(textPropsItem)).describe("Array of {nodeId, fontSize?, fontWeight?, fontColor?, ...}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("set_text_properties", params));
      } catch (e) {
        return mcpError("Error setting text properties", e);
      }
    }
  );
  server2.tool(
    "scan_text_nodes",
    "Scan all text nodes within a node tree. Batch: pass multiple items.",
    { items: flexJson(z13.array(scanTextItem)).describe("Array of {nodeId}") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("scan_text_nodes", params));
      } catch (e) {
        return mcpError("Error scanning text nodes", e);
      }
    }
  );
}

// src/tools/fonts.ts
import { z as z14 } from "zod";
function registerMcpTools12(server2, sendCommand) {
  server2.tool(
    "get_available_fonts",
    "Get available fonts in Figma. Optionally filter by query string.",
    { query: z14.string().optional().describe("Filter fonts by name (case-insensitive). Omit to list all fonts.") },
    async ({ query }) => {
      try {
        return mcpJson(await sendCommand("get_available_fonts", { query }));
      } catch (e) {
        return mcpError("Error getting fonts", e);
      }
    }
  );
}

// src/tools/components.ts
import { z as z15 } from "zod";
init_helpers();
var componentItem = z15.object({
  name: z15.string().describe("Component name"),
  x: xPos,
  y: yPos,
  width: z15.coerce.number().optional().describe("Width (default: 100)"),
  height: z15.coerce.number().optional().describe("Height (default: 100)"),
  parentId,
  fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no fill.'),
  fillStyleName: z15.string().optional().describe("Apply a fill paint style by name (case-insensitive)."),
  fillVariableId: z15.string().optional().describe("Bind a color variable to the fill."),
  strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no stroke.'),
  strokeStyleName: z15.string().optional().describe("Apply a stroke paint style by name."),
  strokeVariableId: z15.string().optional().describe("Bind a color variable to the stroke."),
  strokeWeight: z15.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: z15.coerce.number().optional().describe("Corner radius (default: 0)"),
  layoutMode: z15.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: NONE)"),
  layoutWrap: z15.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)"),
  paddingTop: z15.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z15.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z15.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z15.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z15.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
  counterAxisAlignItems: z15.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
  layoutSizingHorizontal: z15.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
  layoutSizingVertical: z15.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
  itemSpacing: z15.coerce.number().optional().describe("Spacing between children (default: 0)")
});
var fromNodeItem = z15.object({
  nodeId
});
var combineItem = z15.object({
  componentIds: flexJson(z15.array(z15.string())).describe("Component IDs to combine (min 2)"),
  name: z15.string().optional().describe("Name for the component set. Omit to auto-generate.")
});
var propItem = z15.object({
  componentId: z15.string().describe("Component node ID"),
  propertyName: z15.string().describe("Property name"),
  type: z15.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Property type"),
  defaultValue: flexBool(z15.union([z15.string(), z15.boolean()])).describe("Default value (string for TEXT/VARIANT, boolean for BOOLEAN)"),
  preferredValues: flexJson(z15.array(z15.object({
    type: z15.enum(["COMPONENT", "COMPONENT_SET"]),
    key: z15.string()
  })).optional()).describe("Preferred values for INSTANCE_SWAP type. Omit for none.")
});
var instanceItem = z15.object({
  componentId: z15.string().describe("Component or component set ID"),
  variantProperties: flexJson(z15.record(z15.string()).optional()).describe('Pick variant by properties, e.g. {"Style":"Secondary","Size":"Large"}. Ignored for plain COMPONENT IDs.'),
  x: z15.coerce.number().optional().describe("X position. Omit to keep default."),
  y: z15.coerce.number().optional().describe("Y position. Omit to keep default."),
  parentId
});
function registerMcpTools13(server2, sendCommand) {
  server2.tool(
    "create_component",
    "Create components in Figma. Same layout params as create_frame. Name with 'Property=Value' pattern (e.g. 'Size=Small') if you plan to combine_as_variants later. Batch: pass multiple items.",
    { items: flexJson(z15.array(componentItem)).describe("Array of components to create"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_component", params));
      } catch (e) {
        return mcpError("Error creating component", e);
      }
    }
  );
  server2.tool(
    "create_component_from_node",
    "Convert existing nodes into components. Batch: pass multiple items.",
    { items: flexJson(z15.array(fromNodeItem)).describe("Array of {nodeId}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_component_from_node", params));
      } catch (e) {
        return mcpError("Error creating component from node", e);
      }
    }
  );
  server2.tool(
    "combine_as_variants",
    "Combine components into variant sets. Name components with 'Property=Value' pattern (e.g. 'Style=Primary', 'Size=Large') BEFORE combining \u2014 Figma derives variant properties from component names. Avoid slashes in names. The resulting set is placed in the components' shared parent (or page root if parents differ). Batch: pass multiple items.",
    { items: flexJson(z15.array(combineItem)).describe("Array of {componentIds, name?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("combine_as_variants", params));
      } catch (e) {
        return mcpError("Error combining variants", e);
      }
    }
  );
  server2.tool(
    "add_component_property",
    "Add properties to components. Batch: pass multiple items.",
    { items: flexJson(z15.array(propItem)).describe("Array of {componentId, propertyName, type, defaultValue, preferredValues?}") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("add_component_property", params));
      } catch (e) {
        return mcpError("Error adding component property", e);
      }
    }
  );
  server2.tool(
    "create_instance_from_local",
    'Create instances of local components. For COMPONENT_SET, use variantProperties to pick a specific variant (e.g. {"Style":"Secondary"}). Batch: pass multiple items.',
    { items: flexJson(z15.array(instanceItem)).describe("Array of {componentId, x?, y?, parentId?}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_instance_from_local", params));
      } catch (e) {
        return mcpError("Error creating instance", e);
      }
    }
  );
  server2.tool(
    "search_components",
    "Search local components and component sets across all pages. Returns component id, name, and which page it lives on.",
    {
      query: z15.string().optional().describe("Filter by name (case-insensitive substring). Omit to list all."),
      setsOnly: flexBool(z15.boolean().optional()).describe("If true, return only COMPONENT_SET nodes"),
      limit: z15.coerce.number().optional().describe("Max results (default 100)"),
      offset: z15.coerce.number().optional().describe("Skip N results (default 0)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("search_components", params));
      } catch (e) {
        return mcpError("Error searching components", e);
      }
    }
  );
  server2.tool(
    "get_component_by_id",
    "Get detailed component info including property definitions and variants.",
    {
      componentId: z15.string().describe("Component node ID"),
      includeChildren: flexBool(z15.boolean().optional()).describe("For COMPONENT_SETs: include variant children (default false)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("get_component_by_id", params));
      } catch (e) {
        return mcpError("Error getting component", e);
      }
    }
  );
  server2.tool(
    "get_instance_overrides",
    "Get override properties from a component instance.",
    { nodeId: z15.string().optional().describe("Instance node ID (uses selection if omitted)") },
    async ({ nodeId: nodeId2 }) => {
      try {
        return mcpJson(await sendCommand("get_instance_overrides", { instanceNodeId: nodeId2 || null }));
      } catch (e) {
        return mcpError("Error getting overrides", e);
      }
    }
  );
}

// src/tools/styles.ts
import { z as z16 } from "zod";
init_helpers();
var paintStyleItem = z16.object({
  name: z16.string().describe("Style name"),
  color: flexJson(colorRgba).describe('Color. Hex "#FF0000" or {r,g,b,a?} 0-1.')
});
var textStyleItem = z16.object({
  name: z16.string().describe("Style name"),
  fontFamily: z16.string().describe("Font family"),
  fontStyle: z16.string().optional().describe("Font style (default: Regular)"),
  fontSize: z16.coerce.number().describe("Font size"),
  lineHeight: flexNum(z16.union([
    z16.number(),
    z16.object({ value: z16.coerce.number(), unit: z16.enum(["PIXELS", "PERCENT", "AUTO"]) })
  ]).optional()).describe("Line height \u2014 number (px) or {value, unit}. Default: auto."),
  letterSpacing: flexNum(z16.union([
    z16.number(),
    z16.object({ value: z16.coerce.number(), unit: z16.enum(["PIXELS", "PERCENT"]) })
  ]).optional()).describe("Letter spacing \u2014 number (px) or {value, unit}. Default: 0."),
  textCase: z16.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z16.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional()
});
var effectStyleItem = z16.object({
  name: z16.string().describe("Style name"),
  effects: flexJson(z16.array(effectEntry)).describe("Array of effects")
});
var applyStyleItem = z16.object({
  nodeId,
  styleId: z16.string().optional().describe("Style ID. Provide either styleId or styleName."),
  styleName: z16.string().optional().describe("Style name (case-insensitive substring match). Provide either styleId or styleName."),
  styleType: z16.preprocess((v) => typeof v === "string" ? v.toLowerCase() : v, z16.enum(["fill", "stroke", "text", "effect"])).describe("Type of style: fill, stroke, text, or effect (case-insensitive)")
});
function registerMcpTools14(server2, sendCommand) {
  server2.tool(
    "get_styles",
    "List local styles (paint, text, effect, grid). Returns IDs and names only.",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_styles"));
      } catch (e) {
        return mcpError("Error getting styles", e);
      }
    }
  );
  server2.tool(
    "get_style_by_id",
    "Get detailed style info by ID. Returns full paint/font/effect/grid details.",
    { styleId: z16.string().describe("Style ID") },
    async ({ styleId }) => {
      try {
        return mcpJson(await sendCommand("get_style_by_id", { styleId }));
      } catch (e) {
        return mcpError("Error getting style", e);
      }
    }
  );
  server2.tool(
    "remove_style",
    "Delete a style by ID.",
    { styleId: z16.string().describe("Style ID to remove") },
    async ({ styleId }) => {
      try {
        return mcpJson(await sendCommand("remove_style", { styleId }));
      } catch (e) {
        return mcpError("Error removing style", e);
      }
    }
  );
  server2.tool(
    "create_paint_style",
    "Create color/paint styles. Batch: pass multiple items.",
    { items: flexJson(z16.array(paintStyleItem)).describe("Array of {name, color}") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_paint_style", params));
      } catch (e) {
        return mcpError("Error creating paint style", e);
      }
    }
  );
  server2.tool(
    "create_text_style",
    "Create text styles. Batch: pass multiple items.",
    { items: flexJson(z16.array(textStyleItem)).describe("Array of text style definitions") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_text_style", params));
      } catch (e) {
        return mcpError("Error creating text style", e);
      }
    }
  );
  server2.tool(
    "create_effect_style",
    "Create effect styles (shadows, blurs). Batch: pass multiple items.",
    { items: flexJson(z16.array(effectStyleItem)).describe("Array of {name, effects}") },
    async (params) => {
      try {
        return mcpJson(await sendCommand("create_effect_style", params));
      } catch (e) {
        return mcpError("Error creating effect style", e);
      }
    }
  );
  server2.tool(
    "apply_style_to_node",
    "Apply a style to nodes by ID or name. Use styleName for convenience (case-insensitive). Batch: pass multiple items.",
    { items: flexJson(z16.array(applyStyleItem)).describe("Array of {nodeId, styleId?, styleName?, styleType}"), depth },
    async (params) => {
      try {
        return mcpJson(await sendCommand("apply_style_to_node", params));
      } catch (e) {
        return mcpError("Error applying style", e);
      }
    }
  );
}

// src/tools/variables.ts
import { z as z17 } from "zod";
var collectionItem = z17.object({
  name: z17.string().describe("Collection name")
});
var variableItem = z17.object({
  collectionId: z17.string().describe("Variable collection ID"),
  name: z17.string().describe("Variable name"),
  resolvedType: z17.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type")
});
var setValueItem = z17.object({
  variableId: z17.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)"),
  modeId: z17.string().describe("Mode ID"),
  value: flexJson(z17.union([
    z17.number(),
    z17.string(),
    z17.boolean(),
    z17.object({ r: z17.coerce.number(), g: z17.coerce.number(), b: z17.coerce.number(), a: z17.coerce.number().optional() })
  ])).describe("Value: number, string, boolean, or {r,g,b,a} color")
});
var bindingItem = z17.object({
  nodeId: z17.string().describe("Node ID"),
  field: z17.string().describe("Property field (e.g., 'opacity', 'fills/0/color')"),
  variableId: z17.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)")
});
var addModeItem = z17.object({
  collectionId: z17.string().describe("Collection ID"),
  name: z17.string().describe("Mode name")
});
var renameModeItem = z17.object({
  collectionId: z17.string().describe("Collection ID"),
  modeId: z17.string().describe("Mode ID"),
  name: z17.string().describe("New name")
});
var removeModeItem = z17.object({
  collectionId: z17.string().describe("Collection ID"),
  modeId: z17.string().describe("Mode ID")
});
var setExplicitModeItem = z17.object({
  nodeId,
  collectionId: z17.string().describe("Variable collection ID"),
  modeId: z17.string().describe("Mode ID to pin (e.g. Dark mode)")
});
function registerMcpTools15(server2, sendCommand) {
  server2.tool(
    "create_variable_collection",
    "Create variable collections. Batch: pass multiple items.",
    { items: flexJson(z17.array(collectionItem)).describe("Array of {name}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("create_variable_collection", { items }));
      } catch (e) {
        return mcpError("Error creating variable collection", e);
      }
    }
  );
  server2.tool(
    "create_variable",
    "Create variables in a collection. Batch: pass multiple items.",
    { items: flexJson(z17.array(variableItem)).describe("Array of {collectionId, name, resolvedType}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("create_variable", { items }));
      } catch (e) {
        return mcpError("Error creating variable", e);
      }
    }
  );
  server2.tool(
    "set_variable_value",
    "Set variable values for modes. Batch: pass multiple items.",
    { items: flexJson(z17.array(setValueItem)).describe("Array of {variableId, modeId, value}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("set_variable_value", { items }));
      } catch (e) {
        return mcpError("Error setting variable value", e);
      }
    }
  );
  server2.tool(
    "get_local_variables",
    "List local variables. Pass includeValues:true to get all mode values in bulk (avoids N separate get_variable_by_id calls).",
    {
      type: z17.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional().describe("Filter by type"),
      collectionId: z17.string().optional().describe("Filter by collection. Omit for all collections."),
      includeValues: flexBool(z17.boolean().optional()).describe("Include valuesByMode for each variable (default: false)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("get_local_variables", params));
      } catch (e) {
        return mcpError("Error getting variables", e);
      }
    }
  );
  server2.tool(
    "get_local_variable_collections",
    "List all local variable collections.",
    {},
    async () => {
      try {
        return mcpJson(await sendCommand("get_local_variable_collections"));
      } catch (e) {
        return mcpError("Error getting variable collections", e);
      }
    }
  );
  server2.tool(
    "get_variable_by_id",
    "Get detailed variable info including all mode values.",
    { variableId: z17.string().describe("Variable ID") },
    async ({ variableId }) => {
      try {
        return mcpJson(await sendCommand("get_variable_by_id", { variableId }));
      } catch (e) {
        return mcpError("Error getting variable", e);
      }
    }
  );
  server2.tool(
    "get_variable_collection_by_id",
    "Get detailed variable collection info including modes and variable IDs.",
    { collectionId: z17.string().describe("Collection ID") },
    async ({ collectionId }) => {
      try {
        return mcpJson(await sendCommand("get_variable_collection_by_id", { collectionId }));
      } catch (e) {
        return mcpError("Error getting variable collection", e);
      }
    }
  );
  server2.tool(
    "set_variable_binding",
    "Bind variables to node properties. Common fields: 'fills/0/color', 'strokes/0/color', 'opacity', 'topLeftRadius', 'itemSpacing'. Batch: pass multiple items.",
    { items: flexJson(z17.array(bindingItem)).describe("Array of {nodeId, field, variableId}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("set_variable_binding", { items }));
      } catch (e) {
        return mcpError("Error binding variable", e);
      }
    }
  );
  server2.tool(
    "add_mode",
    "Add modes to variable collections. Batch: pass multiple items.",
    { items: flexJson(z17.array(addModeItem)).describe("Array of {collectionId, name}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("add_mode", { items }));
      } catch (e) {
        return mcpError("Error adding mode", e);
      }
    }
  );
  server2.tool(
    "rename_mode",
    "Rename modes in variable collections. Batch: pass multiple items.",
    { items: flexJson(z17.array(renameModeItem)).describe("Array of {collectionId, modeId, name}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("rename_mode", { items }));
      } catch (e) {
        return mcpError("Error renaming mode", e);
      }
    }
  );
  server2.tool(
    "remove_mode",
    "Remove modes from variable collections. Batch: pass multiple items.",
    { items: flexJson(z17.array(removeModeItem)).describe("Array of {collectionId, modeId}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("remove_mode", { items }));
      } catch (e) {
        return mcpError("Error removing mode", e);
      }
    }
  );
  server2.tool(
    "set_explicit_variable_mode",
    "Pin a variable collection mode on a frame (e.g. show Dark mode). Batch: pass multiple items.",
    { items: flexJson(z17.array(setExplicitModeItem)).describe("Array of {nodeId, collectionId, modeId}") },
    async ({ items }) => {
      try {
        return mcpJson(await sendCommand("set_explicit_variable_mode", { items }));
      } catch (e) {
        return mcpError("Error setting variable mode", e);
      }
    }
  );
  server2.tool(
    "get_node_variables",
    "Get variable bindings on a node. Returns which variables are bound to fills, strokes, opacity, corner radius, etc.",
    { nodeId },
    async ({ nodeId: nodeId2 }) => {
      try {
        return mcpJson(await sendCommand("get_node_variables", { nodeId: nodeId2 }));
      } catch (e) {
        return mcpError("Error getting node variables", e);
      }
    }
  );
}

// src/tools/lint.ts
import { z as z18 } from "zod";
init_helpers();
var lintRules = z18.enum([
  "no-autolayout",
  // Frames with >1 child and no auto-layout
  "shape-instead-of-frame",
  // Shapes used where FRAME should be
  "hardcoded-color",
  // Fills/strokes not using styles
  "no-text-style",
  // Text nodes without text style
  "fixed-in-autolayout",
  // Fixed-size children in auto-layout parents
  "default-name",
  // Nodes with default/unnamed names
  "empty-container",
  // Frames/components with layout but no children
  "stale-text-name",
  // Text nodes where layer name diverges from content
  "all"
  // Run all rules
]);
function registerMcpTools16(server2, sendCommand) {
  server2.tool(
    "lint_node",
    "Run design linter on a node tree. Returns issues grouped by category with affected node IDs and fix instructions. Lint child nodes individually for large trees.",
    {
      nodeId: z18.string().optional().describe("Node ID to lint. Omit to lint current selection."),
      rules: flexJson(z18.array(lintRules).optional()).describe('Rules to run. Default: ["all"]. Options: no-autolayout, shape-instead-of-frame, hardcoded-color, no-text-style, fixed-in-autolayout, default-name, empty-container, stale-text-name, all'),
      maxDepth: z18.coerce.number().optional().describe("Max depth to recurse (default: 10)"),
      maxFindings: z18.coerce.number().optional().describe("Stop after N findings (default: 50)")
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("lint_node", params));
      } catch (e) {
        return mcpError("Error running lint", e);
      }
    }
  );
  server2.tool(
    "lint_fix_autolayout",
    "Auto-fix: convert frames with multiple children to auto-layout. Takes node IDs from lint_node 'no-autolayout' results.",
    {
      items: flexJson(z18.array(z18.object({
        nodeId,
        layoutMode: z18.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: auto-detect based on child positions)"),
        itemSpacing: z18.coerce.number().optional().describe("Spacing between children (default: 0)")
      }))).describe("Array of frames to convert to auto-layout"),
      depth
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("lint_fix_autolayout", params));
      } catch (e) {
        return mcpError("Error fixing auto-layout", e);
      }
    }
  );
  server2.tool(
    "lint_fix_replace_shape_with_frame",
    "Auto-fix: replace shapes with frames preserving visual properties. Overlapping siblings are re-parented into the new frame. Use after lint_node 'shape-instead-of-frame' results.",
    {
      items: flexJson(z18.array(z18.object({
        nodeId,
        adoptChildren: flexBool(z18.boolean().optional()).describe("Re-parent overlapping siblings into the new frame (default: true)")
      }))).describe("Array of shapes to convert to frames"),
      depth
    },
    async (params) => {
      try {
        return mcpJson(await sendCommand("lint_fix_replace_shape_with_frame", params));
      } catch (e) {
        return mcpError("Error converting shapes to frames", e);
      }
    }
  );
}

// src/tools/prompts.ts
function registerPrompts(server2) {
  server2.prompt(
    "design_strategy",
    "Best practices for working with Figma designs",
    () => ({
      messages: [{
        role: "assistant",
        content: {
          type: "text",
          text: `When working with Figma designs, follow these best practices:

1. Understand Before Creating:
   - Use get_document_info() to see pages and current page
   - Use get_styles() and get_local_variables() to discover existing design tokens
   - Plan layout hierarchy before creating elements

2. Use Design Tokens \u2014 Never Hardcode:
   - Colors: use fillStyleName/strokeStyleName (paint styles) or fillVariableId/strokeVariableId (variables)
   - Text: use textStyleName to apply text styles that control font size, weight, and line height together
   - Effects: use effectStyleName to apply shadow/blur styles
   - Only use raw fillColor/fontColor for one-off values not in the design system

3. Auto-Layout First:
   - Use create_frame() with layoutMode: "VERTICAL" or "HORIZONTAL" for every container
   - Set itemSpacing, padding, and alignment at creation time
   - Use layoutSizingHorizontal/Vertical: "FILL" for responsive children
   - Avoid absolute positioning \u2014 let auto-layout handle spacing

4. Naming Conventions:
   - Use descriptive, semantic names for all elements
   - Name components with Property=Value pattern (e.g. "Size=Small") before combine_as_variants

5. Variable Modes:
   - Use set_explicit_variable_mode() to pin a frame to a specific mode (e.g. Dark)
   - Use get_node_variables() to verify which variables are bound to a node

6. Quality Check \u2014 Run Lint:
   - After building a section, run lint_node() to catch common issues:
     * hardcoded-color: fills/strokes not using styles or variables
     * no-text-style: text without a text style applied
     * no-autolayout: frames with children but no auto-layout
     * default-name: nodes still named "Frame", "Rectangle", etc.
   - Use lint_fix_autolayout() and lint_fix_replace_shape_with_frame() to auto-fix
   - Lint early and often \u2014 it is cheaper to fix issues during creation than after`
        }
      }],
      description: "Best practices for working with Figma designs"
    })
  );
  server2.prompt(
    "read_design_strategy",
    "Best practices for reading Figma designs",
    () => ({
      messages: [{
        role: "assistant",
        content: {
          type: "text",
          text: `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use read_my_design() to understand the current selection
   - If no selection ask user to select single or multiple nodes
`
        }
      }],
      description: "Best practices for reading Figma designs"
    })
  );
  server2.prompt(
    "text_replacement_strategy",
    "Systematic approach for replacing text in Figma designs",
    () => ({
      messages: [{
        role: "assistant",
        content: {
          type: "text",
          text: `# Intelligent Text Replacement Strategy

## 1. Analyze Design & Identify Structure
- Scan text nodes to understand the overall structure of the design
- Use AI pattern recognition to identify logical groupings:
  * Tables (rows, columns, headers, cells)
  * Lists (items, headers, nested lists)
  * Card groups (similar cards with recurring text fields)
  * Forms (labels, input fields, validation text)
  * Navigation (menu items, breadcrumbs)
\`\`\`
scan_text_nodes(nodeId: "node-id")
get_node_info(nodeId: "node-id")  // optional
\`\`\`

## 2. Strategic Chunking for Complex Designs
- Divide replacement tasks into logical content chunks based on design structure
- Use one of these chunking strategies that best fits the design:
  * **Structural Chunking**: Table rows/columns, list sections, card groups
  * **Spatial Chunking**: Top-to-bottom, left-to-right in screen areas
  * **Semantic Chunking**: Content related to the same topic or functionality
  * **Component-Based Chunking**: Process similar component instances together

## 3. Progressive Replacement with Verification
- Create a safe copy of the node for text replacement
- Replace text chunk by chunk with continuous progress updates
- After each chunk is processed:
  * Export that section as a small, manageable image
  * Verify text fits properly and maintain design integrity
  * Fix issues before proceeding to the next chunk

\`\`\`
// Clone the node to create a safe copy
clone_node(nodeId: "selected-node-id", x: [new-x], y: [new-y])

// Replace text chunk by chunk
set_text_content(
  items: [
    { nodeId: "node-id-1", text: "New text 1" },
    // More nodes in this chunk...
  ]
)

// Verify chunk with small, targeted image exports
export_node_as_image(nodeId: "chunk-node-id", format: "PNG", scale: 0.5)
\`\`\`

## 4. Intelligent Handling for Table Data
- For tabular content:
  * Process one row or column at a time
  * Maintain alignment and spacing between cells
  * Consider conditional formatting based on cell content
  * Preserve header/data relationships

## 5. Smart Text Adaptation
- Adaptively handle text based on container constraints:
  * Auto-detect space constraints and adjust text length
  * Apply line breaks at appropriate linguistic points
  * Maintain text hierarchy and emphasis
  * Consider font scaling for critical content that must fit

## 6. Progressive Feedback Loop
- Establish a continuous feedback loop during replacement:
  * Real-time progress updates (0-100%)
  * Small image exports after each chunk for verification
  * Issues identified early and resolved incrementally
  * Quick adjustments applied to subsequent chunks

## 7. Final Verification & Context-Aware QA
- After all chunks are processed:
  * Export the entire design at reduced scale for final verification
  * Check for cross-chunk consistency issues
  * Verify proper text flow between different sections
  * Ensure design harmony across the full composition

## 8. Chunk-Specific Export Scale Guidelines
- Scale exports appropriately based on chunk size:
  * Small chunks (1-5 elements): scale 1.0
  * Medium chunks (6-20 elements): scale 0.7
  * Large chunks (21-50 elements): scale 0.5
  * Very large chunks (50+ elements): scale 0.3
  * Full design verification: scale 0.2

## Sample Chunking Strategy for Common Design Types

### Tables
- Process by logical rows (5-10 rows per chunk)
- Alternative: Process by column for columnar analysis
- Tip: Always include header row in first chunk for reference

### Card Lists
- Group 3-5 similar cards per chunk
- Process entire cards to maintain internal consistency
- Verify text-to-image ratio within cards after each chunk

### Forms
- Group related fields (e.g., "Personal Information", "Payment Details")
- Process labels and input fields together
- Ensure validation messages and hints are updated with their fields

### Navigation & Menus
- Process hierarchical levels together (main menu, submenu)
- Respect information architecture relationships
- Verify menu fit and alignment after replacement

## Best Practices
- **Preserve Design Intent**: Always prioritize design integrity
- **Structural Consistency**: Maintain alignment, spacing, and hierarchy
- **Visual Feedback**: Verify each chunk visually before proceeding
- **Incremental Improvement**: Learn from each chunk to improve subsequent ones
- **Balance Automation & Control**: Let AI handle repetitive replacements but maintain oversight
- **Respect Content Relationships**: Keep related content consistent across chunks

Remember that text is never just text\u2014it's a core design element that must work harmoniously with the overall composition. This chunk-based strategy allows you to methodically transform text while maintaining design integrity.`
        }
      }],
      description: "Systematic approach for replacing text in Figma designs"
    })
  );
  server2.prompt(
    "swap_overrides_instances",
    "Guide to swap instance overrides between instances",
    () => ({
      messages: [{
        role: "assistant",
        content: {
          type: "text",
          text: `# Swap Component Instance Overrides

## Overview
Transfer content overrides from a source instance to target instances.

## Process

### 1. Identify Instances
- Use \`get_selection()\` to identify selected instances
- Use \`search_nodes(types: ["INSTANCE"])\` to find instances on the page

### 2. Extract Source Overrides
- \`get_instance_overrides(nodeId: "source-instance-id")\`
- Returns mainComponentId and per-child override fields (characters, fills, fontSize, etc.)

### 3. Apply to Targets
- For text overrides: use \`set_text_content\` on matching child node IDs
- For style overrides: use \`set_fill_color\`, \`apply_style_to_node\`, etc.
- Match children by name path \u2014 source and target instances share the same internal structure

### 4. Verify
- \`get_node_info(nodeId, depth: 1)\` on target instances
- \`export_node_as_image\` for visual verification`
        }
      }],
      description: "Strategy for transferring overrides between component instances in Figma"
    })
  );
}

// src/tools/mcp-registry.ts
function registerAllTools(server2, sendCommand) {
  registerMcpTools(server2, sendCommand);
  registerMcpTools2(server2, sendCommand);
  registerMcpTools3(server2, sendCommand);
  registerMcpTools4(server2, sendCommand);
  registerMcpTools5(server2, sendCommand);
  registerMcpTools6(server2, sendCommand);
  registerMcpTools7(server2, sendCommand);
  registerMcpTools8(server2, sendCommand);
  registerMcpTools9(server2, sendCommand);
  registerMcpTools10(server2, sendCommand);
  registerMcpTools11(server2, sendCommand);
  registerMcpTools12(server2, sendCommand);
  registerMcpTools13(server2, sendCommand);
  registerMcpTools14(server2, sendCommand);
  registerMcpTools15(server2, sendCommand);
  registerMcpTools16(server2, sendCommand);
  registerPrompts(server2);
}

// src/talk_to_figma_mcp/server.ts
var logger = {
  info: (msg) => process.stderr.write(`[INFO] ${msg}
`),
  debug: (msg) => process.stderr.write(`[DEBUG] ${msg}
`),
  warn: (msg) => process.stderr.write(`[WARN] ${msg}
`),
  error: (msg) => process.stderr.write(`[ERROR] ${msg}
`),
  log: (msg) => process.stderr.write(`[LOG] ${msg}
`)
};
var ws = null;
var pendingRequests = /* @__PURE__ */ new Map();
var currentChannel = null;
var args = process.argv.slice(2);
var serverArg = args.find((a) => a.startsWith("--server="));
var serverUrl = serverArg ? serverArg.split("=")[1] : "localhost";
var WS_URL = serverUrl === "localhost" ? `ws://${serverUrl}` : `wss://${serverUrl}`;
function connectToFigma(port = 3055) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info("Already connected to Figma");
    return;
  }
  const wsUrl = serverUrl === "localhost" ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  ws = new WebSocket(wsUrl);
  ws.on("open", () => {
    logger.info("Connected to Figma socket server");
    currentChannel = null;
  });
  ws.on("message", (data) => {
    try {
      const json = JSON.parse(data);
      if (json.type === "progress_update") {
        const progressData = json.message.data;
        const requestId = json.id || "";
        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId);
          request.lastActivity = Date.now();
          clearTimeout(request.timeout);
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`);
              pendingRequests.delete(requestId);
              request.reject(new Error("Request to Figma timed out"));
            }
          }, 6e4);
          logger.info(`Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`);
          if (progressData.status === "completed" && progressData.progress === 100) {
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`);
          }
        }
        return;
      }
      const myResponse = json.message;
      logger.debug(`Received message: ${JSON.stringify(myResponse)}`);
      if (myResponse.id && pendingRequests.has(myResponse.id) && myResponse.result) {
        const request = pendingRequests.get(myResponse.id);
        clearTimeout(request.timeout);
        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new Error(myResponse.error));
        } else {
          request.resolve(myResponse.result);
        }
        pendingRequests.delete(myResponse.id);
      } else {
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  ws.on("error", (error) => {
    logger.error(`Socket error: ${error}`);
  });
  ws.on("close", () => {
    logger.info("Disconnected from Figma socket server");
    ws = null;
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }
    logger.info("Attempting to reconnect in 2 seconds...");
    setTimeout(() => connectToFigma(port), 2e3);
  });
}
async function joinChannel(channelName) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error("Not connected to Figma");
  }
  try {
    await sendCommandToFigma("join", { channel: channelName });
    currentChannel = channelName;
    logger.info(`Joined channel: ${channelName}`);
  } catch (error) {
    logger.error(`Failed to join channel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
function sendCommandToFigma(command, params = {}, timeoutMs = 3e4) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma();
      reject(new Error("Not connected to Figma. Attempting to connect..."));
      return;
    }
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      reject(new Error("No channel joined. Call join_channel first with the channel name shown in the Figma plugin panel."));
      return;
    }
    const id = uuidv4();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...command === "join" ? { channel: params.channel } : { channel: currentChannel },
      message: {
        id,
        command,
        params: {
          ...params,
          commandId: id
        }
      }
    };
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1e3} seconds`);
        reject(new Error("Request to Figma timed out"));
      }
    }, timeoutMs);
    pendingRequests.set(id, { resolve, reject, timeout, lastActivity: Date.now() });
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}
var server = new McpServer({
  name: "TalkToFigmaMCP",
  version: "1.0.0"
});
server.tool(
  "join_channel",
  "REQUIRED FIRST STEP: Join a channel before using any other tool. The channel name is shown in the Figma plugin UI. All subsequent commands are sent through this channel.",
  { channel: z19.string().describe("The channel name displayed in the Figma plugin panel (e.g. 'channel-abc-123')").default("") },
  async ({ channel }) => {
    try {
      if (!channel) {
        return {
          content: [{ type: "text", text: "Please provide a channel name to join:" }]
        };
      }
      await joinChannel(channel);
      return {
        content: [{ type: "text", text: `Successfully joined channel: ${channel}` }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }
);
registerAllTools(server, sendCommandToFigma);
async function main() {
  try {
    connectToFigma();
  } catch (error) {
    logger.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("Will try to connect when the first command is sent");
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("FigmaMCP server running on stdio");
}
main().catch((error) => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
//# sourceMappingURL=server.js.map