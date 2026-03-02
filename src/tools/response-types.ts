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

/** apply_style_to_node */
export interface ApplyStyleItemResult {
  styleId: string;
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

/** add_mode */
export interface AddModeResult {
  modeId: string;
  modes: ModeEntry[];
}

/** rename_mode, remove_mode */
export interface ModesResult {
  modes: ModeEntry[];
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

/** lint_fix_replace_shape_with_frame */
export interface FixShapeToFrameResult {
  id: string;
  adoptedChildren: string[];
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
export interface VariableEntry {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  variableCollectionId: string;
  valuesByMode?: Record<string, unknown>;
}

export interface GetLocalVariablesResult {
  variables: VariableEntry[];
}

export interface CollectionEntry {
  id: string;
  name: string;
  modes: ModeEntry[];
  defaultModeId: string;
  variableIds: string[];
}

export interface GetLocalVariableCollectionsResult {
  collections: CollectionEntry[];
}

export interface GetVariableByIdResult {
  id: string;
  name: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  variableCollectionId: string;
  valuesByMode: Record<string, unknown>;
  description: string;
  scopes: string[];
}

export interface GetCollectionByIdResult {
  id: string;
  name: string;
  modes: ModeEntry[];
  defaultModeId: string;
  variableIds: string[];
}

export interface GetNodeVariablesResult {
  nodeId: string;
  boundVariables?: Record<string, unknown>;
  explicitVariableModes?: Record<string, string>;
}

// Styles
export interface GetStylesResult {
  colors: StyleEntry[];
  texts: StyleEntry[];
  effects: StyleEntry[];
  grids: StyleEntry[];
}

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
export interface SearchComponentsResult {
  totalCount: number;
  returned: number;
  offset: number;
  limit: number;
  components: Array<{
    id: string;
    name: string;
    type: "COMPONENT" | "COMPONENT_SET";
    variantCount?: number;
    description?: string;
    pageId?: string;
    pageName?: string;
  }>;
}

export interface GetComponentByIdResult {
  id: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  description?: string;
  parentId?: string;
  parentName?: string;
  propertyDefinitions?: Record<string, unknown>;
  variantGroupProperties?: Record<string, unknown>;
  variantProperties?: Record<string, string>;
  variantCount?: number;
  children?: NodeStub[];
}

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
  get_styles: {
    type: "object",
    properties: {
      colors: { type: "array", items: styleEntrySchema },
      texts: { type: "array", items: styleEntrySchema },
      effects: { type: "array", items: styleEntrySchema },
      grids: { type: "array", items: styleEntrySchema },
    },
    required: ["colors", "texts", "effects", "grids"],
    example: {
      colors: [{ id: "S:abc123,", name: "Primary/Blue" }],
      texts: [{ id: "S:def456,", name: "Heading/H1" }],
      effects: [{ id: "S:ghi789,", name: "Shadow/Large" }],
      grids: [],
    },
  },
  get_style_by_id: {
    type: "object",
    description: "Shape varies by style type (PAINT, TEXT, EFFECT)",
    properties: {
      id: stringProp,
      name: stringProp,
      type: { type: "string", enum: ["PAINT", "TEXT", "EFFECT"] },
      paints: { type: "array", description: "Paint details (PAINT type)" },
      fontSize: { ...numberProp, description: "Font size (TEXT type)" },
      fontName: { type: "object", description: "Font name (TEXT type)" },
      effects: { type: "array", description: "Effect details (EFFECT type)" },
    },
    required: ["id", "name", "type"],
    example: { id: "S:abc123,", name: "Primary/Blue", type: "PAINT", paints: [{ type: "SOLID", color: "#3b82f6", opacity: 1 }] },
  },
  remove_style: okSchema(),
  create_paint_style: batchSchema({ id: idProp }, {
    example: { results: [{ id: "S:abc123," }] },
  }),
  create_text_style: batchSchema({
    id: idProp,
  }, {
    example: { results: [{ id: "S:def456," }] },
  }),
  create_effect_style: batchSchema({ id: idProp }, {
    example: { results: [{ id: "S:ghi789," }] },
  }),
  apply_style_to_node: batchSchema({
    styleId: { ...stringProp, description: "Applied style ID" },
    matchedStyle: { ...stringProp, description: "Matched style name (when using styleName)" },
  }, {
    example: { results: [{ styleId: "S:abc123,", matchedStyle: "Primary/Blue" }] },
  }),
  patch_styles: okBatchSchema({ example: { results: ["ok"] } }),

