import { batchHandler, coerceColor, findVariableById, findVariableByName, type Hint } from "./helpers";
import { rgbaToHex } from "@ufira/vibma/utils/color";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";
import {
  variablesCreate, variablesUpdate, variablesDelete,
  variableCollectionsCreate, variableCollectionsUpdate, variableCollectionsDelete,
  variableCollectionsAddMode, variableCollectionsRenameMode, variableCollectionsRemoveMode,
} from "@ufira/vibma/guards";

// ─── Figma Handlers ──────────────────────────────────────────────

/** Resolve a variable collection by ID or name.
 *  Tries ID first (fast path), then falls back to name match (case-insensitive). */
async function findCollection(idOrName: string | undefined): Promise<any> {
  if (!idOrName) return null;
  // Try direct ID lookup first
  const direct = await figma.variables.getVariableCollectionByIdAsync(idOrName);
  if (direct) return direct;
  // Fallback: scan all collections by ID, then by name
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  return all.find(c => c.id === idOrName) ||
         all.find(c => c.name === idOrName) ||
         all.find(c => c.name.toLowerCase() === idOrName.toLowerCase()) || null;
}

/** Get collection name by ID (cached per call via inline lookup). */
async function getCollectionName(collectionId: string): Promise<string> {
  const c = await findCollection(collectionId);
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
  const col = await findCollection(v.variableCollectionId);
  // Resolve mode IDs to names so valuesByMode keys are human-readable (e.g. "Light"/"Dark")
  const modeMap = new Map<string, string>(
    (col?.modes ?? []).map((m: any) => [m.modeId, m.name])
  );
  const valuesByMode: Record<string, any> = {};
  for (const [modeId, rawValue] of Object.entries(v.valuesByMode as Record<string, any>)) {
    let value = rawValue;
    // Resolve alias IDs to names
    if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS" && value.id) {
      const aliasVar = await findVariableById(value.id);
      value = { type: "VARIABLE_ALIAS", name: aliasVar?.name ?? value.id };
    }
    // Coerce COLOR {r,g,b,a} to hex
    if (value && typeof value === "object" && !value.type && "r" in value) {
      value = rgbaToHex(value);
    }
    valuesByMode[modeMap.get(modeId) ?? modeId] = value;
  }
  return {
    name: v.name, resolvedType: v.resolvedType,
    collectionId: col?.name ?? v.variableCollectionId,
    valuesByMode, description: v.description, scopes: v.scopes,
  };
}

// -- variable_collections handlers --

async function createCollectionSingle(p: any) {
  const collection = figma.variables.createVariableCollection(p.name);
  return { id: collection.id, modes: collection.modes, defaultModeId: collection.defaultModeId };
}

async function getCollectionFigma(params: any) {
  const c = await findCollection(params.id);
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
  const c = await findCollection(p.id);
  if (!c) throw new Error(`Collection not found: ${p.id}`);
  c.remove();
  return {};
}

