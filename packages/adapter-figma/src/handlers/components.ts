import { batchHandler, appendToParent, solidPaint, styleNotFoundHint, suggestStyleForColor, findVariableById } from "./helpers";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";

// ─── Figma Handlers ──────────────────────────────────────────────

// -- Shared helpers --

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

// -- Serializer --

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

// -- components handlers --

async function createComponentSingle(p: any) {
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

async function fromNodeSingle(p: any) {
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

async function combineSingle(p: any) {
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

// -- instances handlers --

async function instanceCreateSingle(p: any) {
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

async function instanceGetFigma(params: any) {
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
