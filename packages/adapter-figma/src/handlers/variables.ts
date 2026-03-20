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

/**
 * Resolve a modeId that might be a mode name (e.g. "Dark") to the actual mode ID.
 * Agents don't know internal mode IDs — this lets them use human-readable names.
 */
async function resolveModeId(collection: any, modeIdOrName: string): Promise<string> {
  if (collection.modes.some((m: any) => m.modeId === modeIdOrName)) return modeIdOrName;
  const byName = collection.modes.find((m: any) =>
    m.name === modeIdOrName || m.name.toLowerCase() === modeIdOrName.toLowerCase()
  );
  if (byName) return byName.modeId;
  const available = collection.modes.map((m: any) => `${m.name} (${m.modeId})`).join(", ");
  throw new Error(`Mode "${modeIdOrName}" not found in collection "${collection.name}". Available: ${available}`);
}

/** Coerce a value for setValueForMode — handles hex colors and aliases. */
async function coerceVariableValue(value: any): Promise<any> {
  if (typeof value === "object" && value !== null && value.type === "VARIABLE_ALIAS") {
    const aliasVar = value.name
      ? await findVariableByName(value.name)
      : value.id ? await findVariableById(value.id) : null;
    if (!aliasVar) throw new Error(`Alias variable not found: ${value.name || value.id}`);
    return await figma.variables.createVariableAliasByIdAsync(aliasVar.id);
  }
  const asColor = coerceColor(value);
  return asColor ?? value;
}

// -- Serializers --

/** Serialize a variable to the standard response shape. */
async function serializeVariable(v: any): Promise<Record<string, any>> {
  const col = await findCollection(v.variableCollectionId);
  const modeMap = new Map<string, string>(
    (col?.modes ?? []).map((m: any) => [m.modeId, m.name])
  );
  const valuesByMode: Record<string, any> = {};
  for (const [modeId, rawValue] of Object.entries(v.valuesByMode as Record<string, any>)) {
    let value = rawValue;
    if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS" && value.id) {
      const aliasVar = await findVariableById(value.id);
      value = { type: "VARIABLE_ALIAS", name: aliasVar?.name ?? value.id };
    }
    if (value && typeof value === "object" && !value.type && "r" in value) {
      value = rgbaToHex(value);
    }
    valuesByMode[modeMap.get(modeId) ?? modeId] = value;
  }
  const result: Record<string, any> = {
    name: v.name, type: v.resolvedType,
    valuesByMode, scopes: v.scopes,
  };
  if (v.description) result.description = v.description;
  return result;
}

/** Serialize a collection as a full document (with all variables). */
async function serializeCollectionFull(c: any): Promise<Record<string, any>> {
  const modes = c.modes.map((m: any) => m.name);
  const allVars = await figma.variables.getLocalVariablesAsync();
  const colVars = allVars.filter((v: any) => v.variableCollectionId === c.id);
  const variables: any[] = [];
  for (const v of colVars) {
    variables.push(await serializeVariable(v));
  }
  return { id: c.id, name: c.name, modes, variables };
}

/** Serialize a collection as a list stub. */
function serializeCollectionStub(c: any, varCount: number): Record<string, any> {
  return {
    id: c.id,
    name: c.name,
    modes: c.modes.map((m: any) => m.name),
    variableCount: varCount,
  };
}

// -- variable_collections handlers --

