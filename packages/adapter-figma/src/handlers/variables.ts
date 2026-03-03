import { batchHandler, findVariableById } from "./helpers";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";

// ─── Figma Handlers ──────────────────────────────────────────────

/** Resolve a variable collection by ID with scan fallback.
 *  Direct lookup can fail for recently-created collections. */
async function findCollectionById(id: string): Promise<any> {
  const direct = await figma.variables.getVariableCollectionByIdAsync(id);
  if (direct) return direct;
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find(c => c.id === id) || null;
}

// -- Serializers --

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

// -- variable_collections handlers --

async function createCollectionSingle(p: any) {
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

// -- variables handlers --

async function createVariableSingle(p: any) {
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

// -- Standalone handlers --

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

async function getNodeVariablesFigma(params: any) {
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
