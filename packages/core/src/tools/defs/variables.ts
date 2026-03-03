import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";
import { endpointSchema } from "../endpoint";
import type { MethodTier } from "../endpoint";

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

const collectionMethodSchemas: Record<string, z.ZodTypeAny> = {
  create: collectionCreateItem,
  delete: deleteCollectionItem,
  add_mode: addModeItem,
  rename_mode: renameModeItem,
  remove_mode: removeModeItem,
};

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

const vcMethodTiers: Record<string, MethodTier> = {
  add_mode: "create",
  rename_mode: "edit",
  remove_mode: "edit",
};

export const tools: ToolDef[] = [
  {
    name: "variable_collections",
    description:
      `CRUD endpoint for variable collections + mode management.
  create       → {items: [{name}]}                          → {results: [{id, modes, defaultModeId}]}
  get          → {id, fields?}                              → collection object
  list         → {fields?, offset?, limit?}                 → paginated stubs
  delete       → {id} or {items: [{id}]}                    → 'ok' or {results: ['ok', ...]}
  add_mode     → {items: [{collectionId, name}]}            → {results: [{modeId, modes}]}
  rename_mode  → {items: [{collectionId, modeId, name}]}    → {results: [{modes}]}
  remove_mode  → {items: [{collectionId, modeId}]}          → {results: [{modes}]}`,
    schema: (caps) => endpointSchema(
      ["create", "get", "list", "delete", "add_mode", "rename_mode", "remove_mode"],
      caps,
      {
        items: flexJson(z.array(z.any())).optional()
          .describe("create: [{name}]. delete (batch): [{id}]. add_mode: [{collectionId, name}]. rename_mode: [{collectionId, modeId, name}]. remove_mode: [{collectionId, modeId}]."),
      },
      vcMethodTiers,
    ),
    tier: "read",
    validate: (params: any) => {
      if (params.items) {
        const schema = collectionMethodSchemas[params.method];
        if (schema) params.items = z.array(schema).parse(params.items);
      }
    },
  },
  {
    name: "variables",
    description:
      `CRUD endpoint for design variables.
  create  → {items: [{collectionId, name, resolvedType}]}   → {results: [{id}]}
  get     → {id, fields?}                                   → variable object (full detail)
  list    → {type?, collectionId?, fields?, offset?, limit?} → paginated stubs (fields for detail)
  update  → {items: [{id, modeId, value}]}                  → {results: ['ok', ...]}`,
    schema: (caps) => endpointSchema(
      ["create", "get", "list", "update"],
      caps,
      {
        items: flexJson(z.array(z.any())).optional()
          .describe("create: [{collectionId, name, resolvedType}]. update: [{id, modeId, value}]."),
        type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional()
          .describe("Filter list by variable type."),
        collectionId: z.string().optional()
          .describe("Filter list by collection ID."),
      },
    ),
    tier: "read",
    validate: (params: any) => {
      if (params.items) {
        const schema = variableMethodSchemas[params.method];
        if (schema) params.items = z.array(schema).parse(params.items);
      }
    },
  },
  {
    name: "set_variable_binding",
    description: "Bind variables to node properties. Common fields: 'fills/0/color', 'strokes/0/color', 'opacity', 'topLeftRadius', 'itemSpacing'. Batch: pass multiple items.",
    schema: { items: flexJson(z.array(bindingItem)).describe("Array of {nodeId, field, variableId}") },
    tier: "edit",
  },
  {
    name: "set_explicit_variable_mode",
    description: "Pin a variable collection mode on a frame (e.g. show Dark mode). Batch: pass multiple items.",
    schema: { items: flexJson(z.array(setExplicitModeItem)).describe("Array of {nodeId, collectionId, modeId}") },
    tier: "edit",
  },
  {
    name: "get_node_variables",
    description: "Get variable bindings on a node. Returns which variables are bound to fills, strokes, opacity, corner radius, etc.",
    schema: { nodeId: S.nodeId },
    tier: "read",
  },
];
