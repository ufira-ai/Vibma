#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";

// ─── Coercion helpers ───────────────────────────────────────────────
// AI agents (Claude, GPT, etc.) frequently pass numbers as strings
// ("10" instead of 10), booleans as strings ("true" instead of true),
// and objects/arrays as JSON strings. These helpers add resilient
// coercion so tools don't fail on valid-but-mistyped input.

/** Coerce "true"/"false"/"1"/"0" strings to boolean */
const flexBool = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    return v;
  }, inner);

/** Coerce JSON strings to parsed values (for objects/arrays that agents may stringify) */
const flexJson = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v;
  }, inner);

/** Coerce numeric strings only when they're valid numbers (safe for use inside unions) */
const flexNum = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess((v) => {
    if (typeof v === 'string') {
      const n = Number(v);
      if (!isNaN(n) && v.trim() !== '') return n;
    }
    return v;
  }, inner);

// Define TypeScript interfaces for Figma responses
interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

// Define interface for command progress updates
interface CommandProgressUpdate {
  type: 'command_progress';
  commandId: string;
  commandType: string;
  status: 'started' | 'in_progress' | 'completed' | 'error';
  progress: number;
  totalItems: number;
  processedItems: number;
  currentChunk?: number;
  totalChunks?: number;
  chunkSize?: number;
  message: string;
  payload?: any;
  timestamp: number;
}

// Update the getInstanceOverridesResult interface to match the plugin implementation
interface getInstanceOverridesResult {
  success: boolean;
  message: string;
  sourceInstanceId: string;
  mainComponentId: string;
  overridesCount: number;
}

// Custom logging functions that write to stderr instead of stdout to avoid being captured
const logger = {
  info: (message: string) => process.stderr.write(`[INFO] ${message}\n`),
  debug: (message: string) => process.stderr.write(`[DEBUG] ${message}\n`),
  warn: (message: string) => process.stderr.write(`[WARN] ${message}\n`),
  error: (message: string) => process.stderr.write(`[ERROR] ${message}\n`),
  log: (message: string) => process.stderr.write(`[LOG] ${message}\n`)
};

// WebSocket connection and request tracking
let ws: WebSocket | null = null;
const pendingRequests = new Map<string, {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
  lastActivity: number; // Add timestamp for last activity
}>();

// Track which channel each client is in
let currentChannel: string | null = null;

// Create MCP server
const server = new McpServer({
  name: "TalkToFigmaMCP",
  version: "1.0.0",
});

// Add command line argument parsing
const args = process.argv.slice(2);
const serverArg = args.find(arg => arg.startsWith('--server='));
const serverUrl = serverArg ? serverArg.split('=')[1] : 'localhost';
const WS_URL = serverUrl === 'localhost' ? `ws://${serverUrl}` : `wss://${serverUrl}`;

// Document Info Tool
server.tool(
  "get_document_info",
  "Get information about the current Figma document including all pages and top-level children of the current page.",
  {
    depth: z.coerce.number().optional().describe("How many levels of children to include on the current page. 0 or omit for top-level only, 1 includes grandchildren names."),
  },
  async ({ depth }: any) => {
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
            text: `Error getting document info: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Selection Tool
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
            text: `Error getting selection: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Read My Design Tool
server.tool(
  "read_my_design",
  "Get detailed information about the current selection in Figma, including all node details. Use depth to control traversal.",
  {
    depth: z.coerce.number().optional().describe("How many levels of children to recurse. 0=selection nodes only, 1=direct children, -1 or omit for unlimited."),
  },
  async ({ depth }: any) => {
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
            text: `Error getting node info: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Node Info Tool
server.tool(
  "get_node_info",
  "Get detailed information about a specific node in Figma. Use depth to control how many levels of children to include (0=node only with child summaries, 1=direct children, -1=unlimited).",
  {
    nodeId: z.string().describe("The ID of the node to get information about"),
    depth: z.coerce.number().optional().describe("How many levels of children to recurse into. 0=node only with child name/type stubs, 1=direct children fully, 2=grandchildren, etc. -1 or omit for unlimited depth."),
  },
  async ({ nodeId, depth }: any) => {
    try {
      const result = await sendCommandToFigma("get_node_info", { nodeId, depth });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(filterFigmaNode(result, depth !== undefined ? depth : -1))
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting node info: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

function rgbaToHex(color: any): string {
  // skip if color is already hex
  if (color.startsWith('#')) {
    return color;
  }

  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = Math.round(color.a * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${a === 255 ? '' : a.toString(16).padStart(2, '0')}`;
}

function filterFigmaNode(node: any, depth: number = -1, currentDepth: number = 0) {
  // Skip VECTOR type nodes
  if (node.type === "VECTOR") {
    return null;
  }

  const filtered: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Preserve parent info if present (injected by plugin's getNodeInfo)
  if (currentDepth === 0) {
    if (node.parentId) filtered.parentId = node.parentId;
    if (node.parentName) filtered.parentName = node.parentName;
    if (node.parentType) filtered.parentType = node.parentType;
  }

  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill: any) => {
      const processedFill = { ...fill };

      // Remove boundVariables and imageRef
      delete processedFill.boundVariables;
      delete processedFill.imageRef;

      // Process gradientStops if present
      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map((stop: any) => {
          const processedStop = { ...stop };
          // Convert color to hex if present
          if (processedStop.color) {
            processedStop.color = rgbaToHex(processedStop.color);
          }
          // Remove boundVariables
          delete processedStop.boundVariables;
          return processedStop;
        });
      }

      // Convert solid fill colors to hex
      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color);
      }

      return processedFill;
    });
  }

  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke: any) => {
      const processedStroke = { ...stroke };
      // Remove boundVariables
      delete processedStroke.boundVariables;
      // Convert color to hex if present
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color);
      }
      return processedStroke;
    });
  }

  if (node.cornerRadius !== undefined) {
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

  // Effects
  if (node.effects && node.effects.length > 0) {
    filtered.effects = node.effects;
  }

  // Layout properties
  if (node.layoutMode !== undefined) {
    filtered.layoutMode = node.layoutMode;
  }
  if (node.itemSpacing !== undefined) {
    filtered.itemSpacing = node.itemSpacing;
  }
  if (node.paddingLeft !== undefined) {
    filtered.padding = {
      left: node.paddingLeft,
      right: node.paddingRight,
      top: node.paddingTop,
      bottom: node.paddingBottom,
    };
  }

  // Opacity and visibility
  if (node.opacity !== undefined && node.opacity !== 1) {
    filtered.opacity = node.opacity;
  }
  if (node.visible !== undefined && node.visible === false) {
    filtered.visible = false;
  }

  // Constraints
  if (node.constraints) {
    filtered.constraints = node.constraints;
  }

  if (node.children) {
    // If depth is limited and we've reached the limit, return child summaries only
    if (depth >= 0 && currentDepth >= depth) {
      filtered.children = node.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        type: child.type,
      }));
    } else {
      filtered.children = node.children
        .map((child: any) => filterFigmaNode(child, depth, currentDepth + 1))
        .filter((child: any) => child !== null);
    }
  }

  return filtered;
}

