/**
 * TypeScript result interfaces for all MCP tool responses.
 *
 * Two purposes:
 * 1. Type annotations on handler functions (compile-time safety)
 * 2. `toolResponseSchemas` map consumed by docs extraction script
 */

// ─── Shared Building Blocks ────────────────────────────────────

export interface NodeStub {
  id: string;
  name: string;
  type: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ModeEntry {
  modeId: string;
  name: string;
}

export interface StyleEntry {
  id: string;
  name: string;
}

export interface Vector2 {
  x: number;
  y: number;
}

// ─── Batch Item Results ────────────────────────────────────────
// These are the per-item shapes inside BatchResult<T>.results[]

/** Most creation tools */
export interface IdResult {
  id: string;
}

/** create_frame, create_text, create_component, create_component_from_node */
export interface IdWithWarningResult {
  id: string;
  warning?: string;
}

/** set_fill_color, set_stroke_color, set_effects */
export interface StyleMatchResult {
  matchedStyle?: string;
  warning?: string;
}


/** set_text_properties */
export interface TextPropertyResult {
  warning?: string;
}

/** create_variable_collection */
export interface CollectionCreatedResult {
  id: string;
  modes: ModeEntry[];
  defaultModeId: string;
}


/** lint_fix_autolayout — success */
export interface FixAutolayoutResult {
  layoutMode: "VERTICAL" | "HORIZONTAL";
}

/** lint_fix_autolayout — skipped */
export interface FixAutolayoutSkippedResult {
  skipped: true;
  reason: string;
}


/** scan_text_nodes — per-item result */
export interface ScanTextItemResult {
  nodeId: string;
  count: number;
  truncated: boolean;
  textNodes: Array<{
    id: string;
    name: string;
    characters: string;
    fontSize: number;
    fontFamily: string;
    fontStyle: string;
    absoluteX?: number | null;
    absoluteY?: number | null;
    width?: number;
    height?: number;
    path?: string;
    pathIds?: string;
    depth?: number;
  }>;
}

// ─── Standalone Results ────────────────────────────────────────

// Connection
export interface PingResult {
  status: "pong";
  documentName: string;
  currentPage: string;
  timestamp: number;
}

// Document & Navigation
export interface GetDocumentInfoResult {
  name: string;
  currentPageId: string;
  pages: Array<{ id: string; name: string }>;
}

export interface GetCurrentPageResult {
  id: string;
  name: string;
  children: NodeStub[];
}

export interface SetCurrentPageResult {
  id: string;
  name: string;
}

// Node Inspection
export interface GetNodeInfoResult {
  results: Array<Record<string, unknown>>;
  _truncated?: boolean;
  _notice?: string;
}

export interface SearchNodesResult {
  totalCount: number;
  returned: number;
  offset: number;
  limit: number;
  results: Array<
    NodeStub & {
      parentId?: string;
      parentName?: string;
      bounds?: BoundingBox;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    }
  >;
}

export interface ExportNodeAsImageResult {
  mimeType: string;
  imageData: string;
}

export interface GetSelectionResult {
  selectionCount: number;
  selection: Array<NodeStub | Record<string, unknown>>;
  _truncated?: boolean;
  _notice?: string;
}

export interface SetSelectionResult {
  count: number;
  selectedNodes: Array<{ name: string; id: string }>;
  notFoundIds?: string[];
}

// Variables
export interface GetNodeVariablesResult {
  nodeId: string;
  boundVariables?: Record<string, unknown>;
  explicitVariableModes?: Record<string, string>;
}

// Styles
export interface GetStyleByIdResult {
  id: string;
  name: string;
  type: "PAINT" | "TEXT" | "EFFECT";
  paints?: unknown[];
  fontSize?: number;
  fontName?: unknown;
  letterSpacing?: unknown;
  lineHeight?: unknown;
  textCase?: string;
  textDecoration?: string;
  effects?: unknown[];
}


// Components
export interface GetInstanceOverridesResult {
  mainComponentId?: string;
  overrides: Array<{ id: string; fields: string[] }>;
}

// Lint
export interface LintCategory {
  rule: string;
  count: number;
  fix: string;
  nodes: Array<{ id: string; name: string; [key: string]: unknown }>;
}

export interface LintNodeResult {
  nodeId: string;
  nodeName: string;
  categories: LintCategory[];
  warning?: string;
}

// Text & Fonts
export interface GetAvailableFontsResult {
  count: number;
  fonts: Array<{ family: string; styles: string[] }>;
}

// ─── Response JSON Schemas for Docs ────────────────────────────

const stringProp = { type: "string" };
const numberProp = { type: "number" };
const boolProp = { type: "boolean" };

const idProp = { type: "string", description: "Node ID" };
const nodeStubSchema = {
  type: "object",
  properties: { id: idProp, name: stringProp, type: stringProp },
};
const modeEntrySchema = {
  type: "object",
  properties: { modeId: stringProp, name: stringProp },
};
const styleEntrySchema = {
  type: "object",
  properties: { id: stringProp, name: stringProp },
};
const vector2Schema = {
  type: "object",
  properties: { x: numberProp, y: numberProp },
};
const boundsSchema = {
  type: "object",
  properties: { x: numberProp, y: numberProp, width: numberProp, height: numberProp },
};

interface SchemaEntry {
  type?: string;
  const?: string;
  description?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  example?: unknown;
  [key: string]: unknown;
}

const errorItem = {
  title: "error",
  type: "object",
  properties: { error: { type: "string", description: "Error message for this item" } },
  required: ["error"],
};

/** Wrap per-item properties in the standard batch envelope */
function batchSchema(
  itemProps: Record<string, unknown>,
  opts?: { description?: string; example?: unknown },
): SchemaEntry {
  return {
    type: "object",
    ...(opts?.description ? { description: opts.description } : {}),
    properties: {
      results: {
        type: "array",
        description: "Per-item results.",
        items: {
          oneOf: [
            { title: "success", type: "object", properties: itemProps },
            errorItem,
          ],
        },
      },
      warnings: {
        type: "array",
        description: "Deduplicated warnings hoisted from individual results",
        items: stringProp,
      },
    },
    required: ["results"],
    ...(opts?.example ? { example: opts.example } : {}),
  };
}

/** Batch where per-item can be "ok" (empty mutation), typed success, or error */
function mixedBatchSchema(
  itemProps: Record<string, unknown>,
  opts?: { description?: string; example?: unknown },
): SchemaEntry {
  return {
    type: "object",
    ...(opts?.description ? { description: opts.description } : {}),
    properties: {
      results: {
        type: "array",
        description: "Per-item results.",
        items: {
          oneOf: [
            { type: "string", const: "ok" },
            { title: "success", type: "object", properties: itemProps },
            errorItem,
          ],
        },
      },
      warnings: {
        type: "array",
        description: "Deduplicated warnings hoisted from individual results",
        items: stringProp,
      },
    },
    required: ["results"],
    ...(opts?.example ? { example: opts.example } : {}),
  };
}

function okBatchSchema(opts?: { description?: string; example?: unknown }): SchemaEntry {
  return {
    type: "object",
    ...(opts?.description ? { description: opts.description } : {}),
    properties: {
      results: {
        type: "array",
        description: "Per-item results.",
        items: {
          oneOf: [
            { type: "string", const: "ok" },
            errorItem,
          ],
        },
      },
      warnings: {
        type: "array",
        description: "Deduplicated warnings hoisted from individual results",
        items: stringProp,
      },
    },
    required: ["results"],
    ...(opts?.example ? { example: opts.example } : {}),
  };
}

function okSchema(opts?: { description?: string; example?: unknown }): SchemaEntry {
  return {
    type: "string",
    const: "ok",
    ...(opts?.description ? { description: opts.description } : {}),
    ...(opts?.example !== undefined ? { example: opts.example } : { example: "ok" }),
  };
}

/**
 * Runtime JSON Schema + example for each tool's response.
 * Consumed by scripts/extract-tools.ts for docs generation.
 */
export const toolResponseSchemas: Record<string, SchemaEntry> = {
  // ── Connection ──
  join_channel: {
    type: "string",
    description: "Confirmation message with channel and port",
    example: 'Joined channel "vibma" on port 3055. Call `ping` now to verify the Figma plugin is connected.',
  },
  channel_info: {
    type: "object",
    description: "Map of channel names to their connected clients",
    additionalProperties: {
      type: "object",
      properties: {
        mcp: {
          type: "object",
          properties: {
            connected: boolProp,
            version: { ...stringProp, description: "MCP server version" },
            name: { ...stringProp, description: "Client name" },
            joinedAt: { ...stringProp, description: "ISO 8601 timestamp" },
          },
        },
        plugin: {
          type: "object",
          properties: {
            connected: boolProp,
            version: { ...stringProp, description: "Plugin version" },
            name: { ...stringProp, description: "Client name" },
            joinedAt: { ...stringProp, description: "ISO 8601 timestamp" },
          },
        },
      },
    },
    example: {
      vibma: {
        mcp: { connected: true, version: "0.2.2", name: "vibma", joinedAt: "2026-03-02T19:43:37.863Z" },
        plugin: { connected: true, version: "0.2.2", name: null, joinedAt: "2026-03-02T19:42:18.294Z" },
      },
    },
  },
  reset_tunnel: {
    type: "string",
    description: "Confirmation of tunnel reset",
    example: "Channel vibma reset",
  },
  ping: {
    type: "object",
    properties: {
      status: { type: "string", const: "pong" },
      documentName: { ...stringProp, description: "Active Figma document name" },
      currentPage: { ...stringProp, description: "Current page name" },
      timestamp: { ...numberProp, description: "Unix timestamp" },
    },
    required: ["status", "documentName", "currentPage", "timestamp"],
    example: { status: "pong", documentName: "Design System", currentPage: "Components", timestamp: 1709337600 },
  },

  // ── Document & Navigation ──
  get_document_info: {
    type: "object",
    properties: {
      name: { ...stringProp, description: "Document name" },
      currentPageId: { ...stringProp, description: "Active page ID" },
      pages: { type: "array", items: { type: "object", properties: { id: stringProp, name: stringProp } } },
    },
    required: ["name", "currentPageId", "pages"],
    example: { name: "Design System", currentPageId: "0:1", pages: [{ id: "0:1", name: "Components" }, { id: "5:0", name: "Icons" }] },
  },
  get_current_page: {
    type: "object",
    properties: {
      id: stringProp,
      name: stringProp,
      children: { type: "array", description: "Top-level children on the page", items: nodeStubSchema },
    },
    required: ["id", "name", "children"],
    example: { id: "0:1", name: "Components", children: [{ id: "1:2", name: "Button", type: "COMPONENT_SET" }] },
  },
  set_current_page: {
    type: "object",
    properties: { id: stringProp, name: stringProp },
    required: ["id", "name"],
    example: { id: "5:0", name: "Icons" },
  },
  create_page: {
    type: "object",
    properties: { id: { ...stringProp, description: "New page ID" } },
    required: ["id"],
    example: { id: "12:0" },
  },
  rename_page: okSchema(),

  // ── Node Inspection ──
  get_node_info: {
    type: "object",
    description: "Serialized node tree(s). Shape depends on depth parameter.",
    properties: {
      results: { type: "array", description: "Serialized node trees", items: { type: "object" } },
      _truncated: { ...boolProp, description: "True when node budget exceeded" },
      _notice: { ...stringProp, description: "Human-readable truncation notice" },
    },
    required: ["results"],
    example: { results: [{ id: "1:2", name: "Button", type: "COMPONENT", width: 120, height: 40 }] },
  },
  search_nodes: {
    type: "object",
    properties: {
      totalCount: { ...numberProp, description: "Total matching nodes" },
      returned: { ...numberProp, description: "Number returned in this page" },
      offset: numberProp,
      limit: numberProp,
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: stringProp, name: stringProp, type: stringProp,
            parentId: stringProp, parentName: stringProp,
            bounds: boundsSchema,
          },
        },
      },
    },
    required: ["totalCount", "returned", "offset", "limit", "results"],
    example: { totalCount: 3, returned: 3, offset: 0, limit: 100, results: [{ id: "1:2", name: "Header", type: "FRAME", parentId: "0:1", parentName: "Page 1" }] },
  },
  export_node_as_image: {
    type: "object",
    description: "Returned as MCP image content (not JSON)",
    properties: {
      mimeType: stringProp,
      imageData: { ...stringProp, description: "Base64-encoded image data" },
    },
    required: ["mimeType", "imageData"],
    example: { nodeId: "1:2", format: "PNG", scale: 2, mimeType: "image/png", imageData: "iVBORw0KGgo..." },
  },
  get_selection: {
    type: "object",
    properties: {
      selectionCount: numberProp,
      selection: {
        type: "array",
        items: {
          type: "object",
          description: "Stubs (no depth) or full serialized nodes (with depth)",
          properties: { id: stringProp, name: stringProp, type: stringProp },
        },
      },
      _truncated: boolProp,
      _notice: stringProp,
    },
    required: ["selectionCount", "selection"],
    example: { selectionCount: 1, selection: [{ id: "1:2", name: "Button", type: "COMPONENT" }] },
  },
  set_selection: {
    type: "object",
    properties: {
      count: { ...numberProp, description: "Number of nodes selected" },
      selectedNodes: { type: "array", items: { type: "object", properties: { name: stringProp, id: stringProp } } },
      notFoundIds: { type: "array", description: "IDs that could not be found", items: stringProp },
    },
    required: ["count", "selectedNodes"],
    example: { count: 2, selectedNodes: [{ name: "Button", id: "1:2" }, { name: "Card", id: "3:4" }] },
  },
  // ── Creation (all batch) ──
  create_section: batchSchema({ id: idProp }, {
    example: { results: [{ id: "10:4" }] },
  }),
  create_node_from_svg: okBatchSchema({
    example: { results: ["ok"] },
  }),
  create_frame: batchSchema({
    id: idProp,
  }, {
    example: { results: [{ id: "10:7" }] },
  }),
  create_auto_layout: batchSchema({ id: idProp }, {
    example: { results: [{ id: "10:8" }] },
  }),
  create_text: batchSchema({
    id: idProp,
    linkedTextStyle: { ...stringProp, description: "Name of auto-linked text style" },
    linkedFontColor: { ...stringProp, description: "Name of auto-linked font color style" },
  }, {
    example: { results: [{ id: "10:9" }], warnings: ["Hint: textStyleName 'Body' matches — use it for design token consistency."] },
  }),

  // ── Modification (all batch) ──
  patch_nodes: mixedBatchSchema({
    matchedFillStyle: { ...stringProp, description: "Matched fill paint style name" },
    matchedStrokeStyle: { ...stringProp, description: "Matched stroke paint style name" },
    matchedEffectStyle: { ...stringProp, description: "Matched effect style name" },
  }, {
    description: "Per-item is 'ok' (no style matches) or object with matched style names.",
    example: { results: ["ok", { matchedFillStyle: "Primary/Blue" }], warnings: ["Hardcoded color #ff0000 has no matching paint style or color variable."] },
  }),
  delete_node: okBatchSchema({ example: { results: ["ok", "ok"] } }),
  clone_node: batchSchema({ id: { ...stringProp, description: "Cloned node ID" } }, {
    example: { results: [{ id: "11:1" }] },
  }),
  insert_child: okBatchSchema({ example: { results: ["ok"] } }),

  // ── Styles ──
  styles: {
    type: "object",
    description: "Response varies by method. list → paginated {totalCount, items: [...]} (stubs by default, use fields for detail). get → style object (full detail, field-filterable). create → {results: [{id}]}. update → {results: ['ok'|{warning}]}. delete → 'ok' (single) or {results: ['ok', ...]} (batch).",
    example: {
      totalCount: 3, returned: 3, offset: 0, limit: 100,
      items: [
        { id: "S:abc123,", name: "Primary/Blue", type: "PAINT" },
        { id: "S:def456,", name: "Heading/H1", type: "TEXT" },
        { id: "S:ghi789,", name: "Shadow/Large", type: "EFFECT" },
      ],
    },
  },

  // ── Variables ──
  variable_collections: {
    type: "object",
    description: "Response varies by method. create → {results: [{id, modes, defaultModeId}]}. get → collection object (field-filterable). list → paginated stubs. delete → 'ok' or {results: ['ok', ...]}. add_mode → {results: [{modeId, modes}]}. rename_mode/remove_mode → {results: [{modes}]}.",
    example: {
      totalCount: 2, returned: 2, offset: 0, limit: 100,
      items: [
        { id: "VariableCollectionId:1:0", name: "Colors" },
        { id: "VariableCollectionId:2:0", name: "Spacing" },
      ],
    },
  },
  variables: {
    type: "object",
    description: "Response varies by method. create → {results: [{id}]}. get → variable object (full detail, field-filterable). list → paginated stubs (use fields for detail). update → {results: ['ok', ...]}.",
    example: {
      totalCount: 3, returned: 3, offset: 0, limit: 100,
      items: [
        { id: "VariableID:1:6", name: "primary", resolvedType: "COLOR", variableCollectionId: "VariableCollectionId:1:0" },
        { id: "VariableID:1:7", name: "secondary", resolvedType: "COLOR", variableCollectionId: "VariableCollectionId:1:0" },
        { id: "VariableID:2:1", name: "sm", resolvedType: "FLOAT", variableCollectionId: "VariableCollectionId:2:0" },
      ],
    },
  },
  set_variable_binding: okBatchSchema({ example: { results: ["ok"] } }),
  set_explicit_variable_mode: okBatchSchema({ example: { results: ["ok"] } }),
  get_node_variables: {
    type: "object",
    properties: {
      nodeId: stringProp,
      boundVariables: { type: "object", description: "Field → variable binding(s)" },
      explicitVariableModes: { type: "object", description: "Collection ID → pinned mode ID" },
    },
    required: ["nodeId"],
    example: { nodeId: "1:2", boundVariables: { fills: [{ variableId: "VariableID:1:6" }] }, explicitVariableModes: { "VariableCollectionId:1:0": "1:1" } },
  },

  // ── Components ──
  components: {
    type: "object",
    description: "Response varies by method. create → {results: [{id}]}. get → component object (full detail, field-filterable). list → paginated stubs. update → {results: ['ok', ...]}.",
    example: {
      totalCount: 2, returned: 2, offset: 0, limit: 100,
      items: [
        { id: "20:3", name: "Button", type: "COMPONENT_SET", variantCount: 4, pageId: "0:1", pageName: "Components" },
        { id: "20:10", name: "Icon/Star", type: "COMPONENT", pageId: "5:0", pageName: "Icons" },
      ],
    },
  },
  instances: {
    type: "object",
    description: "Response varies by method. create → {results: [{id}]}. get → {mainComponentId, overrides: [{id, fields}]}. update → {results: ['ok', ...]}.",
    example: { results: [{ id: "21:1" }] },
  },

  // ── Text & Fonts ──
  set_text_content: okBatchSchema({ example: { results: ["ok", "ok"] } }),
  scan_text_nodes: batchSchema({
    nodeId: stringProp,
    count: { ...numberProp, description: "Total text nodes found" },
    truncated: { ...boolProp, description: "Whether results were truncated" },
    textNodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: stringProp, name: stringProp,
          characters: { ...stringProp, description: "Text content" },
          fontSize: numberProp, fontFamily: stringProp, fontStyle: stringProp,
          absoluteX: numberProp, absoluteY: numberProp,
          width: numberProp, height: numberProp,
          path: { ...stringProp, description: "Ancestor path string" },
          pathIds: stringProp,
          depth: numberProp,
        },
      },
    },
  }, {
    example: { results: [{ nodeId: "1:2", count: 2, truncated: false, textNodes: [{ id: "1:5", name: "Label", characters: "Submit", fontSize: 14, fontFamily: "Inter", fontStyle: "Medium", path: "Card > Button > Label", depth: 2 }] }] },
  }),
  get_available_fonts: {
    type: "object",
    properties: {
      count: numberProp,
      fonts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            family: stringProp,
            styles: { type: "array", items: stringProp },
          },
        },
      },
    },
    required: ["count", "fonts"],
    example: { count: 2, fonts: [{ family: "Inter", styles: ["Regular", "Medium", "Bold"] }, { family: "Roboto", styles: ["Regular", "Bold"] }] },
  },

  // ── Lint & Export ──
  lint_node: {
    type: "object",
    properties: {
      nodeId: stringProp,
      nodeName: stringProp,
      categories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rule: { ...stringProp, description: "Lint rule name" },
            count: numberProp,
            fix: { ...stringProp, description: "Human-readable fix instructions" },
            nodes: {
              type: "array",
              description: "Affected nodes with rule-specific extra fields",
              items: { type: "object", properties: { id: stringProp, name: stringProp } },
            },
          },
        },
      },
      warning: { ...stringProp, description: "Present when results truncated" },
    },
    required: ["nodeId", "nodeName", "categories"],
    example: { nodeId: "1:2", nodeName: "Card", categories: [{ rule: "hardcoded-color", count: 2, fix: "Use set_fill_color with styleName or set_variable_binding.", nodes: [{ id: "1:5", name: "Background", hex: "#3b82f6", property: "fill", matchType: "style", matchName: "Primary/Blue" }] }] },
  },
  lint_fix_autolayout: batchSchema({
    layoutMode: { type: "string", enum: ["VERTICAL", "HORIZONTAL"] },
    skipped: { ...boolProp, description: "True if node already has auto-layout" },
    reason: { ...stringProp, description: "Reason for skipping" },
  }, {
    example: { results: [{ layoutMode: "VERTICAL" }, { skipped: true, reason: "Already has auto-layout" }] },
  }),
};