  // ── Variables ──
  create_variable_collection: batchSchema({
    id: { ...stringProp, description: "Collection ID" },
    modes: { type: "array", items: modeEntrySchema },
    defaultModeId: stringProp,
  }, {
    example: { results: [{ id: "VariableCollectionId:1:0", modes: [{ modeId: "1:0", name: "Mode 1" }], defaultModeId: "1:0" }] },
  }),
  create_variable: batchSchema({ id: { ...stringProp, description: "Variable ID (e.g. VariableID:1:6)" } }, {
    example: { results: [{ id: "VariableID:1:6" }] },
  }),
  set_variable_value: okBatchSchema({ example: { results: ["ok"] } }),
  get_local_variables: {
    type: "object",
    properties: {
      variables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: stringProp,
            name: stringProp,
            resolvedType: { type: "string", enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"] },
            variableCollectionId: stringProp,
            valuesByMode: { type: "object", description: "Mode ID → value (only with includeValues: true)" },
          },
        },
      },
    },
    required: ["variables"],
    example: { variables: [{ id: "VariableID:1:6", name: "primary", resolvedType: "COLOR", variableCollectionId: "VariableCollectionId:1:0" }] },
  },
  get_local_variable_collections: {
    type: "object",
    properties: {
      collections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: stringProp, name: stringProp,
            modes: { type: "array", items: modeEntrySchema },
            defaultModeId: stringProp,
            variableIds: { type: "array", items: stringProp },
          },
        },
      },
    },
    required: ["collections"],
    example: { collections: [{ id: "VariableCollectionId:1:0", name: "Colors", modes: [{ modeId: "1:0", name: "Light" }, { modeId: "1:1", name: "Dark" }], defaultModeId: "1:0", variableIds: ["VariableID:1:6"] }] },
  },
  get_variable_by_id: {
    type: "object",
    properties: {
      id: stringProp, name: stringProp,
      resolvedType: { type: "string", enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"] },
      variableCollectionId: stringProp,
      valuesByMode: { type: "object", description: "Mode ID → value map" },
      description: stringProp,
      scopes: { type: "array", items: stringProp },
    },
    required: ["id", "name", "resolvedType", "variableCollectionId", "valuesByMode"],
    example: { id: "VariableID:1:6", name: "primary", resolvedType: "COLOR", variableCollectionId: "VariableCollectionId:1:0", valuesByMode: { "1:0": { r: 0.23, g: 0.51, b: 0.96, a: 1 } }, description: "Primary brand color", scopes: ["ALL_FILLS"] },
  },
  get_variable_collection_by_id: {
    type: "object",
    properties: {
      id: stringProp, name: stringProp,
      modes: { type: "array", items: modeEntrySchema },
      defaultModeId: stringProp,
      variableIds: { type: "array", items: stringProp },
    },
    required: ["id", "name", "modes", "defaultModeId", "variableIds"],
    example: { id: "VariableCollectionId:1:0", name: "Colors", modes: [{ modeId: "1:0", name: "Light" }], defaultModeId: "1:0", variableIds: ["VariableID:1:6", "VariableID:1:7"] },
  },
  set_variable_binding: okBatchSchema({ example: { results: ["ok"] } }),
  add_mode: batchSchema({
    modeId: { ...stringProp, description: "New mode ID" },
    modes: { type: "array", description: "All modes after addition", items: modeEntrySchema },
  }, {
    example: { results: [{ modeId: "1:2", modes: [{ modeId: "1:0", name: "Light" }, { modeId: "1:1", name: "Dark" }, { modeId: "1:2", name: "High Contrast" }] }] },
  }),
  rename_mode: batchSchema({
    modes: { type: "array", description: "All modes after rename", items: modeEntrySchema },
  }, {
    example: { results: [{ modes: [{ modeId: "1:0", name: "Day" }, { modeId: "1:1", name: "Night" }] }] },
  }),
  remove_mode: batchSchema({
    modes: { type: "array", description: "All modes after removal", items: modeEntrySchema },
  }, {
    example: { results: [{ modes: [{ modeId: "1:0", name: "Light" }] }] },
  }),
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
  delete_variable_collection: okSchema(),

  // ── Components ──
  create_component: batchSchema({
    id: idProp,
  }, {
    example: { results: [{ id: "20:1" }], warnings: ["Component has 1 text node — use add_component_property to expose text as editable properties on instances."] },
  }),
  create_component_from_node: batchSchema({
    id: idProp,
  }, {
    example: { results: [{ id: "20:2" }] },
  }),
  combine_as_variants: batchSchema({
    id: { ...stringProp, description: "Component set ID" },
  }, {
    example: { results: [{ id: "20:3" }] },
  }),
  add_component_property: okBatchSchema({ example: { results: ["ok"] } }),
  create_instance_from_local: batchSchema({ id: idProp }, {
    example: { results: [{ id: "21:1" }] },
  }),
  search_components: {
    type: "object",
    properties: {
      totalCount: numberProp,
      returned: numberProp,
      offset: numberProp,
      limit: numberProp,
      components: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: stringProp, name: stringProp,
            type: { type: "string", enum: ["COMPONENT", "COMPONENT_SET"] },
            variantCount: { ...numberProp, description: "Number of variants (COMPONENT_SET only)" },
            description: stringProp,
            pageId: stringProp,
            pageName: stringProp,
          },
        },
      },
    },
    required: ["totalCount", "returned", "offset", "limit", "components"],
    example: { totalCount: 2, returned: 2, offset: 0, limit: 100, components: [{ id: "20:3", name: "Button", type: "COMPONENT_SET", variantCount: 4, pageId: "0:1", pageName: "Components" }, { id: "20:10", name: "Icon/Star", type: "COMPONENT", pageId: "5:0", pageName: "Icons" }] },
  },
  get_component_by_id: {
    type: "object",
    description: "Shape varies for COMPONENT vs COMPONENT_SET",
    properties: {
      id: stringProp, name: stringProp,
      type: { type: "string", enum: ["COMPONENT", "COMPONENT_SET"] },
      description: stringProp,
      parentId: stringProp,
      parentName: stringProp,
      propertyDefinitions: { type: "object", description: "Component property definitions" },
      variantGroupProperties: { type: "object", description: "Variant axes (COMPONENT_SET)" },
      variantProperties: { type: "object", description: "This variant's property values (COMPONENT)" },
      variantCount: numberProp,
      children: { type: "array", items: nodeStubSchema },
    },
    required: ["id", "name", "type"],
    example: { id: "20:3", name: "Button", type: "COMPONENT_SET", variantCount: 4, variantGroupProperties: { Style: { values: ["Primary", "Secondary"] }, Size: { values: ["Small", "Large"] } }, propertyDefinitions: { "Label#1:0": { type: "TEXT", defaultValue: "Click me" } } },
  },
  get_instance_overrides: {
    type: "object",
    properties: {
      mainComponentId: stringProp,
      overrides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: stringProp,
            fields: { type: "array", items: stringProp },
          },
        },
      },
    },
    required: ["overrides"],
    example: { mainComponentId: "20:4", overrides: [{ id: "21:5", fields: ["characters", "fills"] }] },
  },
  set_instance_properties: okBatchSchema({ example: { results: ["ok"] } }),

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
  lint_fix_replace_shape_with_frame: batchSchema({
    id: { ...stringProp, description: "New frame node ID" },
    adoptedChildren: { type: "array", description: "IDs of re-parented siblings", items: stringProp },
  }, {
    example: { results: [{ id: "15:1", adoptedChildren: ["3:4", "3:5"] }] },
  }),
};
