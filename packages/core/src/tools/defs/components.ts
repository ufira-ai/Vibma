import { z } from "zod";
import { flexJson, flexBool } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";
import { endpointSchema } from "../endpoint";

const componentItem = z.object({
  name: z.string().describe("Component name"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 100)"),
  height: z.coerce.number().optional().describe("Height (default: 100)"),
  parentId: S.parentId,
  fillColor: flexJson(S.colorRgba).optional().describe('Fill color. Omit for no fill.'),
  fillStyleName: z.string().optional().describe("Apply a fill paint style by name (case-insensitive)."),
  fillVariableId: z.string().optional().describe("Bind a color variable to the fill."),
  strokeColor: flexJson(S.colorRgba).optional().describe('Stroke color. Omit for no stroke.'),
  strokeStyleName: z.string().optional().describe("Apply a stroke paint style by name."),
  strokeVariableId: z.string().optional().describe("Bind a color variable to the stroke."),
  strokeWeight: z.coerce.number().positive().optional().describe("Stroke weight (default: 1)"),
  cornerRadius: z.coerce.number().optional().describe("Corner radius (default: 0)"),
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: NONE)"),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).optional().describe("Wrap behavior (default: NO_WRAP)"),
  paddingTop: z.coerce.number().optional().describe("Top padding (default: 0)"),
  paddingRight: z.coerce.number().optional().describe("Right padding (default: 0)"),
  paddingBottom: z.coerce.number().optional().describe("Bottom padding (default: 0)"),
  paddingLeft: z.coerce.number().optional().describe("Left padding (default: 0)"),
  primaryAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]).optional().describe("Primary axis alignment (default: MIN)"),
  counterAxisAlignItems: z.enum(["MIN", "MAX", "CENTER", "BASELINE"]).optional().describe("Counter axis alignment (default: MIN)"),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Horizontal sizing (default: FIXED)"),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]).optional().describe("Vertical sizing (default: FIXED)"),
  itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
});

const fromNodeItem = z.object({
  nodeId: S.nodeId,
});

const combineItem = z.object({
  componentIds: flexJson(z.array(z.string())).describe("Component IDs to combine (min 2)"),
  name: z.string().optional().describe("Name for the component set. Omit to auto-generate."),
});

const updateComponentItem = z.object({
  id: z.string().describe("Component node ID"),
  propertyName: z.string().describe("Property name"),
  type: z.enum(["BOOLEAN", "TEXT", "INSTANCE_SWAP", "VARIANT"]).describe("Property type"),
  defaultValue: flexBool(z.union([z.string(), z.boolean()])).describe("Default value (string for TEXT/VARIANT, boolean for BOOLEAN)"),
  preferredValues: flexJson(z.array(z.object({
    type: z.enum(["COMPONENT", "COMPONENT_SET"]),
    key: z.string(),
  })).optional()).describe("Preferred values for INSTANCE_SWAP type. Omit for none."),
});

const componentCreateSchemas: Record<string, z.ZodTypeAny> = {
  component: componentItem,
  from_node: fromNodeItem,
  variant_set: combineItem,
};

const instanceCreateItem = z.object({
  componentId: z.string().describe("Component or component set ID"),
  variantProperties: flexJson(z.record(z.string(), z.string())).optional().describe('Pick variant by properties, e.g. {"Style":"Secondary","Size":"Large"}. Ignored for plain COMPONENT IDs.'),
  x: z.coerce.number().optional().describe("X position. Omit to keep default."),
  y: z.coerce.number().optional().describe("Y position. Omit to keep default."),
  parentId: S.parentId,
});

const instanceUpdateItem = z.object({
  id: S.nodeId,
  properties: flexJson(z.record(z.string(), z.union([z.string(), z.boolean()]))).describe('Property key→value map, e.g. {"Label#1:0":"Click Me"}'),
});

export const tools: ToolDef[] = [
  {
    name: "components",
    description:
      `CRUD endpoint for components.
  create  → {type, items, depth?} → {results: [{id}, ...]}
    type 'component': create from scratch with layout/style params
    type 'from_node': convert existing nodes to components
    type 'variant_set': combine components into variant sets
  get     → {id, fields?} → component object (full detail, field-filterable)
  list    → {name?, setsOnly?, fields?, offset?, limit?} → paginated stubs
  update  → {items: [{id, propertyName, type, defaultValue}]} → {results: ['ok', ...]}`,
    schema: (caps) => endpointSchema(
      ["create", "get", "list", "update"],
      caps,
      {
        items: flexJson(z.array(z.any())).optional()
          .describe("create (component): [{name, parentId?, ...layout}]. create (from_node): [{nodeId}]. create (variant_set): [{componentIds, name?}]. update: [{id, propertyName, type, defaultValue}]."),
        type: z.enum(["component", "from_node", "variant_set"]).optional()
          .describe("Create type. Required for create: 'component' (from scratch), 'from_node' (convert existing), 'variant_set' (combine as variants)."),
        depth: S.depth,
        name: z.string().optional().describe("Filter list by name (case-insensitive substring)."),
        setsOnly: flexBool(z.boolean()).optional().describe("If true, list returns only COMPONENT_SET nodes."),
      },
    ),
    tier: "read",
    validate: (params: any) => {
      if (params.items) {
        if (params.method === "create") {
          const schema = params.type && componentCreateSchemas[params.type];
          if (!schema) throw new Error(`create requires type: component, from_node, or variant_set`);
          params.items = z.array(schema).parse(params.items);
        } else if (params.method === "update") {
          params.items = z.array(updateComponentItem).parse(params.items);
        }
      }
    },
  },
  {
    name: "instances",
    description:
      `CRUD endpoint for component instances.
  create  → {items: [{componentId, variantProperties?, x?, y?, parentId?}], depth?} → {results: [{id}]}
  get     → {id} → {mainComponentId, overrides: [{id, fields}]}
  update  → {items: [{id, properties}]} → {results: ['ok', ...]}`,
    schema: (caps) => endpointSchema(
      ["create", "get", "update"],
      caps,
      {
        items: flexJson(z.array(z.any())).optional()
          .describe("create: [{componentId, variantProperties?, x?, y?, parentId?}]. update: [{id, properties}]."),
        depth: S.depth,
      },
    ),
    tier: "read",
    validate: (params: any) => {
      if (params.items) {
        if (params.method === "create") {
          params.items = z.array(instanceCreateItem).parse(params.items);
        } else if (params.method === "update") {
          params.items = z.array(instanceUpdateItem).parse(params.items);
        }
      }
    },
  },
];