// Nodes Info Tool
server.tool(
  "get_nodes_info",
  "Get detailed information about multiple nodes in Figma. Use depth to control child traversal.",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs. Example: [\"1:2\",\"1:3\"]"),
    depth: z.coerce.number().optional().describe("How many levels of children to recurse. 0=nodes only, 1=direct children, -1 or omit for unlimited."),
  },
  async ({ nodeIds, depth }: any) => {
    try {
      const results = await Promise.all(
        nodeIds.map(async (nodeId: any) => {
          const result = await sendCommandToFigma('get_node_info', { nodeId, depth });
          return { nodeId, info: result };
        })
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results.map((result) => filterFigmaNode(result.info, depth !== undefined ? depth : -1)))
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting nodes info: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);


// Create Rectangle Tool
server.tool(
  "create_rectangle",
  "Create a new rectangle in Figma. Default: white fill (Figma native).",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    name: z.string().optional().describe("Name for the rectangle (default: 'Rectangle')"),
    parentId: z
      .string()
      .optional()
      .describe("Parent node ID to append into"),
  },
  async ({ x, y, width, height, name, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_rectangle", {
        x,
        y,
        width,
        height,
        name,
        parentId,
      });
      return {
        content: [
          {
            type: "text",
            text: `Created rectangle "${JSON.stringify(result)}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating rectangle: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Create Frame Tool
server.tool(
  "create_frame",
  "Create a new frame in Figma. Default: transparent fill, no stroke, no auto-layout.",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    name: z.string().optional().describe("Name for the frame (default: 'Frame')"),
    parentId: z
      .string()
      .optional()
      .describe("Parent node ID to append into"),
    fillColor: flexJson(z
      .object({
        r: z.coerce.number().min(0).max(1),
        g: z.coerce.number().min(0).max(1),
        b: z.coerce.number().min(0).max(1),
        a: z.coerce.number().min(0).max(1).optional(),
      })
      .optional()
    ).describe("Fill color RGBA (0-1 each). Default: transparent. Example: {\"r\":1,\"g\":1,\"b\":1} for white"),
    strokeColor: flexJson(z
      .object({
        r: z.coerce.number().min(0).max(1),
        g: z.coerce.number().min(0).max(1),
        b: z.coerce.number().min(0).max(1),
        a: z.coerce.number().min(0).max(1).optional(),
      })
      .optional()
    ).describe("Stroke color RGBA (0-1 each). Default: no stroke. Example: {\"r\":0,\"g\":0,\"b\":0}"),
    strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight. Only applied if strokeColor is set."),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE). The following layout params only apply when not NONE."),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z
      .enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"])
      .optional()
      .describe("Primary axis alignment (default: MIN). SPACE_BETWEEN overrides itemSpacing."),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
    itemSpacing: z
      .number()
      .optional()
      .describe("Spacing between children (default: 0). Ignored if primaryAxisAlignItems is SPACE_BETWEEN.")
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
  }: any) => {
    try {
      const result = await sendCommandToFigma("create_frame", {
        x,
        y,
        width,
        height,
        name,
        parentId,
        fillColor,
        strokeColor: strokeColor,
        strokeWeight: strokeWeight,
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
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created frame "${typedResult.name}" with ID: ${typedResult.id}. Use the ID as the parentId to appendChild inside this frame.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating frame: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Create Text Tool
server.tool(
  "create_text",
  "Create a new text element in Figma. Uses Inter font family. When placing inside an auto-layout parent, set layoutSizingHorizontal to FILL so the text wraps to the parent width.",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    text: z.string().describe("Text content"),
    fontSize: z.coerce.number().optional().describe("Font size (default: 14)"),
    fontWeight: z.coerce
      .number()
      .optional()
      .describe("Font weight (default: 400). Values: 100=Thin, 200=Extra Light, 300=Light, 400=Regular, 500=Medium, 600=Semi Bold, 700=Bold, 800=Extra Bold, 900=Black"),
    fontColor: flexJson(z
      .object({
        r: z.coerce.number().min(0).max(1),
        g: z.coerce.number().min(0).max(1),
        b: z.coerce.number().min(0).max(1),
        a: z.coerce.number().min(0).max(1).optional(),
      })
      .optional()
    ).describe("Font color RGBA (0-1 each). Default: black. Example: {\"r\":1,\"g\":0,\"b\":0} for red"),
    name: z
      .string()
      .optional()
      .describe("Layer name (default: uses text content)"),
    parentId: z
      .string()
      .optional()
      .describe("Parent node ID to append into"),
    textStyleId: z.string().optional().describe("Text style ID to apply (from create_text_style or get_styles). Overrides fontSize/fontWeight."),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing. Use FILL to stretch to parent width (common for text in auto-layout). Automatically sets textAutoResize to HEIGHT when FILL is used."),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
    textAutoResize: z.enum(["NONE", "WIDTH_AND_HEIGHT", "HEIGHT", "TRUNCATE"]).optional().describe("Text auto-resize behavior. WIDTH_AND_HEIGHT (default) shrinks to fit. HEIGHT = fixed/fill width, auto height (set automatically when layoutSizingHorizontal is FILL). NONE = fixed size. TRUNCATE = fixed size with ellipsis."),
  },
  async ({ x, y, text, fontSize, fontWeight, fontColor, name, parentId, textStyleId, layoutSizingHorizontal, layoutSizingVertical, textAutoResize }: any) => {
    try {
      const result = await sendCommandToFigma("create_text", {
        x,
        y,
        text,
        fontSize: fontSize !== undefined ? fontSize : 14,
        fontWeight: fontWeight !== undefined ? fontWeight : 400,
        fontColor: fontColor || { r: 0, g: 0, b: 0, a: 1 },
        name,
        parentId,
        textStyleId,
        layoutSizingHorizontal,
        layoutSizingVertical,
        textAutoResize,
      });
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Created text "${typedResult.name}" with ID: ${typedResult.id}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating text: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Set Fill Color Tool
server.tool(
  "set_fill_color",
  "Set the fill color of a node in Figma can be TextNode or FrameNode",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.coerce.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.coerce.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.coerce.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.coerce.number().min(0).max(1).optional().describe("Alpha component (0-1, default: 1)"),
  },
  async ({ nodeId, r, g, b, a }: any) => {
    try {
      const result = await sendCommandToFigma("set_fill_color", {
        nodeId,
        color: { r, g, b, a: a !== undefined ? a : 1 },
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set fill color of node "${typedResult.name
              }" to RGBA(${r}, ${g}, ${b}, ${a !== undefined ? a : 1})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting fill color: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Set Stroke Color Tool
server.tool(
  "set_stroke_color",
  "Set the stroke color of a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    r: z.coerce.number().min(0).max(1).describe("Red component (0-1)"),
    g: z.coerce.number().min(0).max(1).describe("Green component (0-1)"),
    b: z.coerce.number().min(0).max(1).describe("Blue component (0-1)"),
    a: z.coerce.number().min(0).max(1).optional().describe("Alpha component (0-1, default: 1)"),
    weight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  },
  async ({ nodeId, r, g, b, a, weight }: any) => {
    try {
      const result = await sendCommandToFigma("set_stroke_color", {
        nodeId,
        color: { r, g, b, a: a !== undefined ? a : 1 },
        weight: weight !== undefined ? weight : 1,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set stroke color of node "${typedResult.name
              }" to RGBA(${r}, ${g}, ${b}, ${a !== undefined ? a : 1}) with weight ${weight !== undefined ? weight : 1}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting stroke color: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Move Node Tool
server.tool(
  "move_node",
  "Move a node to a new position in Figma",
  {
    nodeId: z.string().describe("The ID of the node to move"),
    x: z.coerce.number().describe("New X position"),
    y: z.coerce.number().describe("New Y position"),
  },
  async ({ nodeId, x, y }: any) => {
    try {
      const result = await sendCommandToFigma("move_node", { nodeId, x, y });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Moved node "${typedResult.name}" to position (${x}, ${y})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error moving node: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Clone Node Tool
server.tool(
  "clone_node",
  "Clone an existing node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to clone"),
    x: z.coerce.number().optional().describe("New X position for the clone"),
    y: z.coerce.number().optional().describe("New Y position for the clone")
  },
  async ({ nodeId, x, y }: any) => {
    try {
      const result = await sendCommandToFigma('clone_node', { nodeId, x, y });
      const typedResult = result as { name: string, id: string };
      return {
        content: [
          {
            type: "text",
            text: `Cloned node "${typedResult.name}" with new ID: ${typedResult.id}${x !== undefined && y !== undefined ? ` at position (${x}, ${y})` : ''}`
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

// Resize Node Tool
server.tool(
  "resize_node",
  "Resize a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to resize"),
    width: z.coerce.number().positive().describe("New width"),
    height: z.coerce.number().positive().describe("New height"),
  },
  async ({ nodeId, width, height }: any) => {
    try {
      const result = await sendCommandToFigma("resize_node", {
        nodeId,
        width,
        height,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Resized node "${typedResult.name}" to width ${width} and height ${height}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error resizing node: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Delete Node Tool
server.tool(
  "delete_node",
  "Delete a node from Figma",
  {
    nodeId: z.string().describe("The ID of the node to delete"),
  },
  async ({ nodeId }: any) => {
    try {
      await sendCommandToFigma("delete_node", { nodeId });
      return {
        content: [
          {
            type: "text",
            text: `Deleted node with ID: ${nodeId}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error deleting node: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Delete Multiple Nodes Tool
server.tool(
  "delete_multiple_nodes",
  "Delete multiple nodes from Figma at once",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to delete. Example: [\"1:2\",\"1:3\"]"),
  },
  async ({ nodeIds }: any) => {
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
            text: `Error deleting multiple nodes: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Export Node as Image Tool
server.tool(
  "export_node_as_image",
  "Export a node as an image from Figma",
  {
    nodeId: z.string().describe("The ID of the node to export"),
    format: z
      .enum(["PNG", "JPG", "SVG", "PDF"])
      .optional()
      .describe("Export format (default: PNG)"),
    scale: z.coerce.number().positive().optional().describe("Export scale (default: 1)"),
  },
  async ({ nodeId, format, scale }: any) => {
    try {
      const result = await sendCommandToFigma("export_node_as_image", {
        nodeId,
        format,
        scale,
      });
      const typedResult = result as { imageData: string; mimeType: string };

      return {
        content: [
          {
            type: "image",
            data: typedResult.imageData,
            mimeType: typedResult.mimeType || "image/png",
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error exporting node as image: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Set Text Content Tool
server.tool(
  "set_text_content",
  "Set the text content of an existing text node in Figma",
  {
    nodeId: z.string().describe("The ID of the text node to modify"),
    text: z.string().describe("New text content"),
  },
  async ({ nodeId, text }: any) => {
    try {
      const result = await sendCommandToFigma("set_text_content", {
        nodeId,
        text,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Updated text content of node "${typedResult.name}" to "${text}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting text content: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Get Styles Tool
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
            text: `Error getting styles: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Get Local Components Tool
server.tool(
  "get_local_components",
  "List local components. Use setsOnly=true to get only component sets (not individual variants). Supports pagination and name filtering. Use get_component_by_id for full details.",
  {
    setsOnly: flexBool(z.boolean().optional()).describe("If true, return only COMPONENT_SET nodes (top-level components, not variants). Dramatically reduces results in large files."),
    nameFilter: z.string().optional().describe("Filter components by name (case-insensitive substring match)"),
    limit: z.coerce.number().optional().describe("Max results to return (default 100)"),
    offset: z.coerce.number().optional().describe("Skip this many results for pagination (default 0)"),
  },
  async ({ setsOnly, nameFilter, limit, offset }: any) => {
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
            text: `Error getting local components: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Copy Instance Overrides Tool
server.tool(
  "get_instance_overrides",
  "Get all override properties from a selected component instance. These overrides can be applied to other instances, which will swap them to match the source component.",
  {
    nodeId: z.string().optional().describe("Optional ID of the component instance to get overrides from. If not provided, currently selected instance will be used."),
  },
  async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("get_instance_overrides", {
        instanceNodeId: nodeId || null
      });
      const typedResult = result as getInstanceOverridesResult;

      return {
        content: [
          {
            type: "text",
            text: typedResult.success
              ? `Successfully got instance overrides: ${typedResult.message}`
              : `Failed to get instance overrides: ${typedResult.message}`
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

// Set Corner Radius Tool
server.tool(
  "set_corner_radius",
  "Set the corner radius of a node in Figma",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    radius: z.coerce.number().min(0).describe("Corner radius value"),
    corners: flexJson(z
      .array(flexBool(z.boolean()))
      .length(4)
      .optional()
    ).describe(
        "Array of 4 booleans for which corners to round [topLeft, topRight, bottomRight, bottomLeft]. Example: [true,true,false,false]"
      ),
  },
  async ({ nodeId, radius, corners }: any) => {
    try {
      const result = await sendCommandToFigma("set_corner_radius", {
        nodeId,
        radius,
        corners: corners || [true, true, true, true],
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set corner radius of node "${typedResult.name}" to ${radius}px`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting corner radius: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Define design strategy prompt
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
    - Don't have account (text)`,
          },
        },
      ],
      description: "Best practices for working with Figma designs",
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
`,
          },
        },
      ],
      description: "Best practices for reading Figma designs",
    };
  }
);

// Text Node Scanning Tool
server.tool(
  "scan_text_nodes",
  "Scan all text nodes in the selected Figma node",
  {
    nodeId: z.string().describe("ID of the node to scan"),
  },
  async ({ nodeId }: any) => {
    try {
      // Initial response to indicate we're starting the process
      const initialStatus = {
        type: "text" as const,
        text: "Starting text node scanning. This may take a moment for large designs...",
      };

      // Use the plugin's scan_text_nodes function with chunking flag
      const result = await sendCommandToFigma("scan_text_nodes", {
        nodeId,
        useChunking: true,  // Enable chunking on the plugin side
        chunkSize: 10       // Process 10 nodes at a time
      });

      // If the result indicates chunking was used, format the response accordingly
      if (result && typeof result === 'object' && 'chunks' in result) {
        const typedResult = result as {
          success: boolean,
          totalNodes: number,
          processedNodes: number,
          chunks: number,
          textNodes: Array<any>
        };

        const summaryText = `
        Scan completed:
        - Found ${typedResult.totalNodes} text nodes
        - Processed in ${typedResult.chunks} chunks
        `;

        return {
          content: [
            initialStatus,
            {
              type: "text" as const,
              text: summaryText
            },
            {
              type: "text" as const,
              text: JSON.stringify(typedResult.textNodes, null, 2)
            }
          ],
        };
      }

      // If chunking wasn't used or wasn't reported in the result format, return the result as is
      return {
        content: [
          initialStatus,
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error scanning text nodes: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Text Replacement Strategy Prompt
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

Remember that text is never just text—it's a core design element that must work harmoniously with the overall composition. This chunk-based strategy allows you to methodically transform text while maintaining design integrity.`,
          },
        },
      ],
      description: "Systematic approach for replacing text in Figma designs",
    };
  }
);