async function createCollectionSingle(p: any) {
  const collection = figma.variables.createVariableCollection(p.name);
  const hints: Hint[] = [];

  // Setup modes: rename default mode + add extras
  if (p.modes?.length) {
    // Rename the auto-created default mode to the first name
    collection.renameMode(collection.defaultModeId, p.modes[0]);
    // Add remaining modes
    for (let i = 1; i < p.modes.length; i++) {
      collection.addMode(p.modes[i]);
    }
  }

  // Create inline variables
  if (p.variables?.length) {
    // Build mode name → ID map after all modes are created
    const modeMap = new Map<string, string>(
      collection.modes.map((m: any) => [m.name, m.modeId])
    );

    for (const vDef of p.variables) {
      // Accept "type" (new) or "resolvedType" (legacy)
      const resolvedType = vDef.type || vDef.resolvedType;
      if (!vDef.name || !resolvedType) {
        hints.push({ type: "error", message: `Variable missing name or type: ${JSON.stringify(vDef)}` });
        continue;
      }

      let variable;
      try {
        variable = figma.variables.createVariable(vDef.name, collection, resolvedType);
      } catch (e: any) {
        hints.push({ type: "error", message: `Failed to create variable "${vDef.name}": ${e.message}` });
        continue;
      }

      // Re-fetch to ensure Figma has committed the variable
      const refetched = await figma.variables.getVariableByIdAsync(variable.id);
      if (!refetched) {
        hints.push({ type: "error", message: `Failed to re-fetch created variable: ${vDef.name}` });
        continue;
      }

      if (vDef.description !== undefined) refetched.description = vDef.description;

      // Set values: valuesByMode takes precedence, value is shorthand for default mode
      const valuesToSet: Record<string, any> = {};
      if (vDef.valuesByMode && typeof vDef.valuesByMode === "object") {
        Object.assign(valuesToSet, vDef.valuesByMode);
      } else if (vDef.value !== undefined) {
        // Find the first mode name (default mode)
        const defaultModeName = collection.modes[0]?.name;
        if (defaultModeName) valuesToSet[defaultModeName] = vDef.value;
      }

      for (const [modeName, rawValue] of Object.entries(valuesToSet)) {
        const modeId = modeMap.get(modeName);
        if (!modeId) {
          hints.push({ type: "error", message: `Mode "${modeName}" not found for variable "${vDef.name}". Available: [${[...modeMap.keys()].join(", ")}]` });
          continue;
        }
        try {
          const coerced = await coerceVariableValue(rawValue);
          refetched.setValueForMode(modeId, coerced);
        } catch (e: any) {
          hints.push({ type: "error", message: `Failed to set "${vDef.name}" for mode "${modeName}": ${e.message}` });
        }
      }

      if (vDef.scopes !== undefined) {
        try { refetched.scopes = vDef.scopes; }
        catch (e: any) { hints.push({ type: "error", message: `in set_scopes for "${vDef.name}": ${e.message}` }); }
      }
    }
  }

  const result: any = { id: collection.id };
  if (hints.length > 0) result.hints = hints;
  return result;
}

async function getCollectionFigma(params: any) {
  const c = await findCollection(params.id);
  if (!c) throw new Error(`Collection not found: ${params.id}`);
  return await serializeCollectionFull(c);
}

