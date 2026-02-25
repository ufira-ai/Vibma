#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/talk_to_figma_mcp/server.ts
var import_mcp = require("@modelcontextprotocol/sdk/server/mcp.js");
var import_stdio = require("@modelcontextprotocol/sdk/server/stdio.js");
var import_zod = require("zod");
var import_ws = __toESM(require("ws"), 1);
var import_uuid = require("uuid");
var flexBool = (inner) => import_zod.z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, inner);
var flexJson = (inner) => import_zod.z.preprocess((v) => {
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}, inner);
var flexNum = (inner) => import_zod.z.preprocess((v) => {
  if (typeof v === "string") {
    const n = Number(v);
    if (!isNaN(n) && v.trim() !== "") return n;
  }
  return v;
}, inner);
var logger = {
  info: (message) => process.stderr.write(`[INFO] ${message}
`),
  debug: (message) => process.stderr.write(`[DEBUG] ${message}
`),
  warn: (message) => process.stderr.write(`[WARN] ${message}
`),
  error: (message) => process.stderr.write(`[ERROR] ${message}
`),
  log: (message) => process.stderr.write(`[LOG] ${message}
`)
};
var ws = null;
var pendingRequests = /* @__PURE__ */ new Map();
var currentChannel = null;
var server = new import_mcp.McpServer({
  name: "TalkToFigmaMCP",
  version: "1.0.0"
});
var args = process.argv.slice(2);
var serverArg = args.find((arg) => arg.startsWith("--server="));
var serverUrl = serverArg ? serverArg.split("=")[1] : "localhost";
var WS_URL = serverUrl === "localhost" ? `ws://${serverUrl}` : `wss://${serverUrl}`;
server.tool(
  "get_document_info",
  "Get information about the current Figma document including all pages and top-level children of the current page.",
  {
    depth: import_zod.z.coerce.number().optional().describe("How many levels of children to include on the current page. 0 or omit for top-level only, 1 includes grandchildren names.")
  },
  async ({ depth }) => {
    try {
      const result = await sendCommandToFigma("get_document_info", { depth });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting document info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "get_selection",
  "Get information about the current selection in Figma",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma("get_selection");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting selection: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "read_my_design",
  "Get detailed information about the current selection in Figma, including all node details. Use depth to control traversal.",
  {
    depth: import_zod.z.coerce.number().optional().describe("How many levels of children to recurse. 0=selection nodes only, 1=direct children, -1 or omit for unlimited.")
  },
  async ({ depth }) => {
    try {
      const result = await sendCommandToFigma("read_my_design", { depth });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "get_node_info",
  "Get detailed information about a specific node in Figma. Use depth to control how many levels of children to include (0=node only with child summaries, 1=direct children, -1=unlimited).",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to get information about"),
    depth: import_zod.z.coerce.number().optional().describe("How many levels of children to recurse into. 0=node only with child name/type stubs, 1=direct children fully, 2=grandchildren, etc. -1 or omit for unlimited depth.")
  },
  async ({ nodeId, depth }) => {
    try {
      const result = await sendCommandToFigma("get_node_info", { nodeId, depth });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filterFigmaNode(result, depth !== void 0 ? depth : -1))
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting node info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
function rgbaToHex(color) {
  if (color.startsWith("#")) {
    return color;
  }
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * 255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a === 255 ? "" : a.toString(16).padStart(2, "0")}`;
}
function filterFigmaNode(node, depth = -1, currentDepth = 0) {
  if (node.type === "VECTOR") {
    return null;
  }
  const filtered = {
    id: node.id,
    name: node.name,
    type: node.type
  };
  if (currentDepth === 0) {
    if (node.parentId) filtered.parentId = node.parentId;
    if (node.parentName) filtered.parentName = node.parentName;
    if (node.parentType) filtered.parentType = node.parentType;
  }
  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill) => {
      const processedFill = { ...fill };
      delete processedFill.boundVariables;
      delete processedFill.imageRef;
      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map((stop) => {
          const processedStop = { ...stop };
          if (processedStop.color) {
            processedStop.color = rgbaToHex(processedStop.color);
          }
          delete processedStop.boundVariables;
          return processedStop;
        });
      }
      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color);
      }
      return processedFill;
    });
  }
  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke) => {
      const processedStroke = { ...stroke };
      delete processedStroke.boundVariables;
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color);
      }
      return processedStroke;
    });
  }
  if (node.cornerRadius !== void 0) {
    filtered.cornerRadius = node.cornerRadius;
  }
  if (node.absoluteBoundingBox) {
    filtered.absoluteBoundingBox = node.absoluteBoundingBox;
  }
  if (node.characters) {
    filtered.characters = node.characters;
  }
  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx
    };
  }
  if (node.effects && node.effects.length > 0) {
    filtered.effects = node.effects;
  }
  if (node.layoutMode !== void 0) {
    filtered.layoutMode = node.layoutMode;
  }
  if (node.itemSpacing !== void 0) {
    filtered.itemSpacing = node.itemSpacing;
  }
  if (node.paddingLeft !== void 0) {
    filtered.padding = {
      left: node.paddingLeft,
      right: node.paddingRight,
      top: node.paddingTop,
      bottom: node.paddingBottom
    };
  }
  if (node.opacity !== void 0 && node.opacity !== 1) {
    filtered.opacity = node.opacity;
  }
  if (node.visible !== void 0 && node.visible === false) {
    filtered.visible = false;
  }
  if (node.constraints) {
    filtered.constraints = node.constraints;
  }
  if (node.children) {
    if (depth >= 0 && currentDepth >= depth) {
      filtered.children = node.children.map((child) => ({
        id: child.id,
        name: child.name,
        type: child.type
      }));
    } else {
      filtered.children = node.children.map((child) => filterFigmaNode(child, depth, currentDepth + 1)).filter((child) => child !== null);
    }
  }
  return filtered;
}
server.tool(
  "get_nodes_info",
  "Get detailed information about multiple nodes in Figma. Use depth to control child traversal.",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs. Example: ["1:2","1:3"]'),
    depth: import_zod.z.coerce.number().optional().describe("How many levels of children to recurse. 0=nodes only, 1=direct children, -1 or omit for unlimited.")
  },
  async ({ nodeIds, depth }) => {
    try {
      const results = await Promise.all(
        nodeIds.map(async (nodeId) => {
          const result = await sendCommandToFigma("get_node_info", { nodeId, depth });
          return { nodeId, info: result };
        })
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results.map((result) => filterFigmaNode(result.info, depth !== void 0 ? depth : -1)))
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "create_rectangle",
  "Create a new rectangle in Figma. Default: white fill (Figma native).",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    width: import_zod.z.coerce.number().optional().describe("Width (default: 100)"),
    height: import_zod.z.coerce.number().optional().describe("Height (default: 100)"),
    name: import_zod.z.string().optional().describe("Name for the rectangle (default: 'Rectangle')"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into")
  },
  async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_rectangle", {
        x,
        y,
        width,
        height,
        name,
        parentId
      });
      return {
        content: [
          {
            type: "text",
            text: `Created rectangle "${JSON.stringify(result)}"`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating rectangle: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "create_frame",
  "Create a new frame in Figma. Default: transparent fill, no stroke, no auto-layout.",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    width: import_zod.z.coerce.number().optional().describe("Width (default: 100)"),
    height: import_zod.z.coerce.number().optional().describe("Height (default: 100)"),
    name: import_zod.z.string().optional().describe("Name for the frame (default: 'Frame')"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into"),
    fillColor: flexJson(
      import_zod.z.object({
        r: import_zod.z.coerce.number().min(0).max(1),
        g: import_zod.z.coerce.number().min(0).max(1),
        b: import_zod.z.coerce.number().min(0).max(1),
        a: import_zod.z.coerce.number().min(0).max(1).optional()
      }).optional()
    ).describe('Fill color RGBA (0-1 each). Default: transparent. Example: {"r":1,"g":1,"b":1} for white'),
    strokeColor: flexJson(
      import_zod.z.object({
        r: import_zod.z.coerce.number().min(0).max(1),
        g: import_zod.z.coerce.number().min(0).max(1),
        b: import_zod.z.coerce.number().min(0).max(1),
        a: import_zod.z.coerce.number().min(0).max(1).optional()
      }).optional()
    ).describe('Stroke color RGBA (0-1 each). Default: no stroke. Example: {"r":0,"g":0,"b":0}'),
    strokeWeight: import_zod.z.coerce.number().positive().optional().describe("Stroke weight. Only applied if strokeColor is set."),
    layoutMode: import_zod.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE). The following layout params only apply when not NONE."),
    layoutWrap: import_zod.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)"),
    paddingTop: import_zod.z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: import_zod.z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: import_zod.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: import_zod.z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN). SPACE_BETWEEN overrides itemSpacing."),
    counterAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
    layoutSizingVertical: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
    itemSpacing: import_zod.z.number().optional().describe("Spacing between children (default: 0). Ignored if primaryAxisAlignItems is SPACE_BETWEEN.")
  },
  async ({
    x,
    y,
    width,
    height,
    name,
    parentId,
    fillColor,
    strokeColor,
    strokeWeight,
    layoutMode,
    layoutWrap,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    primaryAxisAlignItems,
    counterAxisAlignItems,
    layoutSizingHorizontal,
    layoutSizingVertical,
    itemSpacing
  }) => {
    try {
      const result = await sendCommandToFigma("create_frame", {
        x,
        y,
        width,
        height,
        name,
        parentId,
        fillColor,
        strokeColor,
        strokeWeight,
        layoutMode,
        layoutWrap,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
        primaryAxisAlignItems,
        counterAxisAlignItems,
        layoutSizingHorizontal,
        layoutSizingVertical,
        itemSpacing
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating frame: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "create_text",
  "Create a new text element in Figma. Uses Inter font family. When placing inside an auto-layout parent, set layoutSizingHorizontal to FILL so the text wraps to the parent width.",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    text: import_zod.z.string().describe("Text content"),
    fontSize: import_zod.z.coerce.number().optional().describe("Font size (default: 14)"),
    fontWeight: import_zod.z.coerce.number().optional().describe("Font weight (default: 400). Values: 100=Thin, 200=Extra Light, 300=Light, 400=Regular, 500=Medium, 600=Semi Bold, 700=Bold, 800=Extra Bold, 900=Black"),
    fontColor: flexJson(
      import_zod.z.object({
        r: import_zod.z.coerce.number().min(0).max(1),
        g: import_zod.z.coerce.number().min(0).max(1),
        b: import_zod.z.coerce.number().min(0).max(1),
        a: import_zod.z.coerce.number().min(0).max(1).optional()
      }).optional()
    ).describe('Font color RGBA (0-1 each). Default: black. Example: {"r":1,"g":0,"b":0} for red'),
    name: import_zod.z.string().optional().describe("Layer name (default: uses text content)"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into"),
    textStyleId: import_zod.z.string().optional().describe("Text style ID to apply (from create_text_style or get_styles). Overrides fontSize/fontWeight."),
    layoutSizingHorizontal: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. Use FILL to stretch to parent width (common for text in auto-layout). Automatically sets textAutoResize to HEIGHT when FILL is used."),
    layoutSizingVertical: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
    textAutoResize: import_zod.z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior. WIDTH_AND_HEIGHT (default) shrinks to fit. HEIGHT = fixed/fill width, auto height (set automatically when layoutSizingHorizontal is FILL). NONE = fixed size. TRUNCATE = fixed size with ellipsis.")
  },
  async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId, textStyleId, layoutSizingHorizontal, layoutSizingVertical, textAutoResize }) => {
    try {
      const result = await sendCommandToFigma("create_text", {
        x,
        y,
        text,
        fontSize: fontSize !== void 0 ? fontSize : 14,
        fontWeight: fontWeight !== void 0 ? fontWeight : 400,
        fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 },
        name,
        parentId,
        textStyleId,
        layoutSizingHorizontal,
        layoutSizingVertical,
        textAutoResize
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Created text "${typedResult.name}" with ID: ${typedResult.id}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating text: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_fill_color",
  "Set the fill color of a node in Figma can be TextNode or FrameNode",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to modify"),
    r: import_zod.z.coerce.number().min(0).max(1).describe("Red component (0-1)"),
    g: import_zod.z.coerce.number().min(0).max(1).describe("Green component (0-1)"),
    b: import_zod.z.coerce.number().min(0).max(1).describe("Blue component (0-1)"),
    a: import_zod.z.coerce.number().min(0).max(1).optional().describe("Alpha component (0-1, default: 1)")
  },
  async ({ nodeId, r, g, b, a }) => {
    try {
      const result = await sendCommandToFigma("set_fill_color", {
        nodeId,
        color: { r, g, b, a: a !== void 0 ? a : 1 }
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Set fill color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a !== void 0 ? a : 1})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_stroke_color",
  "Set the stroke color of a node in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to modify"),
    r: import_zod.z.coerce.number().min(0).max(1).describe("Red component (0-1)"),
    g: import_zod.z.coerce.number().min(0).max(1).describe("Green component (0-1)"),
    b: import_zod.z.coerce.number().min(0).max(1).describe("Blue component (0-1)"),
    a: import_zod.z.coerce.number().min(0).max(1).optional().describe("Alpha component (0-1, default: 1)"),
    weight: import_zod.z.coerce.number().positive().optional().describe("Stroke weight (default: 1)")
  },
  async ({ nodeId, r, g, b, a, weight }) => {
    try {
      const result = await sendCommandToFigma("set_stroke_color", {
        nodeId,
        color: { r, g, b, a: a !== void 0 ? a : 1 },
        weight: weight !== void 0 ? weight : 1
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Set stroke color of node "${typedResult.name}" to RGBA(${r}, ${g}, ${b}, ${a !== void 0 ? a : 1}) with weight ${weight !== void 0 ? weight : 1}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "move_node",
  "Move a node to a new position in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to move"),
    x: import_zod.z.coerce.number().describe("New X position"),
    y: import_zod.z.coerce.number().describe("New Y position")
  },
  async ({ nodeId, x, y }) => {
    try {
      const result = await sendCommandToFigma("move_node", { nodeId, x, y });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Moved node "${typedResult.name}" to position (${x}, ${y})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error moving node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "clone_node",
  "Clone an existing node in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to clone"),
    x: import_zod.z.coerce.number().optional().describe("New X position for the clone"),
    y: import_zod.z.coerce.number().optional().describe("New Y position for the clone")
  },
  async ({ nodeId, x, y }) => {
    try {
      const result = await sendCommandToFigma("clone_node", { nodeId, x, y });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Cloned node "${typedResult.name}" with new ID: ${typedResult.id}${x !== void 0 && y !== void 0 ? ` at position (${x}, ${y})` : ""}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error cloning node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "resize_node",
  "Resize a node in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to resize"),
    width: import_zod.z.coerce.number().positive().describe("New width"),
    height: import_zod.z.coerce.number().positive().describe("New height")
  },
  async ({ nodeId, width, height }) => {
    try {
      const result = await sendCommandToFigma("resize_node", {
        nodeId,
        width,
        height
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Resized node "${typedResult.name}" to width ${width} and height ${height}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error resizing node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "delete_node",
  "Delete a node from Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to delete")
  },
  async ({ nodeId }) => {
    try {
      await sendCommandToFigma("delete_node", { nodeId });
      return {
        content: [
          {
            type: "text",
            text: `Deleted node with ID: ${nodeId}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting node: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "delete_multiple_nodes",
  "Delete multiple nodes from Figma at once",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs to delete. Example: ["1:2","1:3"]')
  },
  async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma("delete_multiple_nodes", { nodeIds });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting multiple nodes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "export_node_as_image",
  "Export a node as an image from Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to export"),
    format: import_zod.z.enum(["PNG", "JPG", "SVG", "PDF"]).optional().describe("Export format (default: PNG)"),
    scale: import_zod.z.coerce.number().positive().optional().describe("Export scale (default: 1)")
  },
  async ({ nodeId, format, scale }) => {
    try {
      const result = await sendCommandToFigma("export_node_as_image", {
        nodeId,
        format,
        scale
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "image",
            data: typedResult.imageData,
            mimeType: typedResult.mimeType || "image/png"
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_text_content",
  "Set the text content of an existing text node in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the text node to modify"),
    text: import_zod.z.string().describe("New text content")
  },
  async ({ nodeId, text }) => {
    try {
      const result = await sendCommandToFigma("set_text_content", {
        nodeId,
        text
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Updated text content of node "${typedResult.name}" to "${text}"`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting text content: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "get_styles",
  "List local styles (paint, text, effect, grid) from the document. Returns only IDs, names, and keys (no paint/font details). Use get_style_by_id for full details on a specific style.",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma("get_styles");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "get_local_components",
  "List local components. Use setsOnly=true to get only component sets (not individual variants). Supports pagination and name filtering. Use get_component_by_id for full details.",
  {
    setsOnly: flexBool(import_zod.z.boolean().optional()).describe("If true, return only COMPONENT_SET nodes (top-level components, not variants). Dramatically reduces results in large files."),
    nameFilter: import_zod.z.string().optional().describe("Filter components by name (case-insensitive substring match)"),
    limit: import_zod.z.coerce.number().optional().describe("Max results to return (default 100)"),
    offset: import_zod.z.coerce.number().optional().describe("Skip this many results for pagination (default 0)")
  },
  async ({ setsOnly, nameFilter, limit, offset }) => {
    try {
      const result = await sendCommandToFigma("get_local_components", { setsOnly, nameFilter, limit, offset });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting local components: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "get_instance_overrides",
  "Get all override properties from a selected component instance. These overrides can be applied to other instances, which will swap them to match the source component.",
  {
    nodeId: import_zod.z.string().optional().describe("Optional ID of the component instance to get overrides from. If not provided, currently selected instance will be used.")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("get_instance_overrides", {
        instanceNodeId: nodeId || null
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: typedResult.success ? `Successfully got instance overrides: ${typedResult.message}` : `Failed to get instance overrides: ${typedResult.message}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error copying instance overrides: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_corner_radius",
  "Set the corner radius of a node in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to modify"),
    radius: import_zod.z.coerce.number().min(0).describe("Corner radius value"),
    corners: flexJson(
      import_zod.z.array(flexBool(import_zod.z.boolean())).length(4).optional()
    ).describe(
      "Array of 4 booleans for which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Example: [true,true,false,false]"
    )
  },
  async ({ nodeId, radius, corners }) => {
    try {
      const result = await sendCommandToFigma("set_corner_radius", {
        nodeId,
        radius,
        corners: corners || [true, true, true, true]
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Set corner radius of node "${typedResult.name}" to ${radius}px`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.prompt(
  "design_strategy",
  "Best practices for working with Figma designs",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `When working with Figma designs, follow these best practices:

1. Start with Document Structure:
   - First use get_document_info() to understand the current document
   - Plan your layout hierarchy before creating elements
   - Create a main container frame for each screen/section

2. Naming Conventions:
   - Use descriptive, semantic names for all elements
   - Follow a consistent naming pattern (e.g., "Login Screen", "Logo Container", "Email Input")
   - Group related elements with meaningful names

3. Layout Hierarchy:
   - Create parent frames first, then add child elements
   - For forms/login screens:
     * Start with the main screen container frame
     * Create a logo container at the top
     * Group input fields in their own containers
     * Place action buttons (login, submit) after inputs
     * Add secondary elements (forgot password, signup links) last

4. Input Fields Structure:
   - Create a container frame for each input field
   - Include a label text above or inside the input
   - Group related inputs (e.g., username/password) together

5. Element Creation:
   - Use create_frame() for containers and input fields
   - Use create_text() for labels, buttons text, and links
   - Set appropriate colors and styles:
     * Use fillColor for backgrounds
     * Use strokeColor for borders
     * Set proper fontWeight for different text elements

6. Mofifying existing elements:
  - use set_text_content() to modify text content.

7. Visual Hierarchy:
   - Position elements in logical reading order (top to bottom)
   - Maintain consistent spacing between elements
   - Use appropriate font sizes for different text types:
     * Larger for headings/welcome text
     * Medium for input labels
     * Standard for button text
     * Smaller for helper text/links

8. Best Practices:
   - Verify each creation with get_node_info()
   - Use parentId to maintain proper hierarchy
   - Group related elements together in frames
   - Keep consistent spacing and alignment

Example Login Screen Structure:
- Login Screen (main frame)
  - Logo Container (frame)
    - Logo (image/text)
  - Welcome Text (text)
  - Input Container (frame)
    - Email Input (frame)
      - Email Label (text)
      - Email Field (frame)
    - Password Input (frame)
      - Password Label (text)
      - Password Field (frame)
  - Login Button (frame)
    - Button Text (text)
  - Helper Links (frame)
    - Forgot Password (text)
    - Don't have account (text)`
          }
        }
      ],
      description: "Best practices for working with Figma designs"
    };
  }
);
server.prompt(
  "read_design_strategy",
  "Best practices for reading Figma designs",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use read_my_design() to understand the current selection
   - If no selection ask user to select single or multiple nodes
`
          }
        }
      ],
      description: "Best practices for reading Figma designs"
    };
  }
);
server.tool(
  "scan_text_nodes",
  "Scan all text nodes in the selected Figma node",
  {
    nodeId: import_zod.z.string().describe("ID of the node to scan")
  },
  async ({ nodeId }) => {
    try {
      const initialStatus = {
        type: "text",
        text: "Starting text node scanning. This may take a moment for large designs..."
      };
      const result = await sendCommandToFigma("scan_text_nodes", {
        nodeId,
        useChunking: true,
        // Enable chunking on the plugin side
        chunkSize: 10
        // Process 10 nodes at a time
      });
      if (result && typeof result === "object" && "chunks" in result) {
        const typedResult = result;
        const summaryText = `
        Scan completed:
        - Found ${typedResult.totalNodes} text nodes
        - Processed in ${typedResult.chunks} chunks
        `;
        return {
          content: [
            initialStatus,
            {
              type: "text",
              text: summaryText
            },
            {
              type: "text",
              text: JSON.stringify(typedResult.textNodes, null, 2)
            }
          ]
        };
      }
      return {
        content: [
          initialStatus,
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.prompt(
  "text_replacement_strategy",
  "Systematic approach for replacing text in Figma designs",
  (extra) => {
    return {
      messages: [
        {
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
set_multiple_text_contents(
  nodeId: "parent-node-id", 
  text: [
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
        }
      ],
      description: "Systematic approach for replacing text in Figma designs"
    };
  }
);
server.tool(
  "set_multiple_text_contents",
  "Set multiple text contents parallelly in a node",
  {
    nodeId: import_zod.z.string().describe("The ID of the node containing the text nodes to replace"),
    text: flexJson(
      import_zod.z.array(
        import_zod.z.object({
          nodeId: import_zod.z.string().describe("The ID of the text node"),
          text: import_zod.z.string().describe("The replacement text")
        })
      )
    ).describe('Array of {nodeId, text} pairs. Example: [{"nodeId":"1:2","text":"Hello"}]')
  },
  async ({ nodeId, text }) => {
    try {
      if (!text || text.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No text provided"
            }
          ]
        };
      }
      const initialStatus = {
        type: "text",
        text: `Starting text replacement for ${text.length} nodes. This will be processed in batches of 5...`
      };
      let totalProcessed = 0;
      const totalToProcess = text.length;
      const result = await sendCommandToFigma("set_multiple_text_contents", {
        nodeId,
        text
      });
      const typedResult = result;
      const success = typedResult.replacementsApplied && typedResult.replacementsApplied > 0;
      const progressText = `
      Text replacement completed:
      - ${typedResult.replacementsApplied || 0} of ${totalToProcess} successfully updated
      - ${typedResult.replacementsFailed || 0} failed
      - Processed in ${typedResult.completedInChunks || 1} batches
      `;
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter((item) => !item.success);
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `

Nodes that failed:
${failedResults.map(
          (item) => `- ${item.nodeId}: ${item.error || "Unknown error"}`
        ).join("\n")}`;
      }
      return {
        content: [
          initialStatus,
          {
            type: "text",
            text: progressText + detailedResponse
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting multiple text contents: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.prompt(
  "annotation_conversion_strategy",
  "Strategy for converting manual annotations to Figma's native annotations",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Automatic Annotation Conversion
            
## Process Overview

The process of converting manual annotations (numbered/alphabetical indicators with connected descriptions) to Figma's native annotations:

1. Get selected frame/component information
2. Scan and collect all annotation text nodes
3. Scan target UI elements (components, instances, frames)
4. Match annotations to appropriate UI elements
5. Apply native Figma annotations

## Step 1: Get Selection and Initial Setup

First, get the selected frame or component that contains annotations:

\`\`\`typescript
// Get the selected frame/component
const selection = await get_selection();
const selectedNodeId = selection[0].id

// Get available annotation categories for later use
const annotationData = await get_annotations({
  nodeId: selectedNodeId,
  includeCategories: true
});
const categories = annotationData.categories;
\`\`\`

## Step 2: Scan Annotation Text Nodes

Scan all text nodes to identify annotations and their descriptions:

\`\`\`typescript
// Get all text nodes in the selection
const textNodes = await scan_text_nodes({
  nodeId: selectedNodeId
});

// Filter and group annotation markers and descriptions

// Markers typically have these characteristics:
// - Short text content (usually single digit/letter)
// - Specific font styles (often bold)
// - Located in a container with "Marker" or "Dot" in the name
// - Have a clear naming pattern (e.g., "1", "2", "3" or "A", "B", "C")


// Identify description nodes
// Usually longer text nodes near markers or with matching numbers in path
  
\`\`\`

## Step 3: Scan Target UI Elements

Get all potential target elements that annotations might refer to:

\`\`\`typescript
// Scan for all UI elements that could be annotation targets
const targetNodes = await scan_nodes_by_types({
  nodeId: selectedNodeId,
  types: [
    "COMPONENT",
    "INSTANCE",
    "FRAME"
  ]
});
\`\`\`

## Step 4: Match Annotations to Targets

Match each annotation to its target UI element using these strategies in order of priority:

1. **Path-Based Matching**:
   - Look at the marker's parent container name in the Figma layer hierarchy
   - Remove any "Marker:" or "Annotation:" prefixes from the parent name
   - Find UI elements that share the same parent name or have it in their path
   - This works well when markers are grouped with their target elements

2. **Name-Based Matching**:
   - Extract key terms from the annotation description
   - Look for UI elements whose names contain these key terms
   - Consider both exact matches and semantic similarities
   - Particularly effective for form fields, buttons, and labeled components

3. **Proximity-Based Matching** (fallback):
   - Calculate the center point of the marker
   - Find the closest UI element by measuring distances to element centers
   - Consider the marker's position relative to nearby elements
   - Use this method when other matching strategies fail

Additional Matching Considerations:
- Give higher priority to matches found through path-based matching
- Consider the type of UI element when evaluating matches
- Take into account the annotation's context and content
- Use a combination of strategies for more accurate matching

## Step 5: Apply Native Annotations

Convert matched annotations to Figma's native annotations using batch processing:

\`\`\`typescript
// Prepare annotations array for batch processing
const annotationsToApply = Object.values(annotations).map(({ marker, description }) => {
  // Find target using multiple strategies
  const target = 
    findTargetByPath(marker, targetNodes) ||
    findTargetByName(description, targetNodes) ||
    findTargetByProximity(marker, targetNodes);
  
  if (target) {
    // Determine appropriate category based on content
    const category = determineCategory(description.characters, categories);

    // Determine appropriate additional annotationProperty based on content
    const annotationProperty = determineProperties(description.characters, target.type);
    
    return {
      nodeId: target.id,
      labelMarkdown: description.characters,
      categoryId: category.id,
      properties: annotationProperty
    };
  }
  return null;
}).filter(Boolean); // Remove null entries

// Apply annotations in batches using set_multiple_annotations
if (annotationsToApply.length > 0) {
  await set_multiple_annotations({
    nodeId: selectedNodeId,
    annotations: annotationsToApply
  });
}
\`\`\`


This strategy focuses on practical implementation based on real-world usage patterns, emphasizing the importance of handling various UI elements as annotation targets, not just text nodes.`
          }
        }
      ],
      description: "Strategy for converting manual annotations to Figma's native annotations"
    };
  }
);
server.prompt(
  "swap_overrides_instances",
  "Guide to swap instance overrides between instances",
  (extra) => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text",
            text: `# Swap Component Instance and Override Strategy

## Overview
This strategy enables transferring content and property overrides from a source instance to one or more target instances in Figma, maintaining design consistency while reducing manual work.

## Step-by-Step Process

### 1. Selection Analysis
- Use \`get_selection()\` to identify the parent component or selected instances
- For parent components, scan for instances with \`scan_nodes_by_types({ nodeId: "parent-id", types: ["INSTANCE"] })\`
- Identify custom slots by name patterns (e.g. "Custom Slot*" or "Instance Slot") or by examining text content
- Determine which is the source instance (with content to copy) and which are targets (where to apply content)

### 2. Extract Source Overrides
- Use \`get_instance_overrides()\` to extract customizations from the source instance
- This captures text content, property values, and style overrides
- Command syntax: \`get_instance_overrides({ nodeId: "source-instance-id" })\`
- Look for successful response like "Got component information from [instance name]"

### 3. Apply Overrides to Targets
- Apply captured overrides using \`set_instance_overrides()\`
- Command syntax:
  \`\`\`
  set_instance_overrides({
    sourceInstanceId: "source-instance-id", 
    targetNodeIds: ["target-id-1", "target-id-2", ...]
  })
  \`\`\`

### 4. Verification
- Verify results with \`get_node_info()\` or \`read_my_design()\`
- Confirm text content and style overrides have transferred successfully

## Key Tips
- Always join the appropriate channel first with \`join_channel()\`
- When working with multiple targets, check the full selection with \`get_selection()\`
- Preserve component relationships by using instance overrides rather than direct text manipulation`
          }
        }
      ],
      description: "Strategy for transferring overrides between component instances in Figma"
    };
  }
);
server.tool(
  "set_layout_mode",
  "Set the layout mode and wrap behavior of a frame in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the frame to modify"),
    layoutMode: import_zod.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode for the frame"),
    layoutWrap: import_zod.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)")
  },
  async ({ nodeId, layoutMode, layoutWrap }) => {
    try {
      const result = await sendCommandToFigma("set_layout_mode", {
        nodeId,
        layoutMode,
        layoutWrap
      });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Set layout mode of frame "${typedResult.name}" to ${layoutMode}${layoutWrap ? ` with ${layoutWrap}` : ""}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting layout mode: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_padding",
  "Set padding values for an auto-layout frame in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the frame to modify"),
    paddingTop: import_zod.z.coerce.number().optional().describe("Top padding value"),
    paddingRight: import_zod.z.coerce.number().optional().describe("Right padding value"),
    paddingBottom: import_zod.z.coerce.number().optional().describe("Bottom padding value"),
    paddingLeft: import_zod.z.coerce.number().optional().describe("Left padding value")
  },
  async ({ nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft }) => {
    try {
      const result = await sendCommandToFigma("set_padding", {
        nodeId,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft
      });
      const typedResult = result;
      const paddingMessages = [];
      if (paddingTop !== void 0) paddingMessages.push(`top: ${paddingTop}`);
      if (paddingRight !== void 0) paddingMessages.push(`right: ${paddingRight}`);
      if (paddingBottom !== void 0) paddingMessages.push(`bottom: ${paddingBottom}`);
      if (paddingLeft !== void 0) paddingMessages.push(`left: ${paddingLeft}`);
      const paddingText = paddingMessages.length > 0 ? `padding (${paddingMessages.join(", ")})` : "padding";
      return {
        content: [
          {
            type: "text",
            text: `Set ${paddingText} for frame "${typedResult.name}"`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting padding: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_axis_align",
  "Set primary and counter axis alignment for an auto-layout frame in Figma",
  {
    nodeId: import_zod.z.string().describe("The ID of the frame to modify"),
    primaryAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (MIN/MAX = left/right in horizontal, top/bottom in vertical). Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
    counterAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (MIN/MAX = top/bottom in horizontal, left/right in vertical)")
  },
  async ({ nodeId, primaryAxisAlignItems, counterAxisAlignItems }) => {
    try {
      const result = await sendCommandToFigma("set_axis_align", {
        nodeId,
        primaryAxisAlignItems,
        counterAxisAlignItems
      });
      const typedResult = result;
      const alignMessages = [];
      if (primaryAxisAlignItems !== void 0) alignMessages.push(`primary: ${primaryAxisAlignItems}`);
      if (counterAxisAlignItems !== void 0) alignMessages.push(`counter: ${counterAxisAlignItems}`);
      const alignText = alignMessages.length > 0 ? `axis alignment (${alignMessages.join(", ")})` : "axis alignment";
      return {
        content: [
          {
            type: "text",
            text: `Set ${alignText} for frame "${typedResult.name}"`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting axis alignment: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_layout_sizing",
  "Set horizontal and vertical sizing modes for auto-layout containers (frames, components, instances) or their children (including TEXT nodes)",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to modify"),
    layoutSizingHorizontal: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing mode (HUG for frames/text only, FILL for auto-layout children only)"),
    layoutSizingVertical: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing mode (HUG for frames/text only, FILL for auto-layout children only)")
  },
  async ({ nodeId, layoutSizingHorizontal, layoutSizingVertical }) => {
    try {
      const result = await sendCommandToFigma("set_layout_sizing", {
        nodeId,
        layoutSizingHorizontal,
        layoutSizingVertical
      });
      const typedResult = result;
      const sizingMessages = [];
      if (layoutSizingHorizontal !== void 0) sizingMessages.push(`horizontal: ${layoutSizingHorizontal}`);
      if (layoutSizingVertical !== void 0) sizingMessages.push(`vertical: ${layoutSizingVertical}`);
      const sizingText = sizingMessages.length > 0 ? `layout sizing (${sizingMessages.join(", ")})` : "layout sizing";
      return {
        content: [
          {
            type: "text",
            text: `Set ${sizingText} for frame "${typedResult.name}"`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting layout sizing: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_item_spacing",
  "Set distance between children in an auto-layout frame. Provide at least one of itemSpacing or counterAxisSpacing.",
  {
    nodeId: import_zod.z.string().describe("The ID of the frame to modify"),
    itemSpacing: import_zod.z.coerce.number().optional().describe("Distance between children. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN."),
    counterAxisSpacing: import_zod.z.coerce.number().optional().describe("Distance between wrapped rows/columns. Only works when layoutWrap is set to WRAP.")
  },
  async ({ nodeId, itemSpacing, counterAxisSpacing }) => {
    try {
      const params = { nodeId };
      if (itemSpacing !== void 0) params.itemSpacing = itemSpacing;
      if (counterAxisSpacing !== void 0) params.counterAxisSpacing = counterAxisSpacing;
      const result = await sendCommandToFigma("set_item_spacing", params);
      const typedResult = result;
      let message = `Updated spacing for frame "${typedResult.name}":`;
      if (itemSpacing !== void 0) message += ` itemSpacing=${itemSpacing}`;
      if (counterAxisSpacing !== void 0) message += ` counterAxisSpacing=${counterAxisSpacing}`;
      return {
        content: [
          {
            type: "text",
            text: message
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting spacing: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_focus",
  "Set focus on a specific node in Figma by selecting it and scrolling viewport to it",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to focus on")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("set_focus", { nodeId });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Focused on node "${typedResult.name}" (ID: ${typedResult.id})`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting focus: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
server.tool(
  "set_selections",
  "Set selection to multiple nodes in Figma and scroll viewport to show them",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs to select. Example: ["1:2","1:3"]')
  },
  async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma("set_selections", { nodeIds });
      const typedResult = result;
      return {
        content: [
          {
            type: "text",
            text: `Selected ${typedResult.count} nodes: ${typedResult.selectedNodes.map((node) => `"${node.name}" (${node.id})`).join(", ")}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting selections: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
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
      logger.log("myResponse" + JSON.stringify(myResponse));
      if (myResponse.id && pendingRequests.has(myResponse.id) && myResponse.result) {
        const request = pendingRequests.get(myResponse.id);
        clearTimeout(request.timeout);
        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new Error(myResponse.error));
        } else {
          if (myResponse.result) {
            request.resolve(myResponse.result);
          }
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
      reject(new Error("Must join a channel before sending commands"));
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
          // Include the command ID in params
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
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now()
    });
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}
server.tool(
  "create_component",
  "Create a new component in Figma. Default: transparent fill, no stroke, no auto-layout. Same layout params as create_frame.",
  {
    name: import_zod.z.string().describe("Name for the component"),
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    width: import_zod.z.coerce.number().optional().describe("Width (default: 100)"),
    height: import_zod.z.coerce.number().optional().describe("Height (default: 100)"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into"),
    fillColor: flexJson(import_zod.z.object({
      r: import_zod.z.coerce.number().min(0).max(1),
      g: import_zod.z.coerce.number().min(0).max(1),
      b: import_zod.z.coerce.number().min(0).max(1),
      a: import_zod.z.coerce.number().min(0).max(1).optional()
    }).optional()).describe('Fill color RGBA (0-1 each). Default: transparent. Example: {"r":1,"g":1,"b":1} for white'),
    strokeColor: flexJson(import_zod.z.object({
      r: import_zod.z.coerce.number().min(0).max(1),
      g: import_zod.z.coerce.number().min(0).max(1),
      b: import_zod.z.coerce.number().min(0).max(1),
      a: import_zod.z.coerce.number().min(0).max(1).optional()
    }).optional()).describe('Stroke color RGBA (0-1 each). Default: no stroke. Example: {"r":0,"g":0,"b":0}'),
    strokeWeight: import_zod.z.coerce.number().positive().optional().describe("Stroke weight. Only applied if strokeColor is set."),
    cornerRadius: import_zod.z.coerce.number().optional().describe("Corner radius"),
    layoutMode: import_zod.z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
    layoutWrap: import_zod.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)"),
    paddingTop: import_zod.z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: import_zod.z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: import_zod.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: import_zod.z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
    counterAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
    layoutSizingVertical: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
    itemSpacing: import_zod.z.coerce.number().optional().describe("Spacing between children (default: 0)")
  },
  async ({ name, x, y, width, height, parentId, fillColor, strokeColor, strokeWeight, cornerRadius, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing }) => {
    try {
      const result = await sendCommandToFigma("create_component", { name, x, y, width, height, parentId, fillColor, strokeColor, strokeWeight, cornerRadius, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_component_from_node",
  "Convert an existing node into a component",
  {
    nodeId: import_zod.z.string().describe("The ID of the node to convert to a component")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("create_component_from_node", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component from node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "combine_as_variants",
  "Combine multiple components into a variant set",
  {
    componentIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of component node IDs to combine. Example: ["1:2","1:3"]'),
    name: import_zod.z.string().optional().describe("Name for the component set")
  },
  async ({ componentIds, name }) => {
    try {
      const result = await sendCommandToFigma("combine_as_variants", { componentIds, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error combining variants: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "add_component_property",
  "Add a property to a component (BOOLEAN, TEXT, INSTANCE_SWAP, or VARIANT)",
  {
    componentId: import_zod.z.string().describe("The component node ID"),
    propertyName: import_zod.z.string().describe("Name of the property"),
    type: import_zod.z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Type of the property"),
    defaultValue: flexBool(import_zod.z.union([import_zod.z.string(), import_zod.z.boolean()])).describe('Default value \u2014 string for TEXT/VARIANT/INSTANCE_SWAP, boolean for BOOLEAN. Examples: "Click me", true'),
    preferredValues: flexJson(import_zod.z.array(import_zod.z.object({
      type: import_zod.z.enum(["COMPONENT", "COMPONENT_SET"]),
      key: import_zod.z.string()
    })).optional()).describe('Preferred values for INSTANCE_SWAP. Example: [{"type":"COMPONENT","key":"abc123"}]')
  },
  async ({ componentId, propertyName, type, defaultValue, preferredValues }) => {
    try {
      const result = await sendCommandToFigma("add_component_property", { componentId, propertyName, type, defaultValue, preferredValues });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding component property: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_instance_from_local",
  "Create an instance of a local component by its node ID. Accepts both COMPONENT and COMPONENT_SET IDs (picks default variant).",
  {
    componentId: import_zod.z.string().describe("The node ID of the local component or component set to instantiate"),
    x: import_zod.z.coerce.number().optional().describe("X position for the instance"),
    y: import_zod.z.coerce.number().optional().describe("Y position for the instance"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append to")
  },
  async ({ componentId, x, y, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_instance_from_local", { componentId, x, y, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating instance: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_variable_collection",
  "Create a new variable collection for design tokens",
  {
    name: import_zod.z.string().describe("Name for the variable collection")
  },
  async ({ name }) => {
    try {
      const result = await sendCommandToFigma("create_variable_collection", { name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating variable collection: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_variable",
  "Create a new variable (design token) in a collection",
  {
    collectionId: import_zod.z.string().describe("The variable collection ID"),
    name: import_zod.z.string().describe("Name for the variable"),
    resolvedType: import_zod.z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("The variable type")
  },
  async ({ collectionId, name, resolvedType }) => {
    try {
      const result = await sendCommandToFigma("create_variable", { collectionId, name, resolvedType });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_variable_value",
  "Set a variable's value for a specific mode",
  {
    variableId: import_zod.z.string().describe("The variable ID"),
    modeId: import_zod.z.string().describe("The mode ID to set the value for"),
    value: flexJson(import_zod.z.union([
      import_zod.z.number(),
      import_zod.z.string(),
      import_zod.z.boolean(),
      import_zod.z.object({
        r: import_zod.z.coerce.number().describe("Red (0-1)"),
        g: import_zod.z.coerce.number().describe("Green (0-1)"),
        b: import_zod.z.coerce.number().describe("Blue (0-1)"),
        a: import_zod.z.coerce.number().optional().describe("Alpha (0-1, default 1)")
      })
    ])).describe('The value \u2014 number for FLOAT, string for STRING, boolean for BOOLEAN, {r,g,b,a} object (0-1) for COLOR. Example COLOR: {"r":0.2,"g":0.5,"b":1,"a":1}')
  },
  async ({ variableId, modeId, value }) => {
    try {
      const result = await sendCommandToFigma("set_variable_value", { variableId, modeId, value });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting variable value: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "add_mode",
  "Add a new mode to a variable collection",
  {
    collectionId: import_zod.z.string().describe("The variable collection ID"),
    name: import_zod.z.string().describe("Name for the new mode")
  },
  async ({ collectionId, name }) => {
    try {
      const result = await sendCommandToFigma("add_mode", { collectionId, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "rename_mode",
  "Rename an existing mode in a variable collection",
  {
    collectionId: import_zod.z.string().describe("The variable collection ID"),
    modeId: import_zod.z.string().describe("The mode ID to rename"),
    name: import_zod.z.string().describe("New name for the mode")
  },
  async ({ collectionId, modeId, name }) => {
    try {
      const result = await sendCommandToFigma("rename_mode", { collectionId, modeId, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "remove_mode",
  "Remove a mode from a variable collection",
  {
    collectionId: import_zod.z.string().describe("The variable collection ID"),
    modeId: import_zod.z.string().describe("The mode ID to remove")
  },
  async ({ collectionId, modeId }) => {
    try {
      const result = await sendCommandToFigma("remove_mode", { collectionId, modeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "rename_page",
  "Rename a page. Defaults to current page if no pageId given.",
  {
    newName: import_zod.z.string().describe("New name for the page"),
    pageId: import_zod.z.string().optional().describe("Page ID to rename (defaults to current page)")
  },
  async ({ newName, pageId }) => {
    try {
      const result = await sendCommandToFigma("rename_page", { newName, pageId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "zoom_into_view",
  "Scroll and zoom the viewport to fit specific nodes on screen (like pressing Shift+1). Use this to bring the user's attention to nodes you just created or modified.",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs to zoom into view. Example: ["1:2"]')
  },
  async ({ nodeIds }) => {
    try {
      const result = await sendCommandToFigma("zoom_into_view", { nodeIds });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error zooming into view: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_viewport",
  "Set the viewport center position and/or zoom level. Zoom 1.0 = 100%, 0.5 = 50%, 2.0 = 200%.",
  {
    center: flexJson(import_zod.z.object({
      x: import_zod.z.coerce.number().describe("X coordinate of viewport center"),
      y: import_zod.z.coerce.number().describe("Y coordinate of viewport center")
    }).optional()).describe('Viewport center point. Example: {"x":500,"y":300}'),
    zoom: import_zod.z.coerce.number().min(0.01).max(256).optional().describe("Zoom level (1.0 = 100%)")
  },
  async ({ center, zoom }) => {
    try {
      const result = await sendCommandToFigma("set_viewport", { center, zoom });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting viewport: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_auto_layout",
  "Wrap existing nodes in an auto-layout frame. One call replaces create_frame + set_layout_mode + insert_child \xD7 N. Defaults to VERTICAL layout with HUG sizing.",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs to wrap. Example: ["1:2","1:3"]'),
    name: import_zod.z.string().optional().describe("Name for the frame (default 'Auto Layout')"),
    layoutMode: import_zod.z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default VERTICAL)"),
    itemSpacing: import_zod.z.coerce.number().optional().describe("Spacing between children (default 0)"),
    paddingTop: import_zod.z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: import_zod.z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: import_zod.z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: import_zod.z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
    counterAxisAlignItems: import_zod.z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: HUG)"),
    layoutSizingVertical: import_zod.z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
    layoutWrap: import_zod.z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)")
  },
  async ({ nodeIds, name, layoutMode, itemSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, layoutWrap }) => {
    try {
      const result = await sendCommandToFigma("create_auto_layout", { nodeIds, name, layoutMode, itemSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, layoutWrap });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating auto layout: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_local_variables",
  "List local variables (names, IDs, types only - no values). Use collectionId to browse a specific collection's contents. Use get_variable_by_id for full values.",
  {
    type: import_zod.z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional().describe("Filter by variable type"),
    collectionId: import_zod.z.string().optional().describe("Filter to variables in this collection only")
  },
  async ({ type, collectionId }) => {
    try {
      const result = await sendCommandToFigma("get_local_variables", { type, collectionId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variables: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_local_variable_collections",
  "List all local variable collections",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma("get_local_variable_collections");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variable collections: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_variable_binding",
  "Bind a variable to a node property. For scalar fields use the field name directly (e.g., 'opacity', 'itemSpacing', 'cornerRadius'). For paint colors use 'fills/0/color' or 'strokes/0/color' syntax.",
  {
    nodeId: import_zod.z.string().describe("The node ID to bind the variable to"),
    field: import_zod.z.string().describe("Property field: scalar fields like 'opacity', 'width', 'itemSpacing', 'paddingLeft', 'visible', 'topLeftRadius', 'strokeWeight'; or paint color fields like 'fills/0/color', 'strokes/0/color'"),
    variableId: import_zod.z.string().describe("The variable ID to bind")
  },
  async ({ nodeId, field, variableId }) => {
    try {
      const result = await sendCommandToFigma("set_variable_binding", { nodeId, field, variableId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error binding variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_paint_style",
  "Create a color/paint style",
  {
    name: import_zod.z.string().describe("Name for the paint style"),
    color: flexJson(import_zod.z.object({
      r: import_zod.z.coerce.number().describe("Red (0-1)"),
      g: import_zod.z.coerce.number().describe("Green (0-1)"),
      b: import_zod.z.coerce.number().describe("Blue (0-1)"),
      a: import_zod.z.coerce.number().optional().describe("Alpha (0-1, default 1)")
    })).describe('Color RGBA (0-1 each). Example: {"r":0.2,"g":0.5,"b":1} \u2014 omit a for full opacity')
  },
  async ({ name, color }) => {
    try {
      const result = await sendCommandToFigma("create_paint_style", { name, color });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating paint style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_text_style",
  "Create a text style with font properties",
  {
    name: import_zod.z.string().describe("Name for the text style"),
    fontFamily: import_zod.z.string().describe("Font family name"),
    fontStyle: import_zod.z.string().optional().describe("Font style (e.g., 'Regular', 'Bold', 'Italic') (default: 'Regular')"),
    fontSize: import_zod.z.coerce.number().describe("Font size in pixels"),
    lineHeight: flexNum(import_zod.z.union([
      import_zod.z.number(),
      import_zod.z.object({
        value: import_zod.z.coerce.number(),
        unit: import_zod.z.enum(["PIXELS", "PERCENT", "AUTO"])
      })
    ]).optional()).describe('Line height \u2014 number (pixels) or {value, unit}. Examples: 24, {"value":150,"unit":"PERCENT"}'),
    letterSpacing: flexNum(import_zod.z.union([
      import_zod.z.number(),
      import_zod.z.object({
        value: import_zod.z.coerce.number(),
        unit: import_zod.z.enum(["PIXELS", "PERCENT"])
      })
    ]).optional()).describe('Letter spacing \u2014 number (pixels) or {value, unit}. Examples: 0.5, {"value":2,"unit":"PERCENT"}'),
    textCase: import_zod.z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional().describe("Text case transform"),
    textDecoration: import_zod.z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional().describe("Text decoration")
  },
  async ({ name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textCase, textDecoration }) => {
    try {
      const result = await sendCommandToFigma("create_text_style", { name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textCase, textDecoration });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating text style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_effect_style",
  "Create an effect style (shadows, blurs)",
  {
    name: import_zod.z.string().describe("Name for the effect style"),
    effects: flexJson(import_zod.z.array(import_zod.z.object({
      type: import_zod.z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
      color: import_zod.z.object({
        r: import_zod.z.coerce.number(),
        g: import_zod.z.coerce.number(),
        b: import_zod.z.coerce.number(),
        a: import_zod.z.coerce.number().optional()
      }).optional().describe('Effect color RGBA (0-1). Example: {"r":0,"g":0,"b":0,"a":0.25}'),
      offset: import_zod.z.object({
        x: import_zod.z.coerce.number(),
        y: import_zod.z.coerce.number()
      }).optional().describe('Shadow offset. Example: {"x":0,"y":4}'),
      radius: import_zod.z.coerce.number().describe("Blur radius"),
      spread: import_zod.z.coerce.number().optional().describe("Shadow spread"),
      visible: flexBool(import_zod.z.boolean().optional()).describe("Whether effect is visible (default true)"),
      blendMode: import_zod.z.enum(["NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LIGHTEN", "SCREEN", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]).optional().describe("Blend mode for shadows (default NORMAL)")
    }))).describe('Array of effects. Example: [{"type":"DROP_SHADOW","color":{"r":0,"g":0,"b":0,"a":0.25},"offset":{"x":0,"y":4},"radius":4}]')
  },
  async ({ name, effects }) => {
    try {
      const result = await sendCommandToFigma("create_effect_style", { name, effects });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating effect style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "apply_style_to_node",
  "Apply a style to a node by ID or name. Provide either styleId or styleName (name supports case-insensitive substring match).",
  {
    nodeId: import_zod.z.string().describe("The node ID to apply the style to"),
    styleId: import_zod.z.string().optional().describe("The style ID to apply (from create_paint_style, create_text_style, etc.)"),
    styleName: import_zod.z.string().optional().describe('Style name to look up (e.g., "Heading/Large Title"). Case-insensitive substring match. Use instead of styleId for convenience.'),
    styleType: import_zod.z.enum(["fill", "stroke", "text", "effect"]).describe("Type of style to apply")
  },
  async ({ nodeId, styleId, styleName, styleType }) => {
    try {
      const result = await sendCommandToFigma("apply_style_to_node", { nodeId, styleId, styleName, styleType });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error applying style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_ellipse",
  "Create an ellipse/circle in Figma. Default: white fill (Figma native). Use equal width/height for a circle.",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    width: import_zod.z.coerce.number().optional().describe("Width (default: 100)"),
    height: import_zod.z.coerce.number().optional().describe("Height (default: 100)"),
    name: import_zod.z.string().optional().describe("Name for the ellipse"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into")
  },
  async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_ellipse", { x, y, width, height, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating ellipse: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_line",
  "Create a line in Figma. Default: black stroke.",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    length: import_zod.z.coerce.number().optional().describe("Length of the line (default: 100)"),
    rotation: import_zod.z.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
    name: import_zod.z.string().optional().describe("Name for the line"),
    parentId: import_zod.z.string().optional().describe("Parent node ID to append into")
  },
  async ({ x, y, length, rotation, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_line", { x, y, length, rotation, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating line: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_boolean_operation",
  "Create a boolean operation (union, intersect, subtract, exclude) from multiple nodes",
  {
    nodeIds: flexJson(import_zod.z.array(import_zod.z.string())).describe('Array of node IDs to combine. Example: ["1:2","1:3"]'),
    operation: import_zod.z.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
    name: import_zod.z.string().optional().describe("Name for the resulting node")
  },
  async ({ nodeIds, operation, name }) => {
    try {
      const result = await sendCommandToFigma("create_boolean_operation", { nodeIds, operation, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating boolean operation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_opacity",
  "Set the opacity of a node",
  {
    nodeId: import_zod.z.string().describe("The node ID"),
    opacity: import_zod.z.coerce.number().min(0).max(1).describe("Opacity value (0-1)")
  },
  async ({ nodeId, opacity }) => {
    try {
      const result = await sendCommandToFigma("set_opacity", { nodeId, opacity });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting opacity: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_effects",
  "Set effects (shadows, blurs) on a node",
  {
    nodeId: import_zod.z.string().describe("The node ID"),
    effects: flexJson(import_zod.z.array(import_zod.z.object({
      type: import_zod.z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
      color: import_zod.z.object({
        r: import_zod.z.coerce.number(),
        g: import_zod.z.coerce.number(),
        b: import_zod.z.coerce.number(),
        a: import_zod.z.coerce.number().optional()
      }).optional().describe('Effect color RGBA (0-1). Example: {"r":0,"g":0,"b":0,"a":0.25}'),
      offset: import_zod.z.object({
        x: import_zod.z.coerce.number(),
        y: import_zod.z.coerce.number()
      }).optional().describe('Shadow offset. Example: {"x":0,"y":4}'),
      radius: import_zod.z.coerce.number().describe("Blur radius"),
      spread: import_zod.z.coerce.number().optional().describe("Shadow spread"),
      visible: flexBool(import_zod.z.boolean().optional()).describe("Whether effect is visible (default true)"),
      blendMode: import_zod.z.enum(["NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LIGHTEN", "SCREEN", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]).optional().describe("Blend mode for shadows (default NORMAL)")
    }))).describe('Array of effects. Example: [{"type":"DROP_SHADOW","color":{"r":0,"g":0,"b":0,"a":0.25},"offset":{"x":0,"y":4},"radius":4}]')
  },
  async ({ nodeId, effects }) => {
    try {
      const result = await sendCommandToFigma("set_effects", { nodeId, effects });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting effects: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_constraints",
  "Set layout constraints on a node",
  {
    nodeId: import_zod.z.string().describe("The node ID"),
    horizontal: import_zod.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).describe("Horizontal constraint"),
    vertical: import_zod.z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).describe("Vertical constraint")
  },
  async ({ nodeId, horizontal, vertical }) => {
    try {
      const result = await sendCommandToFigma("set_constraints", { nodeId, horizontal, vertical });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting constraints: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_export_settings",
  "Set export settings on a node",
  {
    nodeId: import_zod.z.string().describe("The node ID"),
    settings: flexJson(import_zod.z.array(import_zod.z.object({
      format: import_zod.z.enum(["PNG", "JPG", "SVG", "PDF"]).describe("Export format"),
      suffix: import_zod.z.string().optional().describe("File suffix"),
      contentsOnly: flexBool(import_zod.z.boolean().optional()).describe("Export contents only (default true)"),
      constraint: import_zod.z.object({
        type: import_zod.z.enum(["SCALE", "WIDTH", "HEIGHT"]).describe("Constraint type"),
        value: import_zod.z.coerce.number().describe("Constraint value")
      }).optional().describe('Export constraint. Example: {"type":"SCALE","value":2}')
    }))).describe('Array of export settings. Example: [{"format":"PNG","constraint":{"type":"SCALE","value":2}}]')
  },
  async ({ nodeId, settings }) => {
    try {
      const result = await sendCommandToFigma("set_export_settings", { nodeId, settings });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting export settings: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_node_properties",
  "Batch-set multiple properties on a node at once",
  {
    nodeId: import_zod.z.string().describe("The node ID"),
    properties: flexJson(import_zod.z.record(import_zod.z.unknown())).describe('Object of property key-value pairs. Example: {"opacity":0.5,"visible":false,"locked":true}')
  },
  async ({ nodeId, properties }) => {
    try {
      const result = await sendCommandToFigma("set_node_properties", { nodeId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting node properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_style_by_id",
  "Get detailed information about a specific style by its ID. Returns full paint/font/effect/grid details.",
  {
    styleId: import_zod.z.string().describe("The style ID to look up")
  },
  async ({ styleId }) => {
    try {
      const result = await sendCommandToFigma("get_style_by_id", { styleId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "remove_style",
  "Delete/remove a style from the document by its ID",
  {
    styleId: import_zod.z.string().describe("The style ID to remove")
  },
  async ({ styleId }) => {
    try {
      const result = await sendCommandToFigma("remove_style", { styleId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_component_by_id",
  "Get detailed information about a component including property definitions and variant group properties. For COMPONENT_SETs, variant children are omitted by default (use includeChildren=true to list them) since propertyDefinitions already describes the full variant space.",
  {
    componentId: import_zod.z.string().describe("The component node ID"),
    includeChildren: flexBool(import_zod.z.boolean().optional()).describe("For COMPONENT_SETs: include variant children list (default false). Plain COMPONENTs always include children.")
  },
  async ({ componentId, includeChildren }) => {
    try {
      const result = await sendCommandToFigma("get_component_by_id", { componentId, includeChildren });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_variable_by_id",
  "Get detailed information about a variable by its ID, including all mode values.",
  {
    variableId: import_zod.z.string().describe("The variable ID")
  },
  async ({ variableId }) => {
    try {
      const result = await sendCommandToFigma("get_variable_by_id", { variableId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_variable_collection_by_id",
  "Get detailed information about a variable collection by its ID, including modes and variable IDs.",
  {
    collectionId: import_zod.z.string().describe("The variable collection ID")
  },
  async ({ collectionId }) => {
    try {
      const result = await sendCommandToFigma("get_variable_collection_by_id", { collectionId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variable collection: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_pages",
  "Get all pages in the document with their IDs, names, and child counts.",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma("get_pages");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting pages: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "set_current_page",
  "Switch to a different page. Provide either pageId or pageName (at least one required).",
  {
    pageId: import_zod.z.string().optional().describe("The page ID to switch to"),
    pageName: import_zod.z.string().optional().describe("The page name to switch to (case-insensitive, supports partial match)")
  },
  async ({ pageId, pageName }) => {
    try {
      const result = await sendCommandToFigma("set_current_page", { pageId, pageName });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting current page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_page",
  "Create a new page in the document",
  {
    name: import_zod.z.string().optional().describe("Name for the new page (default: 'New Page')")
  },
  async ({ name }) => {
    try {
      const result = await sendCommandToFigma("create_page", { name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_node_css",
  "Get CSS properties for a node (useful for dev handoff)",
  {
    nodeId: import_zod.z.string().describe("The node ID to get CSS for")
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma("get_node_css", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting CSS: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_available_fonts",
  "List available fonts in Figma, grouped by family. Use query to filter by family name (e.g., 'Inter', 'SF Pro'). Without query, returns ALL fonts \u2014 use query to avoid large responses.",
  {
    query: import_zod.z.string().optional().describe("Filter font families by name (case-insensitive substring match). Strongly recommended.")
  },
  async ({ query }) => {
    try {
      const result = await sendCommandToFigma("get_available_fonts", { query });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting fonts: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_section",
  "Create a section node to organize content on the canvas. Sections are top-level containers.",
  {
    x: import_zod.z.coerce.number().optional().describe("X position (default: 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default: 0)"),
    width: import_zod.z.coerce.number().optional().describe("Width (default: 500)"),
    height: import_zod.z.coerce.number().optional().describe("Height (default: 500)"),
    name: import_zod.z.string().optional().describe("Name for the section (default: 'Section')"),
    parentId: import_zod.z.string().optional().describe("Parent node ID")
  },
  async ({ x, y, width, height, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_section", { x, y, width, height, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating section: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "insert_child",
  "Move a node into a parent at a specific index (reorder/reparent)",
  {
    parentId: import_zod.z.string().describe("The parent node ID"),
    childId: import_zod.z.string().describe("The child node ID to move"),
    index: import_zod.z.coerce.number().optional().describe("Index to insert at (0=first). Omit to append at end.")
  },
  async ({ parentId, childId, index }) => {
    try {
      const result = await sendCommandToFigma("insert_child", { parentId, childId, index });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error inserting child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "create_node_from_svg",
  "Create a node from an SVG string",
  {
    svg: import_zod.z.string().describe("SVG markup string"),
    x: import_zod.z.coerce.number().optional().describe("X position (default 0)"),
    y: import_zod.z.coerce.number().optional().describe("Y position (default 0)"),
    name: import_zod.z.string().optional().describe("Name for the node"),
    parentId: import_zod.z.string().optional().describe("Parent node ID")
  },
  async ({ svg, x, y, name, parentId }) => {
    try {
      const result = await sendCommandToFigma("create_node_from_svg", { svg, x, y, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating node from SVG: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "get_current_page",
  "Get the current page info and its top-level children. Always safe - never touches unloaded pages. Use this as the entry point for exploring large files.",
  {},
  async () => {
    try {
      const result = await sendCommandToFigma("get_current_page");
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting current page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "search_nodes",
  "Search for nodes by name and/or type within a scope. Returns paginated results with parent info and bounds.",
  {
    query: import_zod.z.string().optional().describe("Search string to match against node names (case-insensitive substring match)"),
    types: flexJson(import_zod.z.array(import_zod.z.string()).optional()).describe('Filter by node types. Example: ["FRAME","COMPONENT","TEXT","INSTANCE"]'),
    scopeNodeId: import_zod.z.string().optional().describe("Node ID to search within (defaults to current page)"),
    caseSensitive: flexBool(import_zod.z.boolean().optional()).describe("If true, name matching is case-sensitive (default false)"),
    limit: import_zod.z.coerce.number().optional().describe("Max results to return (default 50)"),
    offset: import_zod.z.coerce.number().optional().describe("Skip this many results for pagination (default 0)")
  },
  async ({ query, types, scopeNodeId, caseSensitive, limit, offset }) => {
    try {
      const result = await sendCommandToFigma("search_nodes", { query, types, scopeNodeId, caseSensitive, limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error searching nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);
server.tool(
  "join_channel",
  "Join a specific channel to communicate with Figma",
  {
    channel: import_zod.z.string().describe("The name of the channel to join").default("")
  },
  async ({ channel }) => {
    try {
      if (!channel) {
        return {
          content: [
            {
              type: "text",
              text: "Please provide a channel name to join:"
            }
          ],
          followUp: {
            tool: "join_channel",
            description: "Join the specified channel"
          }
        };
      }
      await joinChannel(channel);
      return {
        content: [
          {
            type: "text",
            text: `Successfully joined channel: ${channel}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error joining channel: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  }
);
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