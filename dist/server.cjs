#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

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
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_zod19 = require("zod");
var import_ws = __toESM(require("ws"), 1);
var import_uuid = require("uuid");

// src/tools/document.ts
var import_zod = require("zod");

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
      pageId: import_zod.z.string().optional().describe("The page ID to switch to"),
      pageName: import_zod.z.string().optional().describe("The page name (case-insensitive, partial match)")
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
    { name: import_zod.z.string().optional().describe("Name for the new page (default: 'New Page')") },
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
      newName: import_zod.z.string().describe("New name for the page"),
      pageId: import_zod.z.string().optional().describe("Page ID (default: current page)")
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
var import_zod3 = require("zod");

// src/utils/coercion.ts
var import_zod2 = require("zod");
var flexBool = (inner) => import_zod2.z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, inner);
var flexJson = (inner) => import_zod2.z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}, inner);
var flexNum = (inner) => import_zod2.z.preprocess((v) => {
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
    { depth: import_zod3.z.coerce.number().optional().describe("Levels of children to recurse. 0=selection only, -1 or omit for unlimited.") },
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
      nodeIds: flexJson(import_zod3.z.array(import_zod3.z.string())).describe('Array of node IDs to select. Example: ["1:2","1:3"]')
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
      nodeIds: flexJson(import_zod3.z.array(import_zod3.z.string())).describe("Array of node IDs to zoom into")
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
      center: flexJson(import_zod3.z.object({ x: import_zod3.z.coerce.number(), y: import_zod3.z.coerce.number() }).optional()).describe("Viewport center point. Omit to keep current center."),
      zoom: import_zod3.z.coerce.number().optional().describe("Zoom level (1 = 100%). Omit to keep current zoom.")
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
var import_zod4 = require("zod");
init_filter_node();
function registerMcpTools3(server2, sendCommand) {
  server2.tool(
    "get_node_info",
    "Get detailed information about one or more nodes. Always pass an array of IDs. Use `fields` to select only the properties you need (reduces context size).",
    {
      nodeIds: flexJson(import_zod4.z.array(import_zod4.z.string())).describe('Array of node IDs. Example: ["1:2","1:3"]'),
      depth: import_zod4.z.coerce.number().optional().describe("Child recursion depth (default: unlimited). 0=stubs only."),
      fields: flexJson(import_zod4.z.array(import_zod4.z.string()).optional()).describe('Whitelist of property names to include. Always includes id, name, type. Example: ["absoluteBoundingBox","layoutMode","fills"]. Omit to return all properties.')
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
    { nodeId: import_zod4.z.string().describe("The node ID to get CSS for") },
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
      query: import_zod4.z.string().optional().describe("Name search (case-insensitive substring). Omit to match all names."),
      types: flexJson(import_zod4.z.array(import_zod4.z.string()).optional()).describe('Filter by types. Example: ["FRAME","TEXT"]. Omit to match all types.'),
      scopeNodeId: import_zod4.z.string().optional().describe("Node ID to search within (defaults to current page)"),
      caseSensitive: flexBool(import_zod4.z.boolean().optional()).describe("Case-sensitive name match (default false)"),
      limit: import_zod4.z.coerce.number().optional().describe("Max results (default 50)"),
      offset: import_zod4.z.coerce.number().optional().describe("Skip N results for pagination (default 0)")
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
      nodeId: import_zod4.z.string().describe("The node ID to export"),
      format: import_zod4.z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format (default: PNG)"),
      scale: import_zod4.z.coerce.number().positive().optional().describe("Export scale (default: 1)")
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
var import_zod6 = require("zod");

// src/tools/schemas.ts
var import_zod5 = require("zod");
var nodeId = import_zod5.z.string().describe("Node ID");
var nodeIds = flexJson(import_zod5.z.array(import_zod5.z.string())).describe("Array of node IDs");
var parentId = import_zod5.z.string().optional().describe("Parent node ID. Omit to place on current page.");
var depth = import_zod5.z.coerce.number().optional().describe("Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited.");
var xPos = import_zod5.z.coerce.number().optional().describe("X position (default: 0)");
var yPos = import_zod5.z.coerce.number().optional().describe("Y position (default: 0)");
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
var colorRgba = import_zod5.z.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, import_zod5.z.object({
  r: import_zod5.z.coerce.number().min(0).max(1),
  g: import_zod5.z.coerce.number().min(0).max(1),
  b: import_zod5.z.coerce.number().min(0).max(1),
  a: import_zod5.z.coerce.number().min(0).max(1).optional()
}));
var effectEntry = import_zod5.z.object({
  type: import_zod5.z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
  color: flexJson(colorRgba.optional()),
  offset: flexJson(import_zod5.z.object({ x: import_zod5.z.coerce.number(), y: import_zod5.z.coerce.number() }).optional()),
  radius: import_zod5.z.coerce.number(),
  spread: import_zod5.z.coerce.number().optional(),
  visible: flexBool(import_zod5.z.boolean().optional()),
  blendMode: import_zod5.z.string().optional()
});

// src/tools/create-shape.ts
init_helpers();
var rectItem = import_zod6.z.object({
  name: import_zod6.z.string().optional().describe("Name (default: 'Rectangle')"),
  x: xPos,
  y: yPos,
  width: import_zod6.z.coerce.number().optional().describe("Width (default: 100)"),
  height: import_zod6.z.coerce.number().optional().describe("Height (default: 100)"),
  parentId
});
var ellipseItem = import_zod6.z.object({
  name: import_zod6.z.string().optional().describe("Layer name (default: 'Ellipse')"),
  x: xPos,
  y: yPos,
  width: import_zod6.z.coerce.number().optional().describe("Width (default: 100)"),
  height: import_zod6.z.coerce.number().optional().describe("Height (default: 100)"),
  parentId
});
var lineItem = import_zod6.z.object({
  name: import_zod6.z.string().optional().describe("Layer name (default: 'Line')"),
  x: xPos,
  y: yPos,
  length: import_zod6.z.coerce.number().optional().describe("Length (default: 100)"),
  rotation: import_zod6.z.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
  parentId
});
var sectionItem = import_zod6.z.object({
  name: import_zod6.z.string().optional().describe("Name (default: 'Section')"),
  x: xPos,
  y: yPos,
  width: import_zod6.z.coerce.number().optional().describe("Width (default: 500)"),
  height: import_zod6.z.coerce.number().optional().describe("Height (default: 500)"),
  parentId
});
var svgItem = import_zod6.z.object({
  svg: import_zod6.z.string().describe("SVG markup string"),
  name: import_zod6.z.string().optional().describe("Layer name (default: 'SVG')"),
  x: xPos,
  y: yPos,
  parentId
});
var boolOpItem = import_zod6.z.object({
  nodeIds: flexJson(import_zod6.z.array(import_zod6.z.string())).describe("Array of node IDs (min 2)"),
  operation: import_zod6.z.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
  name: import_zod6.z.string().optional().describe("Name for the result. Omit to auto-generate.")
});
function registerMcpTools4(server2, sendCommand) {
  server2.tool(
    "create_rectangle",
    "Create rectangles (leaf nodes \u2014 cannot have children). For containers/cards/panels, use create_frame instead. Batch: pass multiple items.",
    { items: flexJson(import_zod6.z.array(rectItem)).describe("Array of rectangles to create"), depth },
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
    { items: flexJson(import_zod6.z.array(ellipseItem)).describe("Array of ellipses to create"), depth },
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
    { items: flexJson(import_zod6.z.array(lineItem)).describe("Array of lines to create"), depth },
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
    { items: flexJson(import_zod6.z.array(sectionItem)).describe("Array of sections to create"), depth },
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
    { items: flexJson(import_zod6.z.array(svgItem)).describe("Array of SVG items to create"), depth },
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
    { items: flexJson(import_zod6.z.array(boolOpItem)).describe("Array of boolean operations to create"), depth },
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
var import_zod7 = require("zod");
init_helpers();
var frameItem = import_zod7.z.object({
  name: import_zod7.z.string().optional().describe("Frame name (default: 'Frame')"),
  x: xPos,
  y: yPos,
  width: import_zod7.z.coerce.number().optional().describe("Width (default: 100)"),
  height: import_zod7.z.coerce.number().optional().describe("Height (default: 100)"),
  parentId,
  fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: no fill (empty fills array).'),
  strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Default: none.'),
  strokeWeight: import_zod7.z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: import_zod7.z.coerce.number().min(0).optional().describe("Corner radius (default: 0)"),
  layoutMode: import_zod7.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
  layoutWrap: import_zod7.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)"),
  paddingTop: import_zod7.z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: import_zod7.z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: import_zod7.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: import_zod7.z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: import_zod7.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: import_zod7.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: import_zod7.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: import_zod7.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  itemSpacing: import_zod7.z.coerce.number().optional().describe("Spacing between children (default: 0)"),
  // Style/variable references
  fillStyleName: import_zod7.z.string().optional().describe("Apply a fill paint style by name (case-insensitive). Omit to skip."),
  strokeStyleName: import_zod7.z.string().optional().describe("Apply a stroke paint style by name. Omit to skip."),
  fillVariableId: import_zod7.z.string().optional().describe("Bind a color variable to the fill. Creates a solid fill and binds the variable to fills/0/color."),
  strokeVariableId: import_zod7.z.string().optional().describe("Bind a color variable to the stroke. Creates a solid stroke and binds the variable to strokes/0/color.")
});
var autoLayoutItem = import_zod7.z.object({
  nodeIds: flexJson(import_zod7.z.array(import_zod7.z.string())).describe("Array of node IDs to wrap"),
  name: import_zod7.z.string().optional().describe("Frame name (default: 'Auto Layout')"),
  layoutMode: import_zod7.z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Direction (default: VERTICAL)"),
  itemSpacing: import_zod7.z.coerce.number().optional().describe("Spacing between children (default: 0)"),
  paddingTop: import_zod7.z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: import_zod7.z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: import_zod7.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: import_zod7.z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: import_zod7.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional(),
  counterAxisAlignItems: import_zod7.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional(),
  layoutSizingHorizontal: import_zod7.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: import_zod7.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutWrap: import_zod7.z.enum(["NO_WRAP", "WRAP"]).optional()
});
function registerMcpTools5(server2, sendCommand) {
  server2.tool(
    "create_frame",
    "Create frames in Figma. Supports batch. Prefer fillStyleName or fillVariableId over hardcoded fillColor for design token consistency.",
    { items: flexJson(import_zod7.z.array(frameItem)).describe("Array of frames to create"), depth },
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
    { items: flexJson(import_zod7.z.array(autoLayoutItem)).describe("Array of auto-layout wraps to perform"), depth },
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
var import_zod8 = require("zod");
init_helpers();
var textItem = import_zod8.z.object({
  text: import_zod8.z.string().describe("Text content"),
  name: import_zod8.z.string().optional().describe("Layer name (default: text content)"),
  x: xPos,
  y: yPos,
  fontSize: import_zod8.z.coerce.number().optional().describe("Font size (default: 14)"),
  fontWeight: import_zod8.z.coerce.number().optional().describe("Font weight: 100-900 (default: 400)"),
  fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000000" or {r,g,b,a?} 0-1. Default: black.'),
  fontColorVariableId: import_zod8.z.string().optional().describe("Bind a color variable to the text fill instead of hardcoded fontColor."),
  parentId,
  textStyleId: import_zod8.z.string().optional().describe("Text style ID to apply (overrides fontSize/fontWeight). Omit to skip."),
  textStyleName: import_zod8.z.string().optional().describe("Text style name (case-insensitive match). Omit to skip."),
  layoutSizingHorizontal: import_zod8.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. FILL auto-sets textAutoResize to HEIGHT."),
  layoutSizingVertical: import_zod8.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
  textAutoResize: import_zod8.z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior (default: WIDTH_AND_HEIGHT when FILL)")
});
function registerMcpTools6(server2, sendCommand) {
  server2.tool(
    "create_text",
    "Create text nodes in Figma. Uses Inter font. Max 10 items per batch. Use textStyleName to apply styles by name.",
    { items: flexJson(import_zod8.z.array(textItem).max(10)).describe("Array of text nodes to create (max 10)"), depth },
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
var import_zod9 = require("zod");
init_helpers();
var moveItem = import_zod9.z.object({
  nodeId,
  x: import_zod9.z.coerce.number().describe("New X"),
  y: import_zod9.z.coerce.number().describe("New Y")
});
var resizeItem = import_zod9.z.object({
  nodeId,
  width: import_zod9.z.coerce.number().positive().describe("New width"),
  height: import_zod9.z.coerce.number().positive().describe("New height")
});
var deleteItem = import_zod9.z.object({
  nodeId: import_zod9.z.string().describe("Node ID to delete")
});
var cloneItem = import_zod9.z.object({
  nodeId: import_zod9.z.string().describe("Node ID to clone"),
  parentId: import_zod9.z.string().optional().describe("Parent for the clone (e.g. a page ID). Defaults to same parent as original."),
  x: import_zod9.z.coerce.number().optional().describe("New X for clone. Omit to keep original position."),
  y: import_zod9.z.coerce.number().optional().describe("New Y for clone. Omit to keep original position.")
});
var insertItem = import_zod9.z.object({
  parentId: import_zod9.z.string().describe("Parent node ID"),
  childId: import_zod9.z.string().describe("Child node ID to move"),
  index: import_zod9.z.coerce.number().optional().describe("Index to insert at (0=first). Omit to append.")
});
function registerMcpTools7(server2, sendCommand) {
  server2.tool(
    "move_node",
    "Move nodes to new positions. Batch: pass multiple items.",
    { items: flexJson(import_zod9.z.array(moveItem)).describe("Array of {nodeId, x, y}"), depth },
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
    { items: flexJson(import_zod9.z.array(resizeItem)).describe("Array of {nodeId, width, height}"), depth },
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
    { items: flexJson(import_zod9.z.array(deleteItem)).describe("Array of {nodeId}") },
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
    { items: flexJson(import_zod9.z.array(cloneItem)).describe("Array of {nodeId, x?, y?}"), depth },
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
    { items: flexJson(import_zod9.z.array(insertItem)).describe("Array of {parentId, childId, index?}"), depth },
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
var import_zod10 = require("zod");
init_helpers();
var fillItem = import_zod10.z.object({
  nodeId,
  color: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  styleName: import_zod10.z.string().optional().describe("Apply fill paint style by name instead of color. Omit to use color.")
});
var strokeItem = import_zod10.z.object({
  nodeId,
  color: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Ignored when styleName is set.'),
  strokeWeight: import_zod10.z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  styleName: import_zod10.z.string().optional().describe("Apply stroke paint style by name instead of color. Omit to use color.")
});
var cornerItem = import_zod10.z.object({
  nodeId,
  radius: import_zod10.z.coerce.number().min(0).describe("Corner radius"),
  corners: flexJson(import_zod10.z.array(flexBool(import_zod10.z.boolean())).length(4).optional()).describe("Which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Default: all corners [true,true,true,true].")
});
var opacityItem = import_zod10.z.object({
  nodeId,
  opacity: import_zod10.z.coerce.number().min(0).max(1).describe("Opacity (0-1)")
});
function registerMcpTools8(server2, sendCommand) {
  server2.tool(
    "set_fill_color",
    "Set fill color on nodes. Use styleName to apply a paint style by name, or provide color directly. Batch: pass multiple items.",
    { items: flexJson(import_zod10.z.array(fillItem)).describe("Array of {nodeId, color?, styleName?}"), depth },
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
    { items: flexJson(import_zod10.z.array(strokeItem)).describe("Array of {nodeId, color?, strokeWeight?, styleName?}"), depth },
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
    { items: flexJson(import_zod10.z.array(cornerItem)).describe("Array of {nodeId, radius, corners?}"), depth },
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
    { items: flexJson(import_zod10.z.array(opacityItem)).describe("Array of {nodeId, opacity}"), depth },
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
var import_zod11 = require("zod");
init_helpers();
var layoutModeItem = import_zod11.z.object({
  nodeId,
  layoutMode: import_zod11.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode"),
  layoutWrap: import_zod11.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap (default: NO_WRAP)")
});
var paddingItem = import_zod11.z.object({
  nodeId,
  paddingTop: import_zod11.z.coerce.number().optional().describe("Top padding (default: unchanged)"),
  paddingRight: import_zod11.z.coerce.number().optional().describe("Right padding (default: unchanged)"),
  paddingBottom: import_zod11.z.coerce.number().optional().describe("Bottom padding (default: unchanged)"),
  paddingLeft: import_zod11.z.coerce.number().optional().describe("Left padding (default: unchanged)")
});
var axisAlignItem = import_zod11.z.object({
  nodeId,
  primaryAxisAlignItems: import_zod11.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment"),
  counterAxisAlignItems: import_zod11.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment")
});
var layoutSizingItem = import_zod11.z.object({
  nodeId,
  layoutSizingHorizontal: import_zod11.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: import_zod11.z.enum(["FIXED", "HUG", "FILL"]).optional()
});
var itemSpacingItem = import_zod11.z.object({
  nodeId,
  itemSpacing: import_zod11.z.coerce.number().optional().describe("Distance between children. Default: unchanged."),
  counterAxisSpacing: import_zod11.z.coerce.number().optional().describe("Distance between wrapped rows/columns (WRAP only). Default: unchanged.")
});
function registerMcpTools9(server2, sendCommand) {
  server2.tool(
    "set_layout_mode",
    "Set layout mode and wrap on frames. Batch: pass multiple items.",
    { items: flexJson(import_zod11.z.array(layoutModeItem)).describe("Array of {nodeId, layoutMode, layoutWrap?}"), depth },
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
    { items: flexJson(import_zod11.z.array(paddingItem)).describe("Array of {nodeId, paddingTop?, paddingRight?, paddingBottom?, paddingLeft?}"), depth },
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
    { items: flexJson(import_zod11.z.array(axisAlignItem)).describe("Array of {nodeId, primaryAxisAlignItems?, counterAxisAlignItems?}"), depth },
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
    { items: flexJson(import_zod11.z.array(layoutSizingItem)).describe("Array of {nodeId, layoutSizingHorizontal?, layoutSizingVertical?}"), depth },
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
    { items: flexJson(import_zod11.z.array(itemSpacingItem)).describe("Array of {nodeId, itemSpacing?, counterAxisSpacing?}"), depth },
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
var import_zod12 = require("zod");
init_helpers();
var effectItem = import_zod12.z.object({
  nodeId,
  effects: flexJson(import_zod12.z.array(effectEntry).optional()).describe("Array of effect objects. Ignored when effectStyleName is set."),
  effectStyleName: import_zod12.z.string().optional().describe("Apply an effect style by name (case-insensitive). Omit to use raw effects.")
});
var constraintItem = import_zod12.z.object({
  nodeId,
  horizontal: import_zod12.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
  vertical: import_zod12.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"])
});
var exportSettingEntry = import_zod12.z.object({
  format: import_zod12.z.enum(["PNG", "JPG", "SVG", "PDF"]),
  suffix: import_zod12.z.string().optional(),
  contentsOnly: flexBool(import_zod12.z.boolean().optional()),
  constraint: flexJson(import_zod12.z.object({
    type: import_zod12.z.enum(["SCALE", "WIDTH", "HEIGHT"]),
    value: import_zod12.z.coerce.number()
  }).optional())
});
var exportSettingsItem = import_zod12.z.object({
  nodeId,
  settings: flexJson(import_zod12.z.array(exportSettingEntry)).describe("Export settings array")
});
var nodePropertiesItem = import_zod12.z.object({
  nodeId,
  properties: flexJson(import_zod12.z.record(import_zod12.z.unknown())).describe("Key-value properties to set")
});
function registerMcpTools10(server2, sendCommand) {
  server2.tool(
    "set_effects",
    "Set effects (shadows, blurs) on nodes. Use effectStyleName to apply by name, or provide raw effects. Batch: pass multiple items.",
    { items: flexJson(import_zod12.z.array(effectItem)).describe("Array of {nodeId, effects}"), depth },
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
    { items: flexJson(import_zod12.z.array(constraintItem)).describe("Array of {nodeId, horizontal, vertical}"), depth },
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
    { items: flexJson(import_zod12.z.array(exportSettingsItem)).describe("Array of {nodeId, settings}"), depth },
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
    { items: flexJson(import_zod12.z.array(nodePropertiesItem)).describe("Array of {nodeId, properties}"), depth },
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
var import_zod13 = require("zod");
init_helpers();
var textContentItem = import_zod13.z.object({
  nodeId: import_zod13.z.string().describe("Text node ID"),
  text: import_zod13.z.string().describe("New text content")
});
var textPropsItem = import_zod13.z.object({
  nodeId: import_zod13.z.string().describe("Text node ID"),
  fontSize: import_zod13.z.coerce.number().optional().describe("Font size"),
  fontWeight: import_zod13.z.coerce.number().optional().describe("Font weight: 100-900"),
  fontColor: flexJson(colorRgba.optional()).describe('Font color. Hex "#000" or {r,g,b,a?} 0-1.'),
  textStyleId: import_zod13.z.string().optional().describe("Text style ID to apply (overrides font props)"),
  textStyleName: import_zod13.z.string().optional().describe("Text style name (case-insensitive match)"),
  textAutoResize: import_zod13.z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional(),
  layoutSizingHorizontal: import_zod13.z.enum(["FIXED", "HUG", "FILL"]).optional(),
  layoutSizingVertical: import_zod13.z.enum(["FIXED", "HUG", "FILL"]).optional()
});
var scanTextItem = import_zod13.z.object({
  nodeId,
  limit: import_zod13.z.coerce.number().optional().describe("Max text nodes to return (default: 50)"),
  includePath: flexBool(import_zod13.z.boolean().optional()).describe("Include ancestor path strings (default: true). Set false to reduce payload."),
  includeGeometry: flexBool(import_zod13.z.boolean().optional()).describe("Include absoluteX/absoluteY/width/height (default: true). Set false to reduce payload.")
});
function registerMcpTools11(server2, sendCommand) {
  server2.tool(
    "set_text_content",
    "Set text content on text nodes. Batch: pass multiple items to replace text in multiple nodes at once.",
    { items: flexJson(import_zod13.z.array(textContentItem)).describe("Array of {nodeId, text}"), depth },
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
    { items: flexJson(import_zod13.z.array(textPropsItem)).describe("Array of {nodeId, fontSize?, fontWeight?, fontColor?, ...}"), depth },
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
    { items: flexJson(import_zod13.z.array(scanTextItem)).describe("Array of {nodeId}") },
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
var import_zod14 = require("zod");
function registerMcpTools12(server2, sendCommand) {
  server2.tool(
    "get_available_fonts",
    "Get available fonts in Figma. Optionally filter by query string.",
    { query: import_zod14.z.string().optional().describe("Filter fonts by name (case-insensitive). Omit to list all fonts.") },
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
var import_zod15 = require("zod");
init_helpers();
var componentItem = import_zod15.z.object({
  name: import_zod15.z.string().describe("Component name"),
  x: xPos,
  y: yPos,
  width: import_zod15.z.coerce.number().optional().describe("Width (default: 100)"),
  height: import_zod15.z.coerce.number().optional().describe("Height (default: 100)"),
  parentId,
  fillColor: flexJson(colorRgba.optional()).describe('Fill color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no fill.'),
  fillStyleName: import_zod15.z.string().optional().describe("Apply a fill paint style by name (case-insensitive)."),
  fillVariableId: import_zod15.z.string().optional().describe("Bind a color variable to the fill."),
  strokeColor: flexJson(colorRgba.optional()).describe('Stroke color. Hex "#FF0000" or {r,g,b,a?} 0-1. Omit for no stroke.'),
  strokeStyleName: import_zod15.z.string().optional().describe("Apply a stroke paint style by name."),
  strokeVariableId: import_zod15.z.string().optional().describe("Bind a color variable to the stroke."),
  strokeWeight: import_zod15.z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: import_zod15.z.coerce.number().optional().describe("Corner radius (default: 0)"),
  layoutMode: import_zod15.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: NONE)"),
  layoutWrap: import_zod15.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)"),
  paddingTop: import_zod15.z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: import_zod15.z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: import_zod15.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: import_zod15.z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: import_zod15.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
  counterAxisAlignItems: import_zod15.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
  layoutSizingHorizontal: import_zod15.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
  layoutSizingVertical: import_zod15.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
  itemSpacing: import_zod15.z.coerce.number().optional().describe("Spacing between children (default: 0)")
});
var fromNodeItem = import_zod15.z.object({
  nodeId
});
var combineItem = import_zod15.z.object({
  componentIds: flexJson(import_zod15.z.array(import_zod15.z.string())).describe("Component IDs to combine (min 2)"),
  name: import_zod15.z.string().optional().describe("Name for the component set. Omit to auto-generate.")
});
var propItem = import_zod15.z.object({
  componentId: import_zod15.z.string().describe("Component node ID"),
  propertyName: import_zod15.z.string().describe("Property name"),
  type: import_zod15.z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Property type"),
  defaultValue: flexBool(import_zod15.z.union([import_zod15.z.string(), import_zod15.z.boolean()])).describe("Default value (string for TEXT/VARIANT, boolean for BOOLEAN)"),
  preferredValues: flexJson(import_zod15.z.array(import_zod15.z.object({
    type: import_zod15.z.enum(["COMPONENT", "COMPONENT_SET"]),
    key: import_zod15.z.string()
  })).optional()).describe("Preferred values for INSTANCE_SWAP type. Omit for none.")
});
var instanceItem = import_zod15.z.object({
  componentId: import_zod15.z.string().describe("Component or component set ID"),
  variantProperties: flexJson(import_zod15.z.record(import_zod15.z.string()).optional()).describe('Pick variant by properties, e.g. {"Style":"Secondary","Size":"Large"}. Ignored for plain COMPONENT IDs.'),
  x: import_zod15.z.coerce.number().optional().describe("X position. Omit to keep default."),
  y: import_zod15.z.coerce.number().optional().describe("Y position. Omit to keep default."),
  parentId
});
function registerMcpTools13(server2, sendCommand) {
  server2.tool(
    "create_component",
    "Create components in Figma. Same layout params as create_frame. Name with 'Property=Value' pattern (e.g. 'Size=Small') if you plan to combine_as_variants later. Batch: pass multiple items.",
    { items: flexJson(import_zod15.z.array(componentItem)).describe("Array of components to create"), depth },
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
    { items: flexJson(import_zod15.z.array(fromNodeItem)).describe("Array of {nodeId}"), depth },
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
    { items: flexJson(import_zod15.z.array(combineItem)).describe("Array of {componentIds, name?}"), depth },
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
    { items: flexJson(import_zod15.z.array(propItem)).describe("Array of {componentId, propertyName, type, defaultValue, preferredValues?}") },
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
    { items: flexJson(import_zod15.z.array(instanceItem)).describe("Array of {componentId, x?, y?, parentId?}"), depth },
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
      query: import_zod15.z.string().optional().describe("Filter by name (case-insensitive substring). Omit to list all."),
      setsOnly: flexBool(import_zod15.z.boolean().optional()).describe("If true, return only COMPONENT_SET nodes"),
      limit: import_zod15.z.coerce.number().optional().describe("Max results (default 100)"),
      offset: import_zod15.z.coerce.number().optional().describe("Skip N results (default 0)")
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
      componentId: import_zod15.z.string().describe("Component node ID"),
      includeChildren: flexBool(import_zod15.z.boolean().optional()).describe("For COMPONENT_SETs: include variant children (default false)")
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
    { nodeId: import_zod15.z.string().optional().describe("Instance node ID (uses selection if omitted)") },
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
var import_zod16 = require("zod");
init_helpers();
var paintStyleItem = import_zod16.z.object({
  name: import_zod16.z.string().describe("Style name"),
  color: flexJson(colorRgba).describe('Color. Hex "#FF0000" or {r,g,b,a?} 0-1.')
});
var textStyleItem = import_zod16.z.object({
  name: import_zod16.z.string().describe("Style name"),
  fontFamily: import_zod16.z.string().describe("Font family"),
  fontStyle: import_zod16.z.string().optional().describe("Font style (default: Regular)"),
  fontSize: import_zod16.z.coerce.number().describe("Font size"),
  lineHeight: flexNum(import_zod16.z.union([
    import_zod16.z.number(),
    import_zod16.z.object({ value: import_zod16.z.coerce.number(), unit: import_zod16.z.enum(["PIXELS", "PERCENT", "AUTO"]) })
  ]).optional()).describe("Line height \u2014 number (px) or {value, unit}. Default: auto."),
  letterSpacing: flexNum(import_zod16.z.union([
    import_zod16.z.number(),
    import_zod16.z.object({ value: import_zod16.z.coerce.number(), unit: import_zod16.z.enum(["PIXELS", "PERCENT"]) })
  ]).optional()).describe("Letter spacing \u2014 number (px) or {value, unit}. Default: 0."),
  textCase: import_zod16.z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: import_zod16.z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional()
});
var effectStyleItem = import_zod16.z.object({
  name: import_zod16.z.string().describe("Style name"),
  effects: flexJson(import_zod16.z.array(effectEntry)).describe("Array of effects")
});
var applyStyleItem = import_zod16.z.object({
  nodeId,
  styleId: import_zod16.z.string().optional().describe("Style ID. Provide either styleId or styleName."),
  styleName: import_zod16.z.string().optional().describe("Style name (case-insensitive substring match). Provide either styleId or styleName."),
  styleType: import_zod16.z.preprocess((v) => typeof v === "string" ? v.toLowerCase() : v, import_zod16.z.enum(["fill", "stroke", "text", "effect"])).describe("Type of style: fill, stroke, text, or effect (case-insensitive)")
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
    { styleId: import_zod16.z.string().describe("Style ID") },
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
    { styleId: import_zod16.z.string().describe("Style ID to remove") },
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
    { items: flexJson(import_zod16.z.array(paintStyleItem)).describe("Array of {name, color}") },
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
    { items: flexJson(import_zod16.z.array(textStyleItem)).describe("Array of text style definitions") },
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
    { items: flexJson(import_zod16.z.array(effectStyleItem)).describe("Array of {name, effects}") },
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
    { items: flexJson(import_zod16.z.array(applyStyleItem)).describe("Array of {nodeId, styleId?, styleName?, styleType}"), depth },
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
var import_zod17 = require("zod");
var collectionItem = import_zod17.z.object({
  name: import_zod17.z.string().describe("Collection name")
});
var variableItem = import_zod17.z.object({
  collectionId: import_zod17.z.string().describe("Variable collection ID"),
  name: import_zod17.z.string().describe("Variable name"),
  resolvedType: import_zod17.z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type")
});
var setValueItem = import_zod17.z.object({
  variableId: import_zod17.z.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)"),
  modeId: import_zod17.z.string().describe("Mode ID"),
  value: flexJson(import_zod17.z.union([
    import_zod17.z.number(),
    import_zod17.z.string(),
    import_zod17.z.boolean(),
    import_zod17.z.object({ r: import_zod17.z.coerce.number(), g: import_zod17.z.coerce.number(), b: import_zod17.z.coerce.number(), a: import_zod17.z.coerce.number().optional() })
  ])).describe("Value: number, string, boolean, or {r,g,b,a} color")
});
var bindingItem = import_zod17.z.object({
  nodeId: import_zod17.z.string().describe("Node ID"),
  field: import_zod17.z.string().describe("Property field (e.g., 'opacity', 'fills/0/color')"),
  variableId: import_zod17.z.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)")
});
var addModeItem = import_zod17.z.object({
  collectionId: import_zod17.z.string().describe("Collection ID"),
  name: import_zod17.z.string().describe("Mode name")
});
var renameModeItem = import_zod17.z.object({
  collectionId: import_zod17.z.string().describe("Collection ID"),
  modeId: import_zod17.z.string().describe("Mode ID"),
  name: import_zod17.z.string().describe("New name")
});
var removeModeItem = import_zod17.z.object({
  collectionId: import_zod17.z.string().describe("Collection ID"),
  modeId: import_zod17.z.string().describe("Mode ID")
});
var setExplicitModeItem = import_zod17.z.object({
  nodeId,
  collectionId: import_zod17.z.string().describe("Variable collection ID"),
  modeId: import_zod17.z.string().describe("Mode ID to pin (e.g. Dark mode)")
});
function registerMcpTools15(server2, sendCommand) {
  server2.tool(
    "create_variable_collection",
    "Create variable collections. Batch: pass multiple items.",
    { items: flexJson(import_zod17.z.array(collectionItem)).describe("Array of {name}") },
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
    { items: flexJson(import_zod17.z.array(variableItem)).describe("Array of {collectionId, name, resolvedType}") },
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
    { items: flexJson(import_zod17.z.array(setValueItem)).describe("Array of {variableId, modeId, value}") },
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
      type: import_zod17.z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional().describe("Filter by type"),
      collectionId: import_zod17.z.string().optional().describe("Filter by collection. Omit for all collections."),
      includeValues: flexBool(import_zod17.z.boolean().optional()).describe("Include valuesByMode for each variable (default: false)")
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
    { variableId: import_zod17.z.string().describe("Variable ID") },
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
    { collectionId: import_zod17.z.string().describe("Collection ID") },
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
    { items: flexJson(import_zod17.z.array(bindingItem)).describe("Array of {nodeId, field, variableId}") },
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
    { items: flexJson(import_zod17.z.array(addModeItem)).describe("Array of {collectionId, name}") },
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
    { items: flexJson(import_zod17.z.array(renameModeItem)).describe("Array of {collectionId, modeId, name}") },
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
    { items: flexJson(import_zod17.z.array(removeModeItem)).describe("Array of {collectionId, modeId}") },
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
    { items: flexJson(import_zod17.z.array(setExplicitModeItem)).describe("Array of {nodeId, collectionId, modeId}") },
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
var import_zod18 = require("zod");
init_helpers();
var lintRules = import_zod18.z.enum([
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
      nodeId: import_zod18.z.string().optional().describe("Node ID to lint. Omit to lint current selection."),
      rules: flexJson(import_zod18.z.array(lintRules).optional()).describe('Rules to run. Default: ["all"]. Options: no-autolayout, shape-instead-of-frame, hardcoded-color, no-text-style, fixed-in-autolayout, default-name, empty-container, stale-text-name, all'),
      maxDepth: import_zod18.z.coerce.number().optional().describe("Max depth to recurse (default: 10)"),
      maxFindings: import_zod18.z.coerce.number().optional().describe("Stop after N findings (default: 50)")
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
      items: flexJson(import_zod18.z.array(import_zod18.z.object({
        nodeId,
        layoutMode: import_zod18.z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: auto-detect based on child positions)"),
        itemSpacing: import_zod18.z.coerce.number().optional().describe("Spacing between children (default: 0)")
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
      items: flexJson(import_zod18.z.array(import_zod18.z.object({
        nodeId,
        adoptChildren: flexBool(import_zod18.z.boolean().optional()).describe("Re-parent overlapping siblings into the new frame (default: true)")
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
  if (ws && ws.readyState === import_ws.default.OPEN) {
    logger.info("Already connected to Figma");
    return;
  }
  const wsUrl = serverUrl === "localhost" ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  ws = new import_ws.default(wsUrl);
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
  if (!ws || ws.readyState !== import_ws.default.OPEN) {
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
    if (!ws || ws.readyState !== import_ws.default.OPEN) {
      connectToFigma();
      reject(new Error("Not connected to Figma. Attempting to connect..."));
      return;
    }
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      reject(new Error("No channel joined. Call join_channel first with the channel name shown in the Figma plugin panel."));
      return;
    }
    const id = (0, import_uuid.v4)();
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
var server = new import_mcp.McpServer({
  name: "TalkToFigmaMCP",
  version: "1.0.0"
});
server.tool(
  "join_channel",
  "REQUIRED FIRST STEP: Join a channel before using any other tool. The channel name is shown in the Figma plugin UI. All subsequent commands are sent through this channel.",
  { channel: import_zod19.z.string().describe("The channel name displayed in the Figma plugin panel (e.g. 'channel-abc-123')").default("") },
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
  const transport = new import_stdio.StdioServerTransport();
  await server.connect(transport);
  logger.info("FigmaMCP server running on stdio");
}
main().catch((error) => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map