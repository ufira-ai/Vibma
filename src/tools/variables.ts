import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler, findVariableById } from "./helpers";
import { endpointSchema, createDispatcher, paginate, pickFields } from "./endpoint";
import type { CollectionCreatedResult, IdResult, GetNodeVariablesResult } from "./response-types";


// ─── Schemas: variable_collections ──────────────────────────────

const collectionCreateItem = z.object({
  name: z.string().describe("Collection name"),
});

const addModeItem = z.object({
  collectionId: z.string().describe("Collection ID"),
  name: z.string().describe("Mode name"),
});

const renameModeItem = z.object({
  collectionId: z.string().describe("Collection ID"),
  modeId: z.string().describe("Mode ID"),
  name: z.string().describe("New name"),
});

const removeModeItem = z.object({
  collectionId: z.string().describe("Collection ID"),
  modeId: z.string().describe("Mode ID"),
});

const deleteCollectionItem = z.object({
  id: z.string().describe("Collection ID"),
});

// Schema map for per-method item validation
const collectionMethodSchemas: Record<string, z.ZodTypeAny> = {
  create: collectionCreateItem,
  delete: deleteCollectionItem,
  add_mode: addModeItem,
  rename_mode: renameModeItem,
  remove_mode: removeModeItem,
};

// ─── Schemas: variables ─────────────────────────────────────────

const variableCreateItem = z.object({
  collectionId: z.string().describe("Variable collection ID"),
  name: z.string().describe("Variable name"),
  resolvedType: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).describe("Variable type"),
});

const variableUpdateItem = z.object({
  id: z.string().describe("Variable ID (full ID, e.g. VariableID:1:6)"),
  modeId: z.string().describe("Mode ID"),
  value: flexJson(z.union([
    z.number(), z.boolean(), S.colorRgba,
  ])).describe('Value: number, boolean, or color (hex "#RRGGBB" or {r,g,b,a?} 0-1)'),
});

const variableMethodSchemas: Record<string, z.ZodTypeAny> = {
  create: variableCreateItem,
  update: variableUpdateItem,
};

// ─── Schemas: standalone tools ──────────────────────────────────

const bindingItem = z.object({
  nodeId: z.string().describe("Node ID"),
  field: z.string().describe("Property field (e.g., 'opacity', 'fills/0/color')"),
  variableId: z.string().describe("Variable ID (use full ID from create_variable response, e.g. VariableID:1:6)"),
});

const setExplicitModeItem = z.object({
  nodeId: S.nodeId,
  collectionId: z.string().describe("Variable collection ID"),
  modeId: z.string().describe("Mode ID to pin (e.g. Dark mode)"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {

  // ── variable_collections endpoint ──

  const vcMethods = ["create", "get", "list", "delete", "add_mode", "rename_mode", "remove_mode"];
  const vcSchema = endpointSchema(vcMethods, {
    items: flexJson(z.array(z.any())).optional()
      .describe("create: [{name}]. delete (batch): [{id}]. add_mode: [{collectionId, name}]. rename_mode: [{collectionId, modeId, name}]. remove_mode: [{collectionId, modeId}]."),
  });

  server.tool(
    "variable_collections",
    `CRUD endpoint for variable collections + mode management.
  create       → {items: [{name}]}                          → {results: [{id, modes, defaultModeId}]}
  get          → {id, fields?}                              → collection object
  list         → {fields?, offset?, limit?}                 → paginated stubs
  delete       → {id} or {items: [{id}]}                    → 'ok' or {results: ['ok', ...]}
  add_mode     → {items: [{collectionId, name}]}            → {results: [{modeId}]}
  rename_mode  → {items: [{collectionId, modeId, name}]}    → {results: ['ok', ...]}
  remove_mode  → {items: [{collectionId, modeId}]}          → {results: ['ok', ...]}`,
    vcSchema,
    async (params: any) => {
      try {
        // Validate items per method
        if (params.items) {
          const schema = collectionMethodSchemas[params.method];
          if (schema) params.items = z.array(schema).parse(params.items);
        }
        return mcpJson(await sendCommand("variable_collections", params));
      } catch (e) { return mcpError("variable_collections error", e); }
    }
  );

  // ── variables endpoint ──

  const vMethods = ["create", "get", "list", "update"];
  const vSchema = endpointSchema(vMethods, {
    items: flexJson(z.array(z.any())).optional()
      .describe("create: [{collectionId, name, resolvedType}]. update: [{id, modeId, value}]."),
    type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional()
      .describe("Filter list by variable type."),
    collectionId: z.string().optional()
      .describe("Filter list by collection ID."),
  });

  server.tool(
    "variables",
    `CRUD endpoint for design variables.
  create  → {items: [{collectionId, name, resolvedType}]}   → {results: [{id}]}
  get     → {id, fields?}                                   → variable object (full detail)
  list    → {type?, collectionId?, fields?, offset?, limit?} → paginated stubs (fields for detail)
  update  → {items: [{id, modeId, value}]}                  → {results: ['ok', ...]}`,
    vSchema,
    async (params: any) => {
      try {
        // Validate items per method
        if (params.items) {
          const schema = variableMethodSchemas[params.method];
          if (schema) params.items = z.array(schema).parse(params.items);
        }
        return mcpJson(await sendCommand("variables", params));
      } catch (e) { return mcpError("variables error", e); }
    }
  );

  // ── Standalone tools ──

  server.tool(
    "set_variable_binding",
    "Bind variables to node properties. Common fields: 'fills/0/color', 'strokes/0/color', 'opacity', 'topLeftRadius', 'itemSpacing'. Batch: pass multiple items.",
    { items: flexJson(z.array(bindingItem)).describe("Array of {nodeId, field, variableId}") },
    async ({ items }: any) => {
      try { return mcpJson(await sendCommand("set_variable_binding", { items })); }
      catch (e) { return mcpError("Error binding variable", e); }
    }
  );

  server.tool(
    "set_explicit_variable_mode",
    "Pin a variable collection mode on a frame (e.g. show Dark mode). Batch: pass multiple items.",
    { items: flexJson(z.array(setExplicitModeItem)).describe("Array of {nodeId, collectionId, modeId}") },
    async ({ items }: any) => {
      try { return mcpJson(await sendCommand("set_explicit_variable_mode", { items })); }
      catch (e) { return mcpError("Error setting variable mode", e); }
    }
  );

  server.tool(
    "get_node_variables",
    "Get variable bindings on a node. Returns which variables are bound to fills, strokes, opacity, corner radius, etc.",
    { nodeId: S.nodeId },
    async ({ nodeId }: any) => {
      try { return mcpJson(await sendCommand("get_node_variables", { nodeId })); }
      catch (e) { return mcpError("Error getting node variables", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

/** Resolve a variable collection by ID with scan fallback.
 *  Direct lookup can fail for recently-created collections. */
async function findCollectionById(id: string): Promise<any> {
  const direct = await figma.variables.getVariableCollectionByIdAsync(id);
  if (direct) return direct;
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find(c => c.id === id) || null;
}

// ── Serializers ──

function serializeCollection(c: any): Record<string, any> {
  return { id: c.id, name: c.name, modes: c.modes, defaultModeId: c.defaultModeId, variableIds: c.variableIds };
}

function serializeVariable(v: any): Record<string, any> {
  return {
    id: v.id, name: v.name, resolvedType: v.resolvedType,
    variableCollectionId: v.variableCollectionId,
    valuesByMode: v.valuesByMode, description: v.description, scopes: v.scopes,
  };
}

// ── variable_collections handlers ──

async function createCollectionSingle(p: any): Promise<CollectionCreatedResult> {
  const collection = figma.variables.createVariableCollection(p.name);
  return { id: collection.id, modes: collection.modes, defaultModeId: collection.defaultModeId };
}

async function getCollectionFigma(params: any) {
  const c = await findCollectionById(params.id);
  if (!c) throw new Error(`Collection not found: ${params.id}`);
  return serializeCollection(c);
}

async function listCollectionsFigma(params: any) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const paged = paginate(collections, params.offset, params.limit);
  const fields = params.fields;
  const items = paged.items.map((c: any) => {
    const full = serializeCollection(c);
    if (!fields?.length) return pickFields(full, []); // stubs: id, name
    return pickFields(full, fields);
  });
  return { ...paged, items };
}

async function deleteCollectionSingle(p: any) {
  const c = await findCollectionById(p.id);
  if (!c) throw new Error(`Collection not found: ${p.id}`);
  c.remove();
  return {};
}

async function addModeSingle(p: any): Promise<{ modeId: string }> {
  const c = await findCollectionById(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  const modeId = c.addMode(p.name);
  return { modeId };
}

async function renameModeSingle(p: any): Promise<Record<string, never>> {
  const c = await findCollectionById(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  c.renameMode(p.modeId, p.name);
  return {};
}

async function removeModeSingle(p: any): Promise<Record<string, never>> {
  const c = await findCollectionById(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  c.removeMode(p.modeId);
  return {};
}

// ── variables handlers ──

async function createVariableSingle(p: any): Promise<IdResult> {
  const collection = await findCollectionById(p.collectionId);
  if (!collection) throw new Error(`Collection not found: ${p.collectionId}`);
  const variable = figma.variables.createVariable(p.name, collection, p.resolvedType);
  return { id: variable.id };
}

async function getVariableFigma(params: any) {
  const v = await findVariableById(params.id);
  if (!v) throw new Error(`Variable not found: ${params.id}`);
  return serializeVariable(v);
}

async function listVariablesFigma(params: any) {
  let variables = params?.type
    ? await figma.variables.getLocalVariablesAsync(params.type)
    : await figma.variables.getLocalVariablesAsync();
  if (params?.collectionId) variables = variables.filter((v: any) => v.variableCollectionId === params.collectionId);
  const paged = paginate(variables, params.offset, params.limit);
  const fields = params.fields;
  const items = paged.items.map((v: any) => {
    const full = serializeVariable(v);
    if (!fields?.length) return pickFields(full, []); // stubs: id, name, resolvedType, variableCollectionId (identity)
    return pickFields(full, fields);
  });
  return { ...paged, items };
}

async function updateVariableSingle(p: any) {
  const variable = await findVariableById(p.id);
  if (!variable) throw new Error(`Variable not found: ${p.id}`);
  let value = p.value;
  if (typeof value === "object" && value !== null && "r" in value) {
    value = { r: value.r, g: value.g, b: value.b, a: value.a ?? 1 };
  }
  variable.setValueForMode(p.modeId, value);
  return {};
}

// ── Standalone handlers ──

async function setBindingSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  const variable = await findVariableById(p.variableId);
  if (!variable) throw new Error(`Variable not found: ${p.variableId}`);

  const paintMatch = p.field.match(/^(fills|strokes)\/(\d+)\/color$/);
  if (paintMatch) {
    const prop = paintMatch[1];
    const index = parseInt(paintMatch[2], 10);
    if (!(prop in node)) throw new Error(`Node does not have ${prop}`);
    const paints = (node as any)[prop].slice();
    if (index >= paints.length) throw new Error(`${prop} index ${index} out of range`);
    const newPaint = figma.variables.setBoundVariableForPaint(paints[index], "color", variable);
    paints[index] = newPaint;
    (node as any)[prop] = paints;
  } else if ("setBoundVariable" in node) {
    (node as any).setBoundVariable(p.field, variable);
  } else {
    throw new Error("Node does not support variable binding");
  }
  return {};
}

async function setExplicitModeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("setExplicitVariableModeForCollection" in node)) throw new Error(`Node ${p.nodeId} (${node.type}) does not support explicit variable modes. Use a FRAME, COMPONENT, or COMPONENT_SET.`);
  const collection = await findCollectionById(p.collectionId);
  if (!collection) throw new Error(`Collection not found: ${p.collectionId}`);
  try {
    (node as any).setExplicitVariableModeForCollection(collection, p.modeId);
  } catch (e: any) {
    throw new Error(`Failed to set mode '${p.modeId}' on node ${p.nodeId}: ${e.message}. Ensure the modeId is valid for collection '${collection.name}'.`);
  }
  return {};
}

async function getNodeVariablesFigma(params: any): Promise<GetNodeVariablesResult> {
  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  const result: any = { nodeId: params.nodeId };
  if ("boundVariables" in node) {
    const bv = (node as any).boundVariables;
    if (bv && typeof bv === "object") {
      const bindings: Record<string, any> = {};
      for (const [key, val] of Object.entries(bv)) {
        if (Array.isArray(val)) {
          bindings[key] = val.map((v: any) => v?.id ? { variableId: v.id, field: v.field } : v);
        } else if (val && typeof val === "object" && (val as any).id) {
          bindings[key] = { variableId: (val as any).id, field: (val as any).field };
        }
      }
      result.boundVariables = bindings;
    }
  }
  if ("explicitVariableModes" in node) {
    result.explicitVariableModes = (node as any).explicitVariableModes;
  }
  return result;
}

// ─── Handler Exports ─────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  variable_collections: createDispatcher({
    create: (p) => batchHandler(p, createCollectionSingle),
    get: getCollectionFigma,
    list: listCollectionsFigma,
    delete: (p) => batchHandler(p, deleteCollectionSingle),
    add_mode: (p) => batchHandler(p, addModeSingle),
    rename_mode: (p) => batchHandler(p, renameModeSingle),
    remove_mode: (p) => batchHandler(p, removeModeSingle),
  }),
  variables: createDispatcher({
    create: (p) => batchHandler(p, createVariableSingle),
    get: getVariableFigma,
    list: listVariablesFigma,
    update: (p) => batchHandler(p, updateVariableSingle),
  }),
  set_variable_binding: (p) => batchHandler(p, setBindingSingle),
  set_explicit_variable_mode: (p) => batchHandler(p, setExplicitModeSingle),
  get_node_variables: getNodeVariablesFigma,
};