async function listCollectionsFigma(params: any) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();
  const paged = paginate(collections, params.offset, params.limit);
  const fields = params.fields;
  const items: any[] = [];
  for (const c of paged.items) {
    const varCount = allVars.filter((v: any) => v.variableCollectionId === c.id).length;
    const stub = serializeCollectionStub(c, varCount);
    items.push(!fields?.length ? stub : pickFields(stub, fields));
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

async function renameCollectionSingle(p: any) {
  const c = await findCollection(p.id);
  if (!c) throw new Error(`Collection not found: ${p.id}`);
  if (p.name !== undefined) c.name = p.name;
  return {};
}

// -- variables handlers --

/** Resolve collection from params — required on all variable methods. */
async function requireCollection(p: any): Promise<any> {
  const id = p.collectionId;
  if (!id) throw new Error("collectionId is required. Pass the collection name or ID.");
  const c = await findCollection(id);
  if (!c) throw new Error(`Collection not found: ${id}`);
  return c;
}

async function createVariableSingle(p: any, collection: any) {
  const resolvedType = p.type || p.resolvedType;
  if (!resolvedType) throw new Error(`Variable "${p.name}" missing type.`);

  let created;
  try {
    created = figma.variables.createVariable(p.name, collection, resolvedType);
  } catch (e: any) {
    if (e.message?.includes("duplicate") || e.message?.includes("already exists")) {
      throw new Error(`Variable "${p.name}" already exists in collection "${collection.name}". Use variables(method: "update") to change values.`);
    }
    throw e;
  }

  const variable = await figma.variables.getVariableByIdAsync(created.id);
  if (!variable) throw new Error(`Failed to re-fetch created variable: ${p.name}`);

  if (p.description !== undefined) variable.description = p.description;

  const hints: Hint[] = [];

  // Set values: valuesByMode takes precedence, value is shorthand for default mode
  const valuesToSet: Record<string, any> = {};
  if (p.valuesByMode && typeof p.valuesByMode === "object") {
    Object.assign(valuesToSet, p.valuesByMode);
  } else if (p.value !== undefined) {
    const defaultModeName = collection.modes[0]?.name;
    if (defaultModeName) valuesToSet[defaultModeName] = p.value;
  }

  const modeMap = new Map<string, string>(
    collection.modes.map((m: any) => [m.name, m.modeId])
  );
  for (const [modeName, rawValue] of Object.entries(valuesToSet)) {
    const modeId = modeMap.get(modeName) ?? await resolveModeId(collection, modeName).catch(() => null as any);
    if (!modeId) {
      hints.push({ type: "error", message: `Mode "${modeName}" not found. Available: [${[...modeMap.keys()].join(", ")}]` });
      continue;
    }
    const coerced = await coerceVariableValue(rawValue);
    variable.setValueForMode(modeId, coerced);
  }

  if (p.scopes !== undefined) {
    try { variable.scopes = p.scopes; }
    catch (e: any) { hints.push({ type: "error", message: `in set_scopes: ${e.message}` }); }
  }

  // Echo back resolved values so the agent sees what was actually set per mode
  const resolvedValues: Record<string, any> = {};
  for (const mode of collection.modes) {
    const val = variable.valuesByMode[mode.modeId];
    if (val && typeof val === "object" && "r" in val) {
      resolvedValues[mode.name] = rgbaToHex(val);
    } else if (val !== undefined) {
      resolvedValues[mode.name] = val;
    }
  }

  // Warn if an existing variable in the same collection already has the same color value.
  // Suggests binding to the existing variable as an alias instead of duplicating.
  if (resolvedType === "COLOR") {
    const existing = await figma.variables.getLocalVariablesAsync("COLOR");
    const siblings = existing.filter(v => v.variableCollectionId === collection.id && v.id !== variable.id);
    for (const mode of collection.modes) {
      const newVal = variable.valuesByMode[mode.modeId];
      if (!newVal || typeof newVal !== "object" || !("r" in newVal)) continue;
      const newHex = rgbaToHex(newVal);
      for (const sib of siblings) {
        const sibVal = sib.valuesByMode[mode.modeId];
        if (!sibVal || typeof sibVal !== "object" || !("r" in sibVal)) continue;
        if (rgbaToHex(sibVal) === newHex) {
          hints.push({
            type: "warn",
            message: `"${variable.name}" has the same ${mode.name} value (${newHex}) as existing variable "${sib.name}". ` +
              `If they should stay in sync, bind as alias: variables(method:"update", collectionId:"${collection.name}", ` +
              `items:[{name:"${variable.name}", valuesByMode:{"${mode.name}":{type:"VARIABLE_ALIAS", name:"${sib.name}"}}}])`,
          });
          break;
        }
      }
    }
  }

  const result: any = { name: variable.name, resolvedValues };
  if (hints.length > 0) result.hints = hints;
  return result;
}

async function getVariableFigma(params: any) {
  const collection = await requireCollection(params);
  const v = await findVariableByName(params.name, collection.name);
  if (!v) throw new Error(`Variable not found: ${params.name} in collection "${collection.name}"`);
  const result = await serializeVariable(v);
  result.collectionId = collection.name;
  return result;
}

async function listVariablesFigma(params: any) {
  const collection = await requireCollection(params);

  let variables = params?.type
    ? await figma.variables.getLocalVariablesAsync(params.type)
    : await figma.variables.getLocalVariablesAsync();

  // Filter to collection
  variables = variables.filter((v: any) => v.variableCollectionId === collection.id);

  // Query: prefix match first, then substring fallback
  if (params.query) {
    const q = params.query.toLowerCase();
    const prefixMatches = variables.filter((v: any) => v.name.toLowerCase().startsWith(q));
    if (prefixMatches.length > 0) {
      variables = prefixMatches;
    } else {
      variables = variables.filter((v: any) => v.name.toLowerCase().includes(q));
    }
  }

  const paged = paginate(variables, params.offset, params.limit);
  const fields = params.fields;
  const items: any[] = [];
  for (const v of paged.items) {
    const full = await serializeVariable(v);
    items.push(!fields?.length ? pickFields(full, ["valuesByMode", "scopes", "description"]) : pickFields(full, fields));
  }
  return { ...paged, items };
}

async function updateVariableSingle(p: any, collection: any) {
  const variable = await findVariableByName(p.name, collection.name);
  if (!variable) throw new Error(`Variable not found: ${p.name} in collection "${collection.name}"`);

  if (p.rename !== undefined) variable.name = p.rename;
  if (p.description !== undefined) variable.description = p.description;
  if (p.scopes !== undefined) variable.scopes = p.scopes;

  // Set values: valuesByMode takes precedence, value is shorthand for default mode
  const valuesToSet: Record<string, any> = {};
  if (p.valuesByMode && typeof p.valuesByMode === "object") {
    Object.assign(valuesToSet, p.valuesByMode);
  } else if (p.value !== undefined) {
    const defaultModeName = collection.modes[0]?.name;
    if (defaultModeName) valuesToSet[defaultModeName] = p.value;
  }

  if (Object.keys(valuesToSet).length > 0) {
    const modeMap = new Map<string, string>(
      collection.modes.map((m: any) => [m.name, m.modeId])
    );
    for (const [modeName, rawValue] of Object.entries(valuesToSet)) {
      const modeId = modeMap.get(modeName) ?? await resolveModeId(collection, modeName);
      const coerced = await coerceVariableValue(rawValue);
      variable.setValueForMode(modeId, coerced);
    }
  }

  return {};
}

async function deleteVariableSingle(p: any, collection: any) {
  const variable = await findVariableByName(p.name, collection.name);
  if (!variable) throw new Error(`Variable not found: ${p.name} in collection "${collection.name}"`);
  variable.remove();
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
    delete: (p) => {
      if (p.id && !p.items) { p.items = [{ id: p.id }]; }
      return batchHandler(p, deleteCollectionSingle, { keys: variableCollectionsDelete, help: 'variable_collections(method: "help", topic: "delete")' });
    },
    add_mode: (p) => batchHandler(p, addModeSingle, { keys: variableCollectionsAddMode, help: 'variable_collections(method: "help", topic: "add_mode")' }),
    rename_mode: (p) => batchHandler(p, renameModeSingle, { keys: variableCollectionsRenameMode, help: 'variable_collections(method: "help", topic: "rename_mode")' }),
    remove_mode: (p) => batchHandler(p, removeModeSingle, { keys: variableCollectionsRemoveMode, help: 'variable_collections(method: "help", topic: "remove_mode")' }),
  }),
  variables: createDispatcher({
    create: async (p) => {
      const collection = await requireCollection(p);
      return batchHandler(p, (item) => createVariableSingle(item, collection), { keys: variablesCreate, help: 'variables(method: "help", topic: "create")' });
    },
    get: getVariableFigma,
    list: listVariablesFigma,
    update: async (p) => {
      const collection = await requireCollection(p);
      return batchHandler(p, (item) => updateVariableSingle(item, collection), { keys: variablesUpdate, help: 'variables(method: "help", topic: "update")' });
    },
    delete: async (p) => {
      const collection = await requireCollection(p);
      // Normalize single-name delete to items (prevents batchHandler from wrapping entire params as item)
      if (p.name && !p.items) { p.items = [{ name: p.name }]; }
      return batchHandler(p, (item) => deleteVariableSingle(item, collection), { keys: variablesDelete, help: 'variables(method: "help", topic: "delete")' });
    },
  }),
  set_variable_binding: (p) => batchHandler(p, setBindingSingle),
  set_explicit_variable_mode: (p) => batchHandler(p, setExplicitModeSingle),
  get_node_variables: getNodeVariablesFigma,
};