// Set Multiple Text Contents Tool
server.tool(
  "set_multiple_text_contents",
  "Set multiple text contents parallelly in a node",
  {
    nodeId: z
      .string()
      .describe("The ID of the node containing the text nodes to replace"),
    text: flexJson(z
      .array(
        z.object({
          nodeId: z.string().describe("The ID of the text node"),
          text: z.string().describe("The replacement text"),
        })
      )
    ).describe("Array of {nodeId, text} pairs. Example: [{\"nodeId\":\"1:2\",\"text\":\"Hello\"}]"),
  },
  async ({ nodeId, text }: any) => {
    try {
      if (!text || text.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No text provided",
            },
          ],
        };
      }

      // Initial response to indicate we're starting the process
      const initialStatus = {
        type: "text" as const,
        text: `Starting text replacement for ${text.length} nodes. This will be processed in batches of 5...`,
      };

      // Track overall progress
      let totalProcessed = 0;
      const totalToProcess = text.length;

      // Use the plugin's set_multiple_text_contents function with chunking
      const result = await sendCommandToFigma("set_multiple_text_contents", {
        nodeId,
        text,
      });

      // Cast the result to a specific type to work with it safely
      interface TextReplaceResult {
        success: boolean;
        nodeId: string;
        replacementsApplied?: number;
        replacementsFailed?: number;
        totalReplacements?: number;
        completedInChunks?: number;
        results?: Array<{
          success: boolean;
          nodeId: string;
          error?: string;
          originalText?: string;
          translatedText?: string;
        }>;
      }

      const typedResult = result as TextReplaceResult;

      // Format the results for display
      const success = typedResult.replacementsApplied && typedResult.replacementsApplied > 0;
      const progressText = `
      Text replacement completed:
      - ${typedResult.replacementsApplied || 0} of ${totalToProcess} successfully updated
      - ${typedResult.replacementsFailed || 0} failed
      - Processed in ${typedResult.completedInChunks || 1} batches
      `;

      // Detailed results
      const detailedResults = typedResult.results || [];
      const failedResults = detailedResults.filter(item => !item.success);

      // Create the detailed part of the response
      let detailedResponse = "";
      if (failedResults.length > 0) {
        detailedResponse = `\n\nNodes that failed:\n${failedResults.map(item =>
          `- ${item.nodeId}: ${item.error || "Unknown error"}`
        ).join('\n')}`;
      }

      return {
        content: [
          initialStatus,
          {
            type: "text" as const,
            text: progressText + detailedResponse,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting multiple text contents: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Annotation Conversion Strategy Prompt
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
          },
        },
      ],
      description: "Strategy for converting manual annotations to Figma's native annotations",
    };
  }
);

// Instance Slot Filling Strategy Prompt
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
- Preserve component relationships by using instance overrides rather than direct text manipulation`,
          },
        },
      ],
      description: "Strategy for transferring overrides between component instances in Figma",
    };
  }
);

// Set Layout Mode Tool
server.tool(
  "set_layout_mode",
  "Set the layout mode and wrap behavior of a frame in Figma",
  {
    nodeId: z.string().describe("The ID of the frame to modify"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).describe("Layout mode for the frame"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)")
  },
  async ({ nodeId, layoutMode, layoutWrap }: any) => {
    try {
      const result = await sendCommandToFigma("set_layout_mode", {
        nodeId,
        layoutMode,
        layoutWrap,
      });
      const typedResult = result as { name: string };
      return {
        content: [
          {
            type: "text",
            text: `Set layout mode of frame "${typedResult.name}" to ${layoutMode}${layoutWrap ? ` with ${layoutWrap}` : ''}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting layout mode: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Padding Tool