async function addModeSingle(p: any): Promise<{ modeId: string }> {
  const c = await findCollection(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  const modeId = c.addMode(p.name);
  return { modeId };
}

async function renameModeSingle(p: any): Promise<Record<string, never>> {
  const c = await findCollection(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  const modeId = await resolveModeId(c, p.modeId);
  c.renameMode(modeId, p.name);
  return {};
}

async function removeModeSingle(p: any): Promise<Record<string, never>> {
  const c = await findCollection(p.collectionId);
  if (!c) throw new Error(`Collection not found: ${p.collectionId}`);
  const modeId = await resolveModeId(c, p.modeId);
  c.removeMode(modeId);
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
  const collection = await findCollection(p.collectionId);
  if (!collection) throw new Error(`Collection not found: ${p.collectionId}. Pass the collection's ID or display name.`);
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
  const result: any = { name: variable.name };
  if (hints.length > 0) result.hints = hints;
  return result;
}

async function getVariableFigma(params: any) {
  // collectionId accepts both IDs and names — resolve to name for findVariableByName
  let collectionName: string | undefined;
  if (params.collectionId) {
    const col = await findCollection(params.collectionId);
    collectionName = col?.name;
  }
  const v = await findVariableByName(params.name, collectionName);
  if (!v) throw new Error(`Variable not found: ${params.name}`);
  return serializeVariable(v);
}

async function listVariablesFigma(params: any) {
  let variables = params?.type
    ? await figma.variables.getLocalVariablesAsync(params.type)
    : await figma.variables.getLocalVariablesAsync();
  if (params?.collectionId) {
    const col = await findCollection(params.collectionId);
    if (col) variables = variables.filter((v: any) => v.variableCollectionId === col.id);
    else variables = [];
  }
  const paged = paginate(variables, params.offset, params.limit);
  const fields = params.fields;
  const items: any[] = [];
  for (const v of paged.items) {
    const full = await serializeVariable(v);
    items.push(!fields?.length ? pickFields(full, ["resolvedType", "collectionId", "scopes"]) : pickFields(full, fields));
  }
  return { ...paged, items };
}

async function updateVariableSingle(p: any) {
  let collectionName: string | undefined;
  if (p.collectionId) {
    const col = await findCollection(p.collectionId);
    collectionName = col?.name;
  }
  const variable = await findVariableByName(p.name, collectionName);
  if (!variable) throw new Error(`Variable not found: ${p.name}`);
  // Metadata updates
  if (p.rename !== undefined) variable.name = p.rename;
  if (p.description !== undefined) variable.description = p.description;
  if (p.scopes !== undefined) variable.scopes = p.scopes;
  // Value update — falls back to collection's default modeId when omitted
  // modeId accepts both IDs ("2:3") and names ("Dark") for agent convenience
  if (p.value !== undefined) {
    const collection = await findCollection(variable.variableCollectionId);
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
  let collectionName: string | undefined;
  if (p.collectionId) {
    const col = await findCollection(p.collectionId);
    collectionName = col?.name;
  }
  const variable = await findVariableByName(p.name, collectionName);
  if (!variable) throw new Error(`Variable not found: ${p.name}`);
  variable.remove();
  return {};
}

async function renameCollectionSingle(p: any) {
  const c = await findCollection(p.id);
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
  const collection = await findCollection(p.collectionId);
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
    create: (p) => batchHandler(p, createCollectionSingle, { keys: variableCollectionsCreate, help: 'variable_collections(method: "help", topic: "create")' }),
    get: getCollectionFigma,
    list: listCollectionsFigma,
    update: (p) => batchHandler(p, renameCollectionSingle, { keys: variableCollectionsUpdate, help: 'variable_collections(method: "help", topic: "update")' }),
    delete: (p) => batchHandler(p, deleteCollectionSingle, { keys: variableCollectionsDelete, help: 'variable_collections(method: "help", topic: "delete")' }),
    add_mode: (p) => batchHandler(p, addModeSingle, { keys: variableCollectionsAddMode, help: 'variable_collections(method: "help", topic: "add_mode")' }),
    rename_mode: (p) => batchHandler(p, renameModeSingle, { keys: variableCollectionsRenameMode, help: 'variable_collections(method: "help", topic: "rename_mode")' }),
    remove_mode: (p) => batchHandler(p, removeModeSingle, { keys: variableCollectionsRemoveMode, help: 'variable_collections(method: "help", topic: "remove_mode")' }),
  }),
  variables: createDispatcher({
    create: (p) => batchHandler(p, createVariableSingle, { keys: variablesCreate, help: 'variables(method: "help", topic: "create")' }),
    get: getVariableFigma,
    list: listVariablesFigma,
    update: (p) => batchHandler(p, updateVariableSingle, { keys: variablesUpdate, help: 'variables(method: "help", topic: "update")' }),
    delete: (p) => batchHandler(p, deleteVariableSingle, { keys: variablesDelete, help: 'variables(method: "help", topic: "delete")' }),
  }),
  set_variable_binding: (p) => batchHandler(p, setBindingSingle),
  set_explicit_variable_mode: (p) => batchHandler(p, setExplicitModeSingle),
  get_node_variables: getNodeVariablesFigma,
};
