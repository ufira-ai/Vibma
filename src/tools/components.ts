import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler, appendToParent, solidPaint, styleNotFoundHint, suggestStyleForColor, findVariableById } from "./helpers";
import { endpointSchema, createDispatcher, paginate, pickFields } from "./endpoint";
import type { IdResult, IdWithWarningResult, GetInstanceOverridesResult } from "./response-types";


// ─── Schemas: components ────────────────────────────────────────

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

// Per-type create schema map
const componentCreateSchemas: Record<string, z.ZodTypeAny> = {
  component: componentItem,
  from_node: fromNodeItem,
  variant_set: combineItem,
};

// ─── Schemas: instances ─────────────────────────────────────────

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

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {

  // ── components endpoint ──

  const cMethods = ["create", "get", "list", "update"];
  const cSchema = endpointSchema(cMethods, {
    items: flexJson(z.array(z.any())).optional()
      .describe("create (component): [{name, parentId?, ...layout}]. create (from_node): [{nodeId}]. create (variant_set): [{componentIds, name?}]. update: [{id, propertyName, type, defaultValue}]."),
    type: z.enum(["component", "from_node", "variant_set"]).optional()
      .describe("Create type. Required for create: 'component' (from scratch), 'from_node' (convert existing), 'variant_set' (combine as variants)."),
    depth: S.depth,
    name: z.string().optional().describe("Filter list by name (case-insensitive substring)."),
    setsOnly: flexBool(z.boolean()).optional().describe("If true, list returns only COMPONENT_SET nodes."),
  });

  server.tool(
    "components",
    `CRUD endpoint for components.
  create  → {type, items, depth?} → {results: [{id}, ...]}
    type 'component': create from scratch with layout/style params
    type 'from_node': convert existing nodes to components
    type 'variant_set': combine components into variant sets
  get     → {id, fields?} → component object (full detail, field-filterable)
  list    → {name?, setsOnly?, fields?, offset?, limit?} → paginated stubs
  update  → {items: [{id, propertyName, type, defaultValue}]} → {results: ['ok', ...]}`,
    cSchema,
    async (params: any) => {
      try {
        // Validate items per method+type
        if (params.items) {
          if (params.method === "create") {
            const schema = params.type && componentCreateSchemas[params.type];
            if (!schema) throw new Error(`create requires type: component, from_node, or variant_set`);
            params.items = z.array(schema).parse(params.items);
          } else if (params.method === "update") {
            params.items = z.array(updateComponentItem).parse(params.items);
          }
        }
        return mcpJson(await sendCommand("components", params));
      } catch (e) { return mcpError("components error", e); }
    }
  );

  // ── instances endpoint ──

  const iMethods = ["create", "get", "update"];
  const iSchema = endpointSchema(iMethods, {
    items: flexJson(z.array(z.any())).optional()
      .describe("create: [{componentId, variantProperties?, x?, y?, parentId?}]. update: [{id, properties}]."),
    depth: S.depth,
  });

  server.tool(
    "instances",
    `CRUD endpoint for component instances.
  create  → {items: [{componentId, variantProperties?, x?, y?, parentId?}], depth?} → {results: [{id}]}
  get     → {id} → {mainComponentId, overrides: [{id, fields}]}
  update  → {items: [{id, properties}]} → {results: ['ok', ...]}`,
    iSchema,
    async (params: any) => {
      try {
        if (params.items) {
          if (params.method === "create") {
            params.items = z.array(instanceCreateItem).parse(params.items);
          } else if (params.method === "update") {
            params.items = z.array(instanceUpdateItem).parse(params.items);
          }
        }
        return mcpJson(await sendCommand("instances", params));
      } catch (e) { return mcpError("instances error", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

// ── Shared helpers ──

async function resolvePaintStyle(name: string): Promise<{ id: string | null, available: string[] }> {
  const styles = await figma.getLocalPaintStylesAsync();
  const available = styles.map(s => s.name);
  const exact = styles.find(s => s.name === name);
  if (exact) return { id: exact.id, available };
  const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  return { id: fuzzy?.id ?? null, available };
}

async function bindFillVariable(node: any, variableId: string, fallbackColor?: any) {
  const v = await findVariableById(variableId);
  if (!v) return false;
  node.fills = [solidPaint(fallbackColor || { r: 0, g: 0, b: 0 })];
  const bound = figma.variables.setBoundVariableForPaint(node.fills[0], "color", v);
  node.fills = [bound];
  return true;
}

async function bindStrokeVariable(node: any, variableId: string, fallbackColor?: any) {
  const v = await findVariableById(variableId);
  if (!v) return false;
  node.strokes = [solidPaint(fallbackColor || { r: 0, g: 0, b: 0 })];
  const bound = figma.variables.setBoundVariableForPaint(node.strokes[0], "color", v);
  node.strokes = [bound];
  return true;
}

function countTextNodes(node: BaseNode): number {
  if (node.type === "TEXT") return 1;
  if ("children" in node) {
    let count = 0;
    for (const child of (node as any).children) count += countTextNodes(child);
    return count;
  }
  return 0;
}

function warnUnboundText(comp: ComponentNode, hints: string[]) {
  const textCount = countTextNodes(comp);
  if (textCount > 0) {
    hints.push(`Component has ${textCount} text node${textCount > 1 ? "s" : ""} — use components(method: "update") to expose text as editable properties on instances.`);
  }
}

// ── Serializer ──

function serializeComponent(node: any): Record<string, any> {
  const r: any = { id: node.id, name: node.name, type: node.type };
  if ("description" in node) r.description = node.description;
  if (node.parent) { r.parentId = node.parent.id; r.parentName = node.parent.name; }
  if ("componentPropertyDefinitions" in node) r.propertyDefinitions = node.componentPropertyDefinitions;
  if (node.type === "COMPONENT_SET" && "variantGroupProperties" in node) r.variantGroupProperties = node.variantGroupProperties;
  if (node.type === "COMPONENT" && "variantProperties" in node) r.variantProperties = node.variantProperties;
  if ("children" in node && node.children) {
    if (node.type === "COMPONENT_SET") {
      r.variantCount = node.children.length;
      r.children = node.children.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
    } else {
      r.children = node.children.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
    }
  }
  return r;
}

// ── components handlers ──

async function createComponentSingle(p: any): Promise<IdWithWarningResult> {
  if (!p.name) throw new Error("Missing name");
  const {
    x = 0, y = 0, width = 100, height = 100, name, parentId,
    fillColor, fillStyleName, fillVariableId,
    strokeColor, strokeStyleName, strokeVariableId,
    strokeWeight, cornerRadius,
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0,
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    itemSpacing = 0,
  } = p;

  const deferH = parentId && layoutSizingHorizontal === "FILL";
  const deferV = parentId && layoutSizingVertical === "FILL";

  const comp = figma.createComponent();
  comp.name = name;
  comp.x = x; comp.y = y;
  comp.resize(width, height);
  comp.fills = [];

  if (layoutMode !== "NONE") {
    comp.layoutMode = layoutMode;
    comp.layoutWrap = layoutWrap;
    comp.paddingTop = paddingTop; comp.paddingRight = paddingRight;
    comp.paddingBottom = paddingBottom; comp.paddingLeft = paddingLeft;
    comp.primaryAxisAlignItems = primaryAxisAlignItems;
    comp.counterAxisAlignItems = counterAxisAlignItems;
    comp.layoutSizingHorizontal = deferH ? "FIXED" : layoutSizingHorizontal;
    comp.layoutSizingVertical = deferV ? "FIXED" : layoutSizingVertical;
    comp.itemSpacing = itemSpacing;
  }

  const hints: string[] = [];
  if (fillVariableId) {
    const ok = await bindFillVariable(comp, fillVariableId, fillColor);
    if (!ok) hints.push(`fillVariableId '${fillVariableId}' not found.`);
  } else if (fillStyleName) {
    const { id: sid, available } = await resolvePaintStyle(fillStyleName);
    if (sid) {
      try { await (comp as any).setFillStyleIdAsync(sid); }
      catch (e: any) { hints.push(`fillStyleName '${fillStyleName}' matched but failed to apply: ${e.message}`); }
    } else hints.push(styleNotFoundHint("fillStyleName", fillStyleName, available));
  } else if (fillColor) {
    comp.fills = [solidPaint(fillColor)];
    const suggestion = await suggestStyleForColor(fillColor, "fillStyleName");
    if (suggestion) hints.push(suggestion);
  }

  if (strokeVariableId) {
    const ok = await bindStrokeVariable(comp, strokeVariableId, strokeColor);
    if (!ok) hints.push(`strokeVariableId '${strokeVariableId}' not found.`);
  } else if (strokeStyleName) {
    const { id: sid, available } = await resolvePaintStyle(strokeStyleName);
    if (sid) {
      try { await (comp as any).setStrokeStyleIdAsync(sid); }
      catch (e: any) { hints.push(`strokeStyleName '${strokeStyleName}' matched but failed to apply: ${e.message}`); }
    } else hints.push(styleNotFoundHint("strokeStyleName", strokeStyleName, available));
  } else if (strokeColor) {
    comp.strokes = [solidPaint(strokeColor)];
    const suggestion = await suggestStyleForColor(strokeColor, "strokeStyleName");
    if (suggestion) hints.push(suggestion);
  }
  if (strokeWeight !== undefined) comp.strokeWeight = strokeWeight;
  if (cornerRadius !== undefined) comp.cornerRadius = cornerRadius;

  const parent = await appendToParent(comp, parentId);
  if (parent) {
    if (deferH) { try { comp.layoutSizingHorizontal = "FILL"; } catch {} }
    if (deferV) { try { comp.layoutSizingVertical = "FILL"; } catch {} }
  }

  warnUnboundText(comp, hints);

  const result: any = { id: comp.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function fromNodeSingle(p: any): Promise<IdWithWarningResult> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("parent" in node) || !node.parent) throw new Error("Node has no parent");
  const parent = node.parent;
  const index = (parent as any).children.indexOf(node);
  const comp = figma.createComponent();
  comp.name = node.name;
  if ("width" in node && "height" in node) comp.resize((node as any).width, (node as any).height);
  if ("x" in node && "y" in node) { comp.x = (node as any).x; comp.y = (node as any).y; }
  const clone = (node as any).clone(); clone.x = 0; clone.y = 0;
  comp.appendChild(clone);
  (parent as any).insertChild(index, comp);
  node.remove();

  const hints: string[] = [];
  warnUnboundText(comp, hints);

  const result: any = { id: comp.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function combineSingle(p: any): Promise<IdResult> {
  if (!p.componentIds?.length || p.componentIds.length < 2) throw new Error("Need at least 2 components");
  const comps: ComponentNode[] = [];
  for (const id of p.componentIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Component not found: ${id}`);
    if (node.type !== "COMPONENT") throw new Error(`Node ${id} is not a COMPONENT`);
    comps.push(node as ComponentNode);
  }
  const parent = comps[0].parent && comps.every(c => c.parent === comps[0].parent)
    ? comps[0].parent : figma.currentPage;
  const set = figma.combineAsVariants(comps, parent as any);
  if (p.name) set.name = p.name;
  return { id: set.id };
}

async function createComponentDispatch(params: any) {
  switch (params.type) {
    case "component": return batchHandler(params, createComponentSingle);
    case "from_node": return batchHandler(params, fromNodeSingle);
    case "variant_set": return batchHandler(params, combineSingle);
    default: throw new Error(`Unknown create type: ${params.type}`);
  }
}

async function getComponentFigma(params: any) {
  const node = await figma.getNodeByIdAsync(params.id);
  if (!node) throw new Error(`Component not found: ${params.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Not a component: ${node.type}`);
  return serializeComponent(node);
}

async function listComponentsFigma(params: any) {
  await figma.loadAllPagesAsync();
  const setsOnly = params?.setsOnly;
  const types = setsOnly ? ["COMPONENT_SET"] : ["COMPONENT", "COMPONENT_SET"];
  let components = figma.root.findAllWithCriteria({ types: types as any });
  if (params?.name) {
    const f = params.name.toLowerCase();
    components = components.filter((c: any) => c.name.toLowerCase().includes(f));
  }
  const paged = paginate(components, params.offset, params.limit);
  const fields = params.fields;
  const items = paged.items.map((c: any) => {
    const stub: any = { id: c.id, name: c.name, type: c.type };
    if (c.type === "COMPONENT_SET" && "children" in c) stub.variantCount = c.children.length;
    if (c.description) stub.description = c.description;
    let p = c.parent;
    while (p && p.type !== "PAGE") p = p.parent;
    if (p) { stub.pageId = p.id; stub.pageName = p.name; }
    if (fields?.length) return pickFields(stub, fields);
    return stub;
  });
  return { ...paged, items };
}

async function addComponentPropertySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Node ${p.id} is a ${node.type}, not a COMPONENT or COMPONENT_SET.`);
  (node as any).addComponentProperty(p.propertyName, p.type, p.defaultValue);
  return {};
}

// ── instances handlers ──

async function instanceCreateSingle(p: any): Promise<IdResult> {
  let node: any = await figma.getNodeByIdAsync(p.componentId);
  if (!node) {
    await figma.loadAllPagesAsync();
    node = await figma.getNodeByIdAsync(p.componentId);
  }
  if (!node) throw new Error(`Component not found: ${p.componentId}`);
  if (node.type === "COMPONENT_SET") {
    if (!node.children?.length) throw new Error("Component set has no variants");
    if (p.variantProperties && typeof p.variantProperties === "object") {
      const match = node.children.find((child: any) => {
        if (child.type !== "COMPONENT" || !child.variantProperties) return false;
        return Object.entries(p.variantProperties).every(
          ([k, v]) => {
            if (child.variantProperties[k] === v) return true;
            const prefixedKey = `${node.name}/${k}`;
            return child.variantProperties[prefixedKey] === v;
          }
        );
      });
      if (match) node = match;
      else {
        const prefix = `${node.name}/`;
        const available = node.children
          .filter((c: any) => c.type === "COMPONENT")
          .map((c: any) => {
            const props: Record<string, string> = {};
            for (const [k, v] of Object.entries(c.variantProperties || {})) {
              props[k.startsWith(prefix) ? k.slice(prefix.length) : k] = v as string;
            }
            return props;
          });
        throw new Error(`No variant matching ${JSON.stringify(p.variantProperties)} in ${node.name}. Available: ${JSON.stringify(available)}`);
      }
    } else {
      node = node.defaultVariant || node.children[0];
    }
  }
  if (node.type !== "COMPONENT") throw new Error(`Not a component: ${node.type}`);
  const inst = node.createInstance();
  if (p.x !== undefined) inst.x = p.x;
  if (p.y !== undefined) inst.y = p.y;
  await appendToParent(inst, p.parentId);
  return { id: inst.id };
}

async function instanceGetFigma(params: any): Promise<GetInstanceOverridesResult> {
  const inst: any = await figma.getNodeByIdAsync(params.id);
  if (!inst) throw new Error(`Instance not found: ${params.id}`);
  if (inst.type !== "INSTANCE") throw new Error("Node is not an instance");
  const overrides = inst.overrides || [];
  const main = await inst.getMainComponentAsync();
  return {
    mainComponentId: main?.id,
    overrides: overrides.map((o: any) => ({ id: o.id, fields: o.overriddenFields })),
  };
}

async function instanceUpdateSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  (node as InstanceNode).setProperties(p.properties);
  return {};
}

// ─── Handler Exports ─────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  components: createDispatcher({
    create: createComponentDispatch,
    get: getComponentFigma,
    list: listComponentsFigma,
    update: (p) => batchHandler(p, addComponentPropertySingle),
  }),
  instances: createDispatcher({
    create: (p) => batchHandler(p, instanceCreateSingle),
    get: instanceGetFigma,
    update: (p) => batchHandler(p, instanceUpdateSingle),
  }),
};
