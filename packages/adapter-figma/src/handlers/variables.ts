import { batchHandler, coerceColor, findVariableById, findVariableByName, type Hint } from "./helpers";
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

/** Resolve a variable collection by name. */
async function findCollectionByName(name: string): Promise<any> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find(c => c.name === name) ||
         all.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}

/** Get collection name by ID (cached per call via inline lookup). */
async function getCollectionName(collectionId: string): Promise<string> {
  const c = await findCollectionById(collectionId);
  return c?.name ?? collectionId;
}

/** Resolve variable IDs to names. */
async function resolveVariableNames(ids: string[]): Promise<string[]> {
  const names: string[] = [];
  for (const id of ids) {
    const v = await findVariableById(id);
    names.push(v?.name ?? id);
  }
  return names;
}

// -- Serializers --

async function serializeCollection(c: any): Promise<Record<string, any>> {
  return { id: c.id, name: c.name, modes: c.modes, defaultModeId: c.defaultModeId, variableNames: await resolveVariableNames(c.variableIds) };
}

async function serializeVariable(v: any): Promise<Record<string, any>> {
  return {
    name: v.name, resolvedType: v.resolvedType,
    collectionName: await getCollectionName(v.variableCollectionId),
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
  return await serializeCollection(c);
}

async function listCollectionsFigma(params: any) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const paged = paginate(collections, params.offset, params.limit);
  const fields = params.fields;
  const items: any[] = [];
  for (const c of paged.items) {
    const full = await serializeCollection(c);
    items.push(!fields?.length ? pickFields(full, []) : pickFields(full, fields));
  }
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

/**
 * Resolve a modeId that might be a mode name (e.g. "Dark") to the actual mode ID.
 * Agents don't know internal mode IDs — this lets them use human-readable names.
 */
async function resolveModeId(collection: any, modeIdOrName: string): Promise<string> {
  // Check if it's already a valid mode ID
  if (collection.modes.some((m: any) => m.modeId === modeIdOrName)) return modeIdOrName;
  // Try matching by name (case-insensitive)
  const byName = collection.modes.find((m: any) =>
    m.name === modeIdOrName || m.name.toLowerCase() === modeIdOrName.toLowerCase()
  );
  if (byName) return byName.modeId;
  const available = collection.modes.map((m: any) => `${m.name} (${m.modeId})`).join(", ");
  throw new Error(`Mode "${modeIdOrName}" not found in collection "${collection.name}". Available: ${available}`);
}

// -- variables handlers --

async function createVariableSingle(p: any) {
  const collection = await findCollectionByName(p.collectionName);
  if (!collection) throw new Error(`Collection not found: ${p.collectionName}`);
  const created = figma.variables.createVariable(p.name, collection, p.resolvedType);
  const id = created.id;
  // Re-fetch to ensure Figma has committed the variable before mutating
  const variable = await figma.variables.getVariableByIdAsync(id);
  if (!variable) throw new Error(`Failed to re-fetch created variable: ${p.name}`);
  if (p.description !== undefined) variable.description = p.description;
  // Set initial value BEFORE scopes — scope errors must not prevent value from being set
  const hints: Hint[] = [];
  if (p.value !== undefined) {
    const modeId = p.modeId ? await resolveModeId(collection, p.modeId) : collection.defaultModeId;
    let value = p.value;
    if (typeof value === "object" && value !== null && value.type === "VARIABLE_ALIAS") {
      const aliasVar = value.name
        ? await findVariableByName(value.name)
        : value.id ? await findVariableById(value.id) : null;
      if (!aliasVar) throw new Error(`Alias variable not found: ${value.name || value.id}`);
      value = await figma.variables.createVariableAliasByIdAsync(aliasVar.id);
    } else {
      const asColor = coerceColor(value);
      if (asColor) value = asColor;
    }
    variable.setValueForMode(modeId, value);
  }
  if (p.scopes !== undefined) {
    try { variable.scopes = p.scopes; }
    catch (e: any) { hints.push({ type: "error", message: `in set_scopes: ${e.message}` }); }
  }
  // Check for name collisions across collections — hint to use prefixed names
  const allVars = await figma.variables.getLocalVariablesAsync();
  const dupes = allVars.filter(v => v.name === p.name && v.variableCollectionId !== collection.id);
  if (dupes.length > 0) {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const colNames = dupes.map(v => collections.find(c => c.id === v.variableCollectionId)?.name || "?");
    hints.push({ type: "warn", message: `Name "${p.name}" also exists in collection(s): [${colNames.join(", ")}]. Use "${collection.name}/${p.name}" to disambiguate when referencing this variable.` });
  }
  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

async function getVariableFigma(params: any) {
  const v = await findVariableByName(params.name, params.collectionName);
  if (!v) throw new Error(`Variable not found: ${params.name}`);
  return serializeVariable(v);
}

async function listVariablesFigma(params: any) {
  let variables = params?.type
    ? await figma.variables.getLocalVariablesAsync(params.type)
    : await figma.variables.getLocalVariablesAsync();
  if (params?.collectionName) {
    const col = await findCollectionByName(params.collectionName);
    if (col) variables = variables.filter((v: any) => v.variableCollectionId === col.id);
    else variables = [];
  }
  const paged = paginate(variables, params.offset, params.limit);
  const fields = params.fields;
  const items: any[] = [];
  for (const v of paged.items) {
    const full = await serializeVariable(v);
    items.push(!fields?.length ? pickFields(full, []) : pickFields(full, fields));
  }
  return { ...paged, items };
}

async function updateVariableSingle(p: any) {
  const variable = await findVariableByName(p.name, p.collectionName);
  if (!variable) throw new Error(`Variable not found: ${p.name}`);
  // Metadata updates
  if (p.rename !== undefined) variable.name = p.rename;
  if (p.description !== undefined) variable.description = p.description;
  if (p.scopes !== undefined) variable.scopes = p.scopes;
  // Value update — falls back to collection's default modeId when omitted
  // modeId accepts both IDs ("2:3") and names ("Dark") for agent convenience
  if (p.value !== undefined) {
    const collection = await findCollectionById(variable.variableCollectionId);
    if (!collection) throw new Error(`Collection not found for variable: ${p.name}`);
    const modeId = p.modeId ? await resolveModeId(collection, p.modeId) : collection.defaultModeId;
    let value = p.value;
    if (typeof value === "object" && value !== null && value.type === "VARIABLE_ALIAS") {
      const aliasVar = value.name
        ? await findVariableByName(value.name)
        : value.id ? await findVariableById(value.id) : null;
      if (!aliasVar) throw new Error(`Alias variable not found: ${value.name || value.id}`);
      value = await figma.variables.createVariableAliasByIdAsync(aliasVar.id);
    } else {
      const asColor = coerceColor(value);
      if (asColor) value = asColor;
    }
    variable.setValueForMode(modeId, value);
  }
  return {};
}

async function deleteVariableSingle(p: any) {
  const variable = await findVariableByName(p.name, p.collectionName);
  if (!variable) throw new Error(`Variable not found: ${p.name}`);
  variable.remove();
  return {};
}

async function renameCollectionSingle(p: any) {
  const c = await findCollectionById(p.id);
  if (!c) throw new Error(`Collection not found: ${p.id}`);
  if (p.name !== undefined) c.name = p.name;
  return {};
}

// -- Standalone handlers --

async function setBindingSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  const variable = p.variableName
    ? await findVariableByName(p.variableName)
    : await findVariableById(p.variableId);
  if (!variable) throw new Error(`Variable not found: ${p.variableName || p.variableId}`);

  const paintMatch = p.field.match(/^(fills|strokes)\/(\d+)\/color$/);
  if (paintMatch) {
    const prop = paintMatch[1];
    const index = parseInt(paintMatch[2], 10);
    if (!(prop in node)) throw new Error(`Node does not have ${prop}`);
    const paints = (node as any)[prop].slice();
    // Auto-create default solid paints if index doesn't exist yet
    while (index >= paints.length) {
      paints.push({ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 });
    }
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
          const resolved = [];
          for (const v of val) {
            if (v?.id) {
              const variable = await findVariableById(v.id);
              resolved.push({ variableName: variable?.name ?? v.id, field: v.field });
            } else {
              resolved.push(v);
            }
          }
          bindings[key] = resolved;
        } else if (val && typeof val === "object" && (val as any).id) {
          const variable = await findVariableById((val as any).id);
          bindings[key] = { variableName: variable?.name ?? (val as any).id, field: (val as any).field };
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
    update: (p) => batchHandler(p, renameCollectionSingle),
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
    delete: (p) => batchHandler(p, deleteVariableSingle),
  }),
  set_variable_binding: (p) => batchHandler(p, setBindingSingle),
  set_explicit_variable_mode: (p) => batchHandler(p, setExplicitModeSingle),
  get_node_variables: getNodeVariablesFigma,
};