server.tool(
  "set_padding",
  "Set padding values for an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("The ID of the frame to modify"),
    paddingTop: z.coerce.number().optional().describe("Top padding value"),
    paddingRight: z.coerce.number().optional().describe("Right padding value"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding value"),
    paddingLeft: z.coerce.number().optional().describe("Left padding value"),
  },
  async ({ nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft }: any) => {
    try {
      const result = await sendCommandToFigma("set_padding", {
        nodeId,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      });
      const typedResult = result as { name: string };

      // Create a message about which padding values were set
      const paddingMessages = [];
      if (paddingTop !== undefined) paddingMessages.push(`top: ${paddingTop}`);
      if (paddingRight !== undefined) paddingMessages.push(`right: ${paddingRight}`);
      if (paddingBottom !== undefined) paddingMessages.push(`bottom: ${paddingBottom}`);
      if (paddingLeft !== undefined) paddingMessages.push(`left: ${paddingLeft}`);

      const paddingText = paddingMessages.length > 0
        ? `padding (${paddingMessages.join(', ')})`
        : "padding";

      return {
        content: [
          {
            type: "text",
            text: `Set ${paddingText} for frame "${typedResult.name}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting padding: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Axis Align Tool
server.tool(
  "set_axis_align",
  "Set primary and counter axis alignment for an auto-layout frame in Figma",
  {
    nodeId: z.string().describe("The ID of the frame to modify"),
    primaryAxisAlignItems: z
      .enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"])
      .optional()
      .describe("Primary axis alignment (MIN/MAX = left/right in horizontal, top/bottom in vertical). Note: When set to SPACE_BETWEEN, itemSpacing will be ignored as children will be evenly spaced."),
    counterAxisAlignItems: z
      .enum(["MIN", "MAX", "CENTER", "BASELINE"])
      .optional()
      .describe("Counter axis alignment (MIN/MAX = top/bottom in horizontal, left/right in vertical)")
  },
  async ({ nodeId, primaryAxisAlignItems, counterAxisAlignItems }: any) => {
    try {
      const result = await sendCommandToFigma("set_axis_align", {
        nodeId,
        primaryAxisAlignItems,
        counterAxisAlignItems
      });
      const typedResult = result as { name: string };

      // Create a message about which alignments were set
      const alignMessages = [];
      if (primaryAxisAlignItems !== undefined) alignMessages.push(`primary: ${primaryAxisAlignItems}`);
      if (counterAxisAlignItems !== undefined) alignMessages.push(`counter: ${counterAxisAlignItems}`);

      const alignText = alignMessages.length > 0
        ? `axis alignment (${alignMessages.join(', ')})`
        : "axis alignment";

      return {
        content: [
          {
            type: "text",
            text: `Set ${alignText} for frame "${typedResult.name}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting axis alignment: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Layout Sizing Tool
server.tool(
  "set_layout_sizing",
  "Set horizontal and vertical sizing modes for auto-layout containers (frames, components, instances) or their children (including TEXT nodes)",
  {
    nodeId: z.string().describe("The ID of the node to modify"),
    layoutSizingHorizontal: z
      .enum(["FIXED", "HUG", "FILL"])
      .optional()
      .describe("Horizontal sizing mode (HUG for frames/text only, FILL for auto-layout children only)"),
    layoutSizingVertical: z
      .enum(["FIXED", "HUG", "FILL"])
      .optional()
      .describe("Vertical sizing mode (HUG for frames/text only, FILL for auto-layout children only)")
  },
  async ({ nodeId, layoutSizingHorizontal, layoutSizingVertical }: any) => {
    try {
      const result = await sendCommandToFigma("set_layout_sizing", {
        nodeId,
        layoutSizingHorizontal,
        layoutSizingVertical
      });
      const typedResult = result as { name: string };

      // Create a message about which sizing modes were set
      const sizingMessages = [];
      if (layoutSizingHorizontal !== undefined) sizingMessages.push(`horizontal: ${layoutSizingHorizontal}`);
      if (layoutSizingVertical !== undefined) sizingMessages.push(`vertical: ${layoutSizingVertical}`);

      const sizingText = sizingMessages.length > 0
        ? `layout sizing (${sizingMessages.join(', ')})`
        : "layout sizing";

      return {
        content: [
          {
            type: "text",
            text: `Set ${sizingText} for frame "${typedResult.name}"`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting layout sizing: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Item Spacing Tool
server.tool(
  "set_item_spacing",
  "Set distance between children in an auto-layout frame. Provide at least one of itemSpacing or counterAxisSpacing.",
  {
    nodeId: z.string().describe("The ID of the frame to modify"),
    itemSpacing: z.coerce.number().optional().describe("Distance between children. Note: This value will be ignored if primaryAxisAlignItems is set to SPACE_BETWEEN."),
    counterAxisSpacing: z.coerce.number().optional().describe("Distance between wrapped rows/columns. Only works when layoutWrap is set to WRAP.")
  },
  async ({ nodeId, itemSpacing, counterAxisSpacing}: any) => {
    try {
      const params: any = { nodeId };
      if (itemSpacing !== undefined) params.itemSpacing = itemSpacing;
      if (counterAxisSpacing !== undefined) params.counterAxisSpacing = counterAxisSpacing;
      
      const result = await sendCommandToFigma("set_item_spacing", params);
      const typedResult = result as { name: string, itemSpacing?: number, counterAxisSpacing?: number };

      let message = `Updated spacing for frame "${typedResult.name}":`;
      if (itemSpacing !== undefined) message += ` itemSpacing=${itemSpacing}`;
      if (counterAxisSpacing !== undefined) message += ` counterAxisSpacing=${counterAxisSpacing}`;

      return {
        content: [
          {
            type: "text",
            text: message,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting spacing: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Focus Tool
server.tool(
  "set_focus",
  "Set focus on a specific node in Figma by selecting it and scrolling viewport to it",
  {
    nodeId: z.string().describe("The ID of the node to focus on"),
  },
  async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("set_focus", { nodeId });
      const typedResult = result as { name: string; id: string };
      return {
        content: [
          {
            type: "text",
            text: `Focused on node "${typedResult.name}" (ID: ${typedResult.id})`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting focus: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Set Selections Tool
server.tool(
  "set_selections",
  "Set selection to multiple nodes in Figma and scroll viewport to show them",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to select. Example: [\"1:2\",\"1:3\"]"),
  },
  async ({ nodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("set_selections", { nodeIds });
      const typedResult = result as { selectedNodes: Array<{ name: string; id: string }>; count: number };
      return {
        content: [
          {
            type: "text",
            text: `Selected ${typedResult.count} nodes: ${typedResult.selectedNodes.map(node => `"${node.name}" (${node.id})`).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error setting selections: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);

// Define command types and parameters
type FigmaCommand =
  | "get_document_info"
  | "get_selection"
  | "get_node_info"
  | "get_nodes_info"
  | "read_my_design"
  | "create_rectangle"
  | "create_frame"
  | "create_text"
  | "set_fill_color"
  | "set_stroke_color"
  | "move_node"
  | "resize_node"
  | "delete_node"
  | "delete_multiple_nodes"
  | "get_styles"
  | "get_local_components"
  | "get_instance_overrides"
  | "export_node_as_image"
  | "join"
  | "set_corner_radius"
  | "clone_node"
  | "set_text_content"
  | "scan_text_nodes"
  | "set_multiple_text_contents"
  | "set_layout_mode"
  | "set_padding"
  | "set_axis_align"
  | "set_layout_sizing"
  | "set_item_spacing"
  | "set_focus"
  | "set_selections"
  | "create_component"
  | "create_component_from_node"
  | "combine_as_variants"
  | "add_component_property"
  | "create_instance_from_local"
  | "create_variable_collection"
  | "create_variable"
  | "set_variable_value"
  | "get_local_variables"
  | "get_local_variable_collections"
  | "set_variable_binding"
  | "create_paint_style"
  | "create_text_style"
  | "create_effect_style"
  | "apply_style_to_node"
  | "create_ellipse"
  | "create_line"
  | "create_boolean_operation"
  | "set_opacity"
  | "set_effects"
  | "set_constraints"
  | "set_export_settings"
  | "set_node_properties"
  | "get_style_by_id"
  | "remove_style"
  | "get_component_by_id"
  | "get_variable_by_id"
  | "get_variable_collection_by_id"
  | "get_pages"
  | "set_current_page"
  | "create_page"
  | "get_node_css"
  | "get_available_fonts"
  | "create_section"
  | "insert_child"
  | "create_node_from_svg"
  | "get_current_page"
  | "search_nodes"
  | "add_mode"
  | "rename_mode"
  | "remove_mode"
  | "rename_page"
  | "zoom_into_view"
  | "set_viewport"
  | "create_auto_layout";

type CommandParams = {
  get_document_info: { depth?: number };
  get_selection: Record<string, never>;
  get_node_info: { nodeId: string; depth?: number };
  get_nodes_info: { nodeIds: string[]; depth?: number };
  read_my_design: { depth?: number };
  create_rectangle: {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
  };
  create_frame: {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
    fillColor?: { r: number; g: number; b: number; a?: number };
    strokeColor?: { r: number; g: number; b: number; a?: number };
    strokeWeight?: number;
  };
  create_text: {
    x: number;
    y: number;
    text: string;
    fontSize?: number;
    fontWeight?: number;
    fontColor?: { r: number; g: number; b: number; a?: number };
    name?: string;
    parentId?: string;
    textStyleId?: string;
    layoutSizingHorizontal?: string;
    layoutSizingVertical?: string;
    textAutoResize?: string;
  };
  set_fill_color: {
    nodeId: string;
    r: number;
    g: number;
    b: number;
    a?: number;
  };
  set_stroke_color: {
    nodeId: string;
    r: number;
    g: number;
    b: number;
    a?: number;
    weight?: number;
  };
  move_node: {
    nodeId: string;
    x: number;
    y: number;
  };
  resize_node: {
    nodeId: string;
    width: number;
    height: number;
  };
  delete_node: {
    nodeId: string;
  };
  delete_multiple_nodes: {
    nodeIds: string[];
  };
  get_styles: Record<string, never>;
  get_local_components: {
    setsOnly?: boolean;
    nameFilter?: string;
    limit?: number;
    offset?: number;
  };
  get_team_components: Record<string, never>;
  get_instance_overrides: {
    instanceNodeId: string | null;
  };
  export_node_as_image: {
    nodeId: string;
    format?: "PNG" | "JPG" | "SVG" | "PDF";
    scale?: number;
  };
  execute_code: {
    code: string;
  };
  join: {
    channel: string;
  };
  set_corner_radius: {
    nodeId: string;
    radius: number;
    corners?: boolean[];
  };
  clone_node: {
    nodeId: string;
    x?: number;
    y?: number;
  };
  set_text_content: {
    nodeId: string;
    text: string;
  };
  scan_text_nodes: {
    nodeId: string;
    useChunking: boolean;
    chunkSize: number;
  };
  set_multiple_text_contents: {
    nodeId: string;
    text: Array<{ nodeId: string; text: string }>;
  };
  set_focus: {
    nodeId: string;
  };
  set_selections: {
    nodeIds: string[];
  };

  create_component: {
    name: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    parentId?: string;
    fillColor?: { r: number; g: number; b: number; a?: number };
    strokeColor?: { r: number; g: number; b: number; a?: number };
    strokeWeight?: number;
    cornerRadius?: number;
    layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
    layoutWrap?: "NO_WRAP" | "WRAP";
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
    counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
    layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
    layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
    itemSpacing?: number;
  };
  create_component_from_node: {
    nodeId: string;
  };
  combine_as_variants: {
    componentIds: string[];
    name?: string;
  };
  add_component_property: {
    componentId: string;
    propertyName: string;
    type: "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "VARIANT";
    defaultValue: string | boolean;
    preferredValues?: Array<{ type: "COMPONENT" | "COMPONENT_SET"; key: string }>;
  };
  create_instance_from_local: {
    componentId: string;
    x?: number;
    y?: number;
    parentId?: string;
  };
  create_variable_collection: {
    name: string;
  };
  create_variable: {
    collectionId: string;
    name: string;
    resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  };
  set_variable_value: {
    variableId: string;
    modeId: string;
    value: number | string | boolean | { r: number; g: number; b: number; a?: number };
  };
  get_local_variables: {
    type?: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
    collectionId?: string;
  };
  get_local_variable_collections: Record<string, never>;
  set_variable_binding: {
    nodeId: string;
    field: string;
    variableId: string;
  };
  create_paint_style: {
    name: string;
    color: { r: number; g: number; b: number; a?: number };
  };
  create_text_style: {
    name: string;
    fontFamily: string;
    fontStyle?: string;
    fontSize: number;
    lineHeight?: number | { value: number; unit: "PIXELS" | "PERCENT" | "AUTO" };
    letterSpacing?: number | { value: number; unit: "PIXELS" | "PERCENT" };
    textCase?: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
    textDecoration?: "NONE" | "UNDERLINE" | "STRIKETHROUGH";
  };
  create_effect_style: {
    name: string;
    effects: Array<{
      type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
      color?: { r: number; g: number; b: number; a?: number };
      offset?: { x: number; y: number };
      radius: number;
      spread?: number;
      visible?: boolean;
    }>;
  };
  apply_style_to_node: {
    nodeId: string;
    styleId?: string;
    styleName?: string;
    styleType: "fill" | "stroke" | "text" | "effect";
  };
  create_ellipse: {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    parentId?: string;
  };
  create_line: {
    x: number;
    y: number;
    length: number;
    rotation?: number;
    name?: string;
    parentId?: string;
  };
  create_boolean_operation: {
    nodeIds: string[];
    operation: "UNION" | "INTERSECT" | "SUBTRACT" | "EXCLUDE";
    name?: string;
  };
  set_opacity: {
    nodeId: string;
    opacity: number;
  };
  set_effects: {
    nodeId: string;
    effects: Array<{
      type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
      color?: { r: number; g: number; b: number; a?: number };
      offset?: { x: number; y: number };
      radius: number;
      spread?: number;
      visible?: boolean;
    }>;
  };
  set_constraints: {
    nodeId: string;
    horizontal: "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE";
    vertical: "MIN" | "CENTER" | "MAX" | "STRETCH" | "SCALE";
  };
  set_export_settings: {
    nodeId: string;
    settings: Array<{
      format: "PNG" | "JPG" | "SVG" | "PDF";
      suffix?: string;
      contentsOnly?: boolean;
      constraint?: { type: "SCALE" | "WIDTH" | "HEIGHT"; value: number };
    }>;
  };
  set_node_properties: {
    nodeId: string;
    properties: Record<string, unknown>;
  };
  get_style_by_id: {
    styleId: string;
  };
  remove_style: {
    styleId: string;
  };
  get_component_by_id: {
    componentId: string;
    includeChildren?: boolean;
  };
  get_variable_by_id: {
    variableId: string;
  };
  get_variable_collection_by_id: {
    collectionId: string;
  };
  get_pages: Record<string, never>;
  set_current_page: {
    pageId?: string;
    pageName?: string;
  };
  create_page: {
    name?: string;
  };
  get_node_css: {
    nodeId: string;
  };
  get_available_fonts: {
    query?: string;
  };
  create_section: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    name?: string;
    parentId?: string;
  };
  insert_child: {
    parentId: string;
    childId: string;
    index?: number;
  };
  create_node_from_svg: {
    svg: string;
    x?: number;
    y?: number;
    name?: string;
    parentId?: string;
  };
  get_current_page: Record<string, never>;
  search_nodes: {
    query?: string;
    types?: string[];
    scopeNodeId?: string;
    caseSensitive?: boolean;
    limit?: number;
    offset?: number;
  };
  add_mode: {
    collectionId: string;
    name: string;
  };
  rename_mode: {
    collectionId: string;
    modeId: string;
    name: string;
  };
  remove_mode: {
    collectionId: string;
    modeId: string;
  };
  rename_page: {
    newName: string;
    pageId?: string;
  };
  zoom_into_view: {
    nodeIds: string[];
  };
  set_viewport: {
    center?: { x: number; y: number };
    zoom?: number;
  };
  create_auto_layout: {
    nodeIds: string[];
    name?: string;
    layoutMode?: "HORIZONTAL" | "VERTICAL";
    itemSpacing?: number;
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    primaryAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "SPACE_BETWEEN";
    counterAxisAlignItems?: "MIN" | "MAX" | "CENTER" | "BASELINE";
    layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
    layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
    layoutWrap?: "NO_WRAP" | "WRAP";
  };
};


// Helper function to process Figma node responses
function processFigmaNodeResponse(result: unknown): any {
  if (!result || typeof result !== "object") {
    return result;
  }

  // Check if this looks like a node response
  const resultObj = result as Record<string, unknown>;
  if ("id" in resultObj && typeof resultObj.id === "string") {
    // It appears to be a node response, log the details
    console.info(
      `Processed Figma node: ${resultObj.name || "Unknown"} (ID: ${resultObj.id
      })`
    );

    if ("x" in resultObj && "y" in resultObj) {
      console.debug(`Node position: (${resultObj.x}, ${resultObj.y})`);
    }

    if ("width" in resultObj && "height" in resultObj) {
      console.debug(`Node dimensions: ${resultObj.width}×${resultObj.height}`);
    }
  }

  return result;
}

// Update the connectToFigma function
function connectToFigma(port: number = 3055) {
  // If already connected, do nothing
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info('Already connected to Figma');
    return;
  }

  const wsUrl = serverUrl === 'localhost' ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    logger.info('Connected to Figma socket server');
    // Reset channel on new connection
    currentChannel = null;
  });

  ws.on("message", (data: any) => {
    try {
      // Define a more specific type with an index signature to allow any property access
      interface ProgressMessage {
        message: FigmaResponse | any;
        type?: string;
        id?: string;
        [key: string]: any; // Allow any other properties
      }

      const json = JSON.parse(data) as ProgressMessage;

      // Handle progress updates
      if (json.type === 'progress_update') {
        const progressData = json.message.data as CommandProgressUpdate;
        const requestId = json.id || '';

        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId)!;

          // Update last activity timestamp
          request.lastActivity = Date.now();

          // Reset the timeout to prevent timeouts during long-running operations
          clearTimeout(request.timeout);

          // Create a new timeout
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`);
              pendingRequests.delete(requestId);
              request.reject(new Error('Request to Figma timed out'));
            }
          }, 60000); // 60 second timeout for inactivity

          // Log progress
          logger.info(`Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`);

          // For completed updates, we could resolve the request early if desired
          if (progressData.status === 'completed' && progressData.progress === 100) {
            // Optionally resolve early with partial data
            // request.resolve(progressData.payload);
            // pendingRequests.delete(requestId);

            // Instead, just log the completion, wait for final result from Figma
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`);
          }
        }
        return;
      }

      // Handle regular responses
      const myResponse = json.message;
      logger.debug(`Received message: ${JSON.stringify(myResponse)}`);
      logger.log('myResponse' + JSON.stringify(myResponse));

      // Handle response to a request
      if (
        myResponse.id &&
        pendingRequests.has(myResponse.id) &&
        myResponse.result
      ) {
        const request = pendingRequests.get(myResponse.id)!;
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
        // Handle broadcast messages or events
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ws.on('error', (error) => {
    logger.error(`Socket error: ${error}`);
  });

  ws.on('close', () => {
    logger.info('Disconnected from Figma socket server');
    ws = null;

    // Reject all pending requests
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }

    // Attempt to reconnect
    logger.info('Attempting to reconnect in 2 seconds...');
    setTimeout(() => connectToFigma(port), 2000);
  });
}

// Function to join a channel
async function joinChannel(channelName: string): Promise<void> {
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

// Function to send commands to Figma
function sendCommandToFigma(
  command: FigmaCommand,
  params: unknown = {},
  timeoutMs: number = 30000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // If not connected, try to connect first
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma();
      reject(new Error("Not connected to Figma. Attempting to connect..."));
      return;
    }

    // Check if we need a channel for this command
    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      reject(new Error("Must join a channel before sending commands"));
      return;
    }

    const id = uuidv4();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...(command === "join"
        ? { channel: (params as any).channel }
        : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
          commandId: id, // Include the command ID in params
        },
      },
    };

    // Set timeout for request
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`);
        reject(new Error('Request to Figma timed out'));
      }
    }, timeoutMs);

    // Store the promise callbacks to resolve/reject later
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now()
    });

    // Send the request
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}

// Create Component Tool
server.tool(
  "create_component",
  "Create a new component in Figma. Default: transparent fill, no stroke, no auto-layout. Same layout params as create_frame.",
  {
    name: z.string().describe("Name for the component"),
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    parentId: z.string().optional().describe("Parent node ID to append into"),
    fillColor: flexJson(z.object({
      r: z.coerce.number().min(0).max(1), g: z.coerce.number().min(0).max(1),
      b: z.coerce.number().min(0).max(1), a: z.coerce.number().min(0).max(1).optional(),
    }).optional()).describe("Fill color RGBA (0-1 each). Default: transparent. Example: {\"r\":1,\"g\":1,\"b\":1} for white"),
    strokeColor: flexJson(z.object({
      r: z.coerce.number().min(0).max(1), g: z.coerce.number().min(0).max(1),
      b: z.coerce.number().min(0).max(1), a: z.coerce.number().min(0).max(1).optional(),
    }).optional()).describe("Stroke color RGBA (0-1 each). Default: no stroke. Example: {\"r\":0,\"g\":0,\"b\":0}"),
    strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight. Only applied if strokeColor is set."),
    cornerRadius: z.coerce.number().optional().describe("Corner radius"),
    layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Auto-layout direction (default: NONE)"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
    itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
  },
  async ({ name, x, y, width, height, parentId, fillColor, strokeColor, strokeWeight, cornerRadius, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing }: any) => {
    try {
      const result = await sendCommandToFigma("create_component", { name, x, y, width, height, parentId, fillColor, strokeColor, strokeWeight, cornerRadius, layoutMode, layoutWrap, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, itemSpacing });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Component From Node Tool
server.tool(
  "create_component_from_node",
  "Convert an existing node into a component",
  {
    nodeId: z.string().describe("The ID of the node to convert to a component"),
  },
  async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("create_component_from_node", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating component from node: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Combine As Variants Tool
server.tool(
  "combine_as_variants",
  "Combine multiple components into a variant set",
  {
    componentIds: flexJson(z.array(z.string())).describe("Array of component node IDs to combine. Example: [\"1:2\",\"1:3\"]"),
    name: z.string().optional().describe("Name for the component set"),
  },
  async ({ componentIds, name }: any) => {
    try {
      const result = await sendCommandToFigma("combine_as_variants", { componentIds, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error combining variants: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Add Component Property Tool
server.tool(
  "add_component_property",
  "Add a property to a component (BOOLEAN, TEXT, INSTANCE_SWAP, or VARIANT)",
  {
    componentId: z.string().describe("The component node ID"),
    propertyName: z.string().describe("Name of the property"),
    type: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Type of the property"),
    defaultValue: flexBool(z.union([z.string(), z.boolean()])).describe("Default value — string for TEXT/VARIANT/INSTANCE_SWAP, boolean for BOOLEAN. Examples: \"Click me\", true"),
    preferredValues: flexJson(z.array(z.object({
      type: z.enum(["COMPONENT", "COMPONENT_SET"]),
      key: z.string(),
    })).optional()).describe("Preferred values for INSTANCE_SWAP. Example: [{\"type\":\"COMPONENT\",\"key\":\"abc123\"}]"),
  },
  async ({ componentId, propertyName, type, defaultValue, preferredValues }: any) => {
    try {
      const result = await sendCommandToFigma("add_component_property", { componentId, propertyName, type, defaultValue, preferredValues });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding component property: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Instance From Local Component Tool
server.tool(
  "create_instance_from_local",
  "Create an instance of a local component by its node ID. Accepts both COMPONENT and COMPONENT_SET IDs (picks default variant).",
  {
    componentId: z.string().describe("The node ID of the local component or component set to instantiate"),
    x: z.coerce.number().optional().describe("X position for the instance"),
    y: z.coerce.number().optional().describe("Y position for the instance"),
    parentId: z.string().optional().describe("Parent node ID to append to"),
  },
  async ({ componentId, x, y, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_instance_from_local", { componentId, x, y, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating instance: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Variable Collection Tool
server.tool(
  "create_variable_collection",
  "Create a new variable collection for design tokens",
  {
    name: z.string().describe("Name for the variable collection"),
  },
  async ({ name }: any) => {
    try {
      const result = await sendCommandToFigma("create_variable_collection", { name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating variable collection: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Variable Tool
server.tool(
  "create_variable",
  "Create a new variable (design token) in a collection",
  {
    collectionId: z.string().describe("The variable collection ID"),
    name: z.string().describe("Name for the variable"),
    resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("The variable type"),
  },
  async ({ collectionId, name, resolvedType }: any) => {
    try {
      const result = await sendCommandToFigma("create_variable", { collectionId, name, resolvedType });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Variable Value Tool
server.tool(
  "set_variable_value",
  "Set a variable's value for a specific mode",
  {
    variableId: z.string().describe("The variable ID"),
    modeId: z.string().describe("The mode ID to set the value for"),
    value: flexJson(z.union([
      z.number(),
      z.string(),
      z.boolean(),
      z.object({
        r: z.coerce.number().describe("Red (0-1)"),
        g: z.coerce.number().describe("Green (0-1)"),
        b: z.coerce.number().describe("Blue (0-1)"),
        a: z.coerce.number().optional().describe("Alpha (0-1, default 1)"),
      }),
    ])).describe("The value — number for FLOAT, string for STRING, boolean for BOOLEAN, {r,g,b,a} object (0-1) for COLOR. Example COLOR: {\"r\":0.2,\"g\":0.5,\"b\":1,\"a\":1}"),
  },
  async ({ variableId, modeId, value }: any) => {
    try {
      const result = await sendCommandToFigma("set_variable_value", { variableId, modeId, value });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting variable value: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Add Mode Tool
server.tool(
  "add_mode",
  "Add a new mode to a variable collection",
  {
    collectionId: z.string().describe("The variable collection ID"),
    name: z.string().describe("Name for the new mode"),
  },
  async ({ collectionId, name }: any) => {
    try {
      const result = await sendCommandToFigma("add_mode", { collectionId, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Rename Mode Tool
server.tool(
  "rename_mode",
  "Rename an existing mode in a variable collection",
  {
    collectionId: z.string().describe("The variable collection ID"),
    modeId: z.string().describe("The mode ID to rename"),
    name: z.string().describe("New name for the mode"),
  },
  async ({ collectionId, modeId, name }: any) => {
    try {
      const result = await sendCommandToFigma("rename_mode", { collectionId, modeId, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Remove Mode Tool
server.tool(
  "remove_mode",
  "Remove a mode from a variable collection",
  {
    collectionId: z.string().describe("The variable collection ID"),
    modeId: z.string().describe("The mode ID to remove"),
  },
  async ({ collectionId, modeId }: any) => {
    try {
      const result = await sendCommandToFigma("remove_mode", { collectionId, modeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing mode: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Rename Page Tool
server.tool(
  "rename_page",
  "Rename a page. Defaults to current page if no pageId given.",
  {
    newName: z.string().describe("New name for the page"),
    pageId: z.string().optional().describe("Page ID to rename (defaults to current page)"),
  },
  async ({ newName, pageId }: any) => {
    try {
      const result = await sendCommandToFigma("rename_page", { newName, pageId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error renaming page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Zoom Into View Tool
server.tool(
  "zoom_into_view",
  "Scroll and zoom the viewport to fit specific nodes on screen (like pressing Shift+1). Use this to bring the user's attention to nodes you just created or modified.",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to zoom into view. Example: [\"1:2\"]"),
  },
  async ({ nodeIds }: any) => {
    try {
      const result = await sendCommandToFigma("zoom_into_view", { nodeIds });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error zooming into view: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Viewport Tool
server.tool(
  "set_viewport",
  "Set the viewport center position and/or zoom level. Zoom 1.0 = 100%, 0.5 = 50%, 2.0 = 200%.",
  {
    center: flexJson(z.object({
      x: z.coerce.number().describe("X coordinate of viewport center"),
      y: z.coerce.number().describe("Y coordinate of viewport center"),
    }).optional()).describe("Viewport center point. Example: {\"x\":500,\"y\":300}"),
    zoom: z.coerce.number().min(0.01).max(256).optional().describe("Zoom level (1.0 = 100%)"),
  },
  async ({ center, zoom }: any) => {
    try {
      const result = await sendCommandToFigma("set_viewport", { center, zoom });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting viewport: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Auto Layout Tool
server.tool(
  "create_auto_layout",
  "Wrap existing nodes in an auto-layout frame. One call replaces create_frame + set_layout_mode + insert_child × N. Defaults to VERTICAL layout with HUG sizing.",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to wrap. Example: [\"1:2\",\"1:3\"]"),
    name: z.string().optional().describe("Name for the frame (default 'Auto Layout')"),
    layoutMode: z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default VERTICAL)"),
    itemSpacing: z.coerce.number().optional().describe("Spacing between children (default 0)"),
    paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
    paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
    paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
    paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
    primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
    counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
    layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: HUG)"),
    layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: HUG)"),
    layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap children (default: NO_WRAP)"),
  },
  async ({ nodeIds, name, layoutMode, itemSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, layoutWrap }: any) => {
    try {
      const result = await sendCommandToFigma("create_auto_layout", { nodeIds, name, layoutMode, itemSpacing, paddingTop, paddingRight, paddingBottom, paddingLeft, primaryAxisAlignItems, counterAxisAlignItems, layoutSizingHorizontal, layoutSizingVertical, layoutWrap });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating auto layout: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Local Variables Tool
server.tool(
  "get_local_variables",
  "List local variables (names, IDs, types only - no values). Use collectionId to browse a specific collection's contents. Use get_variable_by_id for full values.",
  {
    type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional().describe("Filter by variable type"),
    collectionId: z.string().optional().describe("Filter to variables in this collection only"),
  },
  async ({ type, collectionId }: any) => {
    try {
      const result = await sendCommandToFigma("get_local_variables", { type, collectionId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variables: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Local Variable Collections Tool
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

// Set Variable Binding Tool
server.tool(
  "set_variable_binding",
  "Bind a variable to a node property. For scalar fields use the field name directly (e.g., 'opacity', 'itemSpacing', 'cornerRadius'). For paint colors use 'fills/0/color' or 'strokes/0/color' syntax.",
  {
    nodeId: z.string().describe("The node ID to bind the variable to"),
    field: z.string().describe("Property field: scalar fields like 'opacity', 'width', 'itemSpacing', 'paddingLeft', 'visible', 'topLeftRadius', 'strokeWeight'; or paint color fields like 'fills/0/color', 'strokes/0/color'"),
    variableId: z.string().describe("The variable ID to bind"),
  },
  async ({ nodeId, field, variableId }: any) => {
    try {
      const result = await sendCommandToFigma("set_variable_binding", { nodeId, field, variableId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error binding variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Paint Style Tool
server.tool(
  "create_paint_style",
  "Create a color/paint style",
  {
    name: z.string().describe("Name for the paint style"),
    color: flexJson(z.object({
      r: z.coerce.number().describe("Red (0-1)"),
      g: z.coerce.number().describe("Green (0-1)"),
      b: z.coerce.number().describe("Blue (0-1)"),
      a: z.coerce.number().optional().describe("Alpha (0-1, default 1)"),
    })).describe("Color RGBA (0-1 each). Example: {\"r\":0.2,\"g\":0.5,\"b\":1} — omit a for full opacity"),
  },
  async ({ name, color }: any) => {
    try {
      const result = await sendCommandToFigma("create_paint_style", { name, color });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating paint style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Text Style Tool
server.tool(
  "create_text_style",
  "Create a text style with font properties",
  {
    name: z.string().describe("Name for the text style"),
    fontFamily: z.string().describe("Font family name"),
    fontStyle: z.string().optional().describe("Font style (e.g., 'Regular', 'Bold', 'Italic') (default: 'Regular')"),
    fontSize: z.coerce.number().describe("Font size in pixels"),
    lineHeight: flexNum(z.union([
      z.number(),
      z.object({
        value: z.coerce.number(),
        unit: z.enum(["PIXELS", "PERCENT", "AUTO"]),
      }),
    ]).optional()).describe("Line height — number (pixels) or {value, unit}. Examples: 24, {\"value\":150,\"unit\":\"PERCENT\"}"),
    letterSpacing: flexNum(z.union([
      z.number(),
      z.object({
        value: z.coerce.number(),
        unit: z.enum(["PIXELS", "PERCENT"]),
      }),
    ]).optional()).describe("Letter spacing — number (pixels) or {value, unit}. Examples: 0.5, {\"value\":2,\"unit\":\"PERCENT\"}"),
    textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional().describe("Text case transform"),
    textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional().describe("Text decoration"),
  },
  async ({ name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textCase, textDecoration }: any) => {
    try {
      const result = await sendCommandToFigma("create_text_style", { name, fontFamily, fontStyle, fontSize, lineHeight, letterSpacing, textCase, textDecoration });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating text style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Effect Style Tool
server.tool(
  "create_effect_style",
  "Create an effect style (shadows, blurs)",
  {
    name: z.string().describe("Name for the effect style"),
    effects: flexJson(z.array(z.object({
      type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
      color: z.object({
        r: z.coerce.number(), g: z.coerce.number(), b: z.coerce.number(), a: z.coerce.number().optional(),
      }).optional().describe("Effect color RGBA (0-1). Example: {\"r\":0,\"g\":0,\"b\":0,\"a\":0.25}"),
      offset: z.object({
        x: z.coerce.number(), y: z.coerce.number(),
      }).optional().describe("Shadow offset. Example: {\"x\":0,\"y\":4}"),
      radius: z.coerce.number().describe("Blur radius"),
      spread: z.coerce.number().optional().describe("Shadow spread"),
      visible: flexBool(z.boolean().optional()).describe("Whether effect is visible (default true)"),
      blendMode: z.enum(["NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LIGHTEN", "SCREEN", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]).optional().describe("Blend mode for shadows (default NORMAL)"),
    }))).describe("Array of effects. Example: [{\"type\":\"DROP_SHADOW\",\"color\":{\"r\":0,\"g\":0,\"b\":0,\"a\":0.25},\"offset\":{\"x\":0,\"y\":4},\"radius\":4}]"),
  },
  async ({ name, effects }: any) => {
    try {
      const result = await sendCommandToFigma("create_effect_style", { name, effects });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating effect style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Apply Style To Node Tool
server.tool(
  "apply_style_to_node",
  "Apply a style to a node by ID or name. Provide either styleId or styleName (name supports case-insensitive substring match).",
  {
    nodeId: z.string().describe("The node ID to apply the style to"),
    styleId: z.string().optional().describe("The style ID to apply (from create_paint_style, create_text_style, etc.)"),
    styleName: z.string().optional().describe("Style name to look up (e.g., \"Heading/Large Title\"). Case-insensitive substring match. Use instead of styleId for convenience."),
    styleType: z.enum(["fill", "stroke", "text", "effect"]).describe("Type of style to apply"),
  },
  async ({ nodeId, styleId, styleName, styleType }: any) => {
    try {
      const result = await sendCommandToFigma("apply_style_to_node", { nodeId, styleId, styleName, styleType });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error applying style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Ellipse Tool
server.tool(
  "create_ellipse",
  "Create an ellipse/circle in Figma. Default: white fill (Figma native). Use equal width/height for a circle.",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    width: z.coerce.number().optional().describe("Width (default: 100)"),
    height: z.coerce.number().optional().describe("Height (default: 100)"),
    name: z.string().optional().describe("Name for the ellipse"),
    parentId: z.string().optional().describe("Parent node ID to append into"),
  },
  async ({ x, y, width, height, name, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_ellipse", { x, y, width, height, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating ellipse: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Line Tool
server.tool(
  "create_line",
  "Create a line in Figma. Default: black stroke.",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    length: z.coerce.number().optional().describe("Length of the line (default: 100)"),
    rotation: z.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
    name: z.string().optional().describe("Name for the line"),
    parentId: z.string().optional().describe("Parent node ID to append into"),
  },
  async ({ x, y, length, rotation, name, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_line", { x, y, length, rotation, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating line: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Boolean Operation Tool
server.tool(
  "create_boolean_operation",
  "Create a boolean operation (union, intersect, subtract, exclude) from multiple nodes",
  {
    nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs to combine. Example: [\"1:2\",\"1:3\"]"),
    operation: z.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
    name: z.string().optional().describe("Name for the resulting node"),
  },
  async ({ nodeIds, operation, name }: any) => {
    try {
      const result = await sendCommandToFigma("create_boolean_operation", { nodeIds, operation, name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating boolean operation: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Opacity Tool
server.tool(
  "set_opacity",
  "Set the opacity of a node",
  {
    nodeId: z.string().describe("The node ID"),
    opacity: z.coerce.number().min(0).max(1).describe("Opacity value (0-1)"),
  },
  async ({ nodeId, opacity }: any) => {
    try {
      const result = await sendCommandToFigma("set_opacity", { nodeId, opacity });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting opacity: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Effects Tool
server.tool(
  "set_effects",
  "Set effects (shadows, blurs) on a node",
  {
    nodeId: z.string().describe("The node ID"),
    effects: flexJson(z.array(z.object({
      type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]).describe("Effect type"),
      color: z.object({
        r: z.coerce.number(), g: z.coerce.number(), b: z.coerce.number(), a: z.coerce.number().optional(),
      }).optional().describe("Effect color RGBA (0-1). Example: {\"r\":0,\"g\":0,\"b\":0,\"a\":0.25}"),
      offset: z.object({
        x: z.coerce.number(), y: z.coerce.number(),
      }).optional().describe("Shadow offset. Example: {\"x\":0,\"y\":4}"),
      radius: z.coerce.number().describe("Blur radius"),
      spread: z.coerce.number().optional().describe("Shadow spread"),
      visible: flexBool(z.boolean().optional()).describe("Whether effect is visible (default true)"),
      blendMode: z.enum(["NORMAL", "DARKEN", "MULTIPLY", "COLOR_BURN", "LIGHTEN", "SCREEN", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT", "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY"]).optional().describe("Blend mode for shadows (default NORMAL)"),
    }))).describe("Array of effects. Example: [{\"type\":\"DROP_SHADOW\",\"color\":{\"r\":0,\"g\":0,\"b\":0,\"a\":0.25},\"offset\":{\"x\":0,\"y\":4},\"radius\":4}]"),
  },
  async ({ nodeId, effects }: any) => {
    try {
      const result = await sendCommandToFigma("set_effects", { nodeId, effects });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting effects: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Constraints Tool
server.tool(
  "set_constraints",
  "Set layout constraints on a node",
  {
    nodeId: z.string().describe("The node ID"),
    horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).describe("Horizontal constraint"),
    vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]).describe("Vertical constraint"),
  },
  async ({ nodeId, horizontal, vertical }: any) => {
    try {
      const result = await sendCommandToFigma("set_constraints", { nodeId, horizontal, vertical });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting constraints: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Export Settings Tool
server.tool(
  "set_export_settings",
  "Set export settings on a node",
  {
    nodeId: z.string().describe("The node ID"),
    settings: flexJson(z.array(z.object({
      format: z.enum(["PNG", "JPG", "SVG", "PDF"]).describe("Export format"),
      suffix: z.string().optional().describe("File suffix"),
      contentsOnly: flexBool(z.boolean().optional()).describe("Export contents only (default true)"),
      constraint: z.object({
        type: z.enum(["SCALE", "WIDTH", "HEIGHT"]).describe("Constraint type"),
        value: z.coerce.number().describe("Constraint value"),
      }).optional().describe("Export constraint. Example: {\"type\":\"SCALE\",\"value\":2}"),
    }))).describe("Array of export settings. Example: [{\"format\":\"PNG\",\"constraint\":{\"type\":\"SCALE\",\"value\":2}}]"),
  },
  async ({ nodeId, settings }: any) => {
    try {
      const result = await sendCommandToFigma("set_export_settings", { nodeId, settings });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting export settings: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Set Node Properties Tool
server.tool(
  "set_node_properties",
  "Batch-set multiple properties on a node at once",
  {
    nodeId: z.string().describe("The node ID"),
    properties: flexJson(z.record(z.unknown())).describe("Object of property key-value pairs. Example: {\"opacity\":0.5,\"visible\":false,\"locked\":true}"),
  },
  async ({ nodeId, properties }: any) => {
    try {
      const result = await sendCommandToFigma("set_node_properties", { nodeId, properties });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting node properties: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Style By ID Tool
server.tool(
  "get_style_by_id",
  "Get detailed information about a specific style by its ID. Returns full paint/font/effect/grid details.",
  {
    styleId: z.string().describe("The style ID to look up"),
  },
  async ({ styleId }: any) => {
    try {
      const result = await sendCommandToFigma("get_style_by_id", { styleId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Remove Style Tool
server.tool(
  "remove_style",
  "Delete/remove a style from the document by its ID",
  {
    styleId: z.string().describe("The style ID to remove"),
  },
  async ({ styleId }: any) => {
    try {
      const result = await sendCommandToFigma("remove_style", { styleId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error removing style: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Component By ID Tool
server.tool(
  "get_component_by_id",
  "Get detailed information about a component including property definitions and variant group properties. For COMPONENT_SETs, variant children are omitted by default (use includeChildren=true to list them) since propertyDefinitions already describes the full variant space.",
  {
    componentId: z.string().describe("The component node ID"),
    includeChildren: flexBool(z.boolean().optional()).describe("For COMPONENT_SETs: include variant children list (default false). Plain COMPONENTs always include children."),
  },
  async ({ componentId, includeChildren }: any) => {
    try {
      const result = await sendCommandToFigma("get_component_by_id", { componentId, includeChildren });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting component: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Variable By ID Tool
server.tool(
  "get_variable_by_id",
  "Get detailed information about a variable by its ID, including all mode values.",
  {
    variableId: z.string().describe("The variable ID"),
  },
  async ({ variableId }: any) => {
    try {
      const result = await sendCommandToFigma("get_variable_by_id", { variableId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variable: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Variable Collection By ID Tool
server.tool(
  "get_variable_collection_by_id",
  "Get detailed information about a variable collection by its ID, including modes and variable IDs.",
  {
    collectionId: z.string().describe("The variable collection ID"),
  },
  async ({ collectionId }: any) => {
    try {
      const result = await sendCommandToFigma("get_variable_collection_by_id", { collectionId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting variable collection: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Pages Tool
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

// Set Current Page Tool
server.tool(
  "set_current_page",
  "Switch to a different page. Provide either pageId or pageName (at least one required).",
  {
    pageId: z.string().optional().describe("The page ID to switch to"),
    pageName: z.string().optional().describe("The page name to switch to (case-insensitive, supports partial match)"),
  },
  async ({ pageId, pageName }: any) => {
    try {
      const result = await sendCommandToFigma("set_current_page", { pageId, pageName });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error setting current page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Page Tool
server.tool(
  "create_page",
  "Create a new page in the document",
  {
    name: z.string().optional().describe("Name for the new page (default: 'New Page')"),
  },
  async ({ name }: any) => {
    try {
      const result = await sendCommandToFigma("create_page", { name });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating page: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Node CSS Tool
server.tool(
  "get_node_css",
  "Get CSS properties for a node (useful for dev handoff)",
  {
    nodeId: z.string().describe("The node ID to get CSS for"),
  },
  async ({ nodeId }: any) => {
    try {
      const result = await sendCommandToFigma("get_node_css", { nodeId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting CSS: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Available Fonts Tool
server.tool(
  "get_available_fonts",
  "List available fonts in Figma, grouped by family. Use query to filter by family name (e.g., 'Inter', 'SF Pro'). Without query, returns ALL fonts — use query to avoid large responses.",
  {
    query: z.string().optional().describe("Filter font families by name (case-insensitive substring match). Strongly recommended."),
  },
  async ({ query }: any) => {
    try {
      const result = await sendCommandToFigma("get_available_fonts", { query });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error getting fonts: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Section Tool
server.tool(
  "create_section",
  "Create a section node to organize content on the canvas. Sections are top-level containers.",
  {
    x: z.coerce.number().optional().describe("X position (default: 0)"),
    y: z.coerce.number().optional().describe("Y position (default: 0)"),
    width: z.coerce.number().optional().describe("Width (default: 500)"),
    height: z.coerce.number().optional().describe("Height (default: 500)"),
    name: z.string().optional().describe("Name for the section (default: 'Section')"),
    parentId: z.string().optional().describe("Parent node ID"),
  },
  async ({ x, y, width, height, name, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_section", { x, y, width, height, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating section: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Insert Child Tool
server.tool(
  "insert_child",
  "Move a node into a parent at a specific index (reorder/reparent)",
  {
    parentId: z.string().describe("The parent node ID"),
    childId: z.string().describe("The child node ID to move"),
    index: z.coerce.number().optional().describe("Index to insert at (0=first). Omit to append at end."),
  },
  async ({ parentId, childId, index }: any) => {
    try {
      const result = await sendCommandToFigma("insert_child", { parentId, childId, index });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error inserting child: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Create Node From SVG Tool
server.tool(
  "create_node_from_svg",
  "Create a node from an SVG string",
  {
    svg: z.string().describe("SVG markup string"),
    x: z.coerce.number().optional().describe("X position (default 0)"),
    y: z.coerce.number().optional().describe("Y position (default 0)"),
    name: z.string().optional().describe("Name for the node"),
    parentId: z.string().optional().describe("Parent node ID"),
  },
  async ({ svg, x, y, name, parentId }: any) => {
    try {
      const result = await sendCommandToFigma("create_node_from_svg", { svg, x, y, name, parentId });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error creating node from SVG: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Get Current Page Tool - always safe, never touches unloaded pages
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

// Search Nodes Tool
server.tool(
  "search_nodes",
  "Search for nodes by name and/or type within a scope. Returns paginated results with parent info and bounds.",
  {
    query: z.string().optional().describe("Search string to match against node names (case-insensitive substring match)"),
    types: flexJson(z.array(z.string()).optional()).describe("Filter by node types. Example: [\"FRAME\",\"COMPONENT\",\"TEXT\",\"INSTANCE\"]"),
    scopeNodeId: z.string().optional().describe("Node ID to search within (defaults to current page)"),
    caseSensitive: flexBool(z.boolean().optional()).describe("If true, name matching is case-sensitive (default false)"),
    limit: z.coerce.number().optional().describe("Max results to return (default 50)"),
    offset: z.coerce.number().optional().describe("Skip this many results for pagination (default 0)"),
  },
  async ({ query, types, scopeNodeId, caseSensitive, limit, offset }: any) => {
    try {
      const result = await sendCommandToFigma("search_nodes", { query, types, scopeNodeId, caseSensitive, limit, offset });
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error searching nodes: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Update the join_channel tool
server.tool(
  "join_channel",
  "Join a specific channel to communicate with Figma",
  {
    channel: z.string().describe("The name of the channel to join").default(""),
  },
  async ({ channel }: any) => {
    try {
      if (!channel) {
        // If no channel provided, ask the user for input
        return {
          content: [
            {
              type: "text",
              text: "Please provide a channel name to join:",
            },
          ],
          followUp: {
            tool: "join_channel",
            description: "Join the specified channel",
          },
        };
      }

      await joinChannel(channel);
      return {
        content: [
          {
            type: "text",
            text: `Successfully joined channel: ${channel}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error joining channel: ${error instanceof Error ? error.message : String(error)
              }`,
          },
        ],
      };
    }
  }
);

// Start the server
async function main() {
  try {
    // Try to connect to Figma socket server
    connectToFigma();
  } catch (error) {
    logger.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn('Will try to connect when the first command is sent');
  }

  // Start the MCP server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('FigmaMCP server running on stdio');
}

// Run the server
main().catch(error => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});



