import { batchHandler, appendToParent, applyTokens } from "./helpers";
import { setupFrameNode } from "./create-frame";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";

function findTextNodes(node: BaseNode, skipInstances = false): TextNode[] {
  if (node.type === "TEXT") return [node as TextNode];
  if (skipInstances && node.type === "INSTANCE") return [];
  if ("children" in node) {
    const result: TextNode[] = [];
    for (const child of (node as any).children) result.push(...findTextNodes(child, skipInstances));
    return result;
  }
  return [];
}

function warnUnboundText(comp: ComponentNode, hints: string[]) {
  const textNodes = findTextNodes(comp, true);
  if (textNodes.length > 0) {
    hints.push(`Component has ${textNodes.length} unbound text node${textNodes.length > 1 ? "s" : ""}. Pass exposeText: true to auto-expose text as editable properties on instances.`);
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

  const comp = figma.createComponent();
  comp.x = p.x ?? 0;
  comp.y = p.y ?? 0;
  comp.resize(p.width ?? 100, p.height ?? 100);
  comp.name = p.name;
  comp.fills = [];

  const { hints } = await setupFrameNode(comp, p);

  // Add component properties if provided
  if (p.properties?.length) {
    for (const prop of p.properties) {
      const options = prop.preferredValues ? { preferredValues: prop.preferredValues } : undefined;
      comp.addComponentProperty(prop.propertyName, prop.type, prop.defaultValue, options);
    }
  }

  warnUnboundText(comp, hints);

  const result: any = { id: comp.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

/**
 * Derive a semantic property name for a text node.
 * Priority: explicit layer name (if different from content) > positional role > sanitized content.
 */
function deriveTextPropertyName(textNode: TextNode, index: number, total: number, usedNames: Set<string>): string {
  const layerName = textNode.name;
  const content = textNode.characters;

  let name: string;

  // If the layer was explicitly renamed (name differs from content), trust the layer name
  if (layerName !== content) {
    name = layerName;
  } else if (total <= 4) {
    // For small groups, assign semantic names based on order
    const roles = ["title", "description", "detail", "caption"];
    name = roles[index] || `text_${index + 1}`;
  } else {
    // Fallback: sanitize content to a short slug
    const slug = content.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase().slice(0, 24);
    name = slug || `text_${index + 1}`;
  }

  // Deduplicate: append _2, _3 etc. if name already used
  const base = name;
  let counter = 2;
  while (usedNames.has(name)) {
    name = `${base}_${counter++}`;
  }
  usedNames.add(name);
  return name;
}

async function fromNodeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (node.type === "DOCUMENT" || node.type === "PAGE") throw new Error(`Cannot convert ${node.type} to a component.`);
  if (node.type === "COMPONENT") throw new Error(`Node "${node.name}" is already a COMPONENT.`);
  if (node.type === "COMPONENT_SET") throw new Error(`Node "${node.name}" is already a COMPONENT_SET. Use components(method: "get") to inspect it.`);
  if (node.type === "INSTANCE") throw new Error(`Node "${node.name}" is an INSTANCE. Detach it first with instances(method:"detach"), or use the source component directly.`);
  const comp = figma.createComponentFromNode(node as SceneNode);

  const hints: string[] = [];
  const exposedProperties: Record<string, string> = {};

  if (p.exposeText !== false) {
    const textNodes = findTextNodes(comp, true);
    // Sort by vertical then horizontal position for consistent role assignment
    const sorted = [...textNodes].sort((a, b) => a.y - b.y || a.x - b.x);
    const usedNames = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      const textNode = sorted[i];
      const propName = deriveTextPropertyName(textNode, i, sorted.length, usedNames);
      const defaultValue = textNode.characters;

      // Also rename the layer to match the property name for consistency
      if (textNode.name === textNode.characters) {
        textNode.name = propName;
      }

      comp.addComponentProperty(propName, "TEXT", defaultValue);
      const defs = comp.componentPropertyDefinitions;
      const key = Object.keys(defs).find(k => k === propName || k.startsWith(propName + "#"));
      if (key) {
        (textNode as any).componentPropertyReferences = { characters: key };
        exposedProperties[key] = defaultValue;
      }
    }
  } else {
    warnUnboundText(comp, hints);
  }

  const result: any = { id: comp.id };
  if (Object.keys(exposedProperties).length > 0) result.exposedProperties = exposedProperties;
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

  // Reset combineAsVariants' default layout so setupFrameNode applies cleanly
  set.layoutMode = "NONE";
  set.fills = [];

  const { hints } = await setupFrameNode(set as any, p);

  // Rename auto-generated variant property if variantPropertyName is specified
  if (p.variantPropertyName) {
    const defs = set.componentPropertyDefinitions;
    const variantKeys = Object.keys(defs).filter(k => defs[k].type === "VARIANT");
    // Prefer auto-generated "Property N" names
    let autoKey = variantKeys.find(k => /^Property \d+$/.test(k));
    // If no auto-generated key and exactly one variant prop, rename that
    if (!autoKey && variantKeys.length === 1) autoKey = variantKeys[0];
    if (autoKey) {
      try {
        set.editComponentProperty(autoKey, { name: p.variantPropertyName });
      } catch (e: any) {
        hints.push(`Failed to rename variant property "${autoKey}" to "${p.variantPropertyName}": ${e.message}`);
      }
    } else if (variantKeys.length === 0) {
      hints.push(`No VARIANT properties found to rename.`);
    } else {
      hints.push(`Multiple variant properties found (${variantKeys.join(", ")}). Cannot auto-rename — use components(method:"update", action:"edit") to rename each.`);
    }
  }

  // Check for unbound text nodes across all variants
  const unboundCount = comps.reduce((n, c) => {
    return n + findTextNodes(c).filter(t => !(t as any).componentPropertyReferences?.characters).length;
  }, 0);
  const result: any = { id: set.id };
  if (unboundCount > 0) {
    hints.push(`${unboundCount} text node${unboundCount > 1 ? "s" : ""} across variants not exposed as properties — instances cannot edit this text via properties. Fix: components(method: "update", items: [{id: "${set.id}", propertyName: "<textNodeName>", type: "TEXT", defaultValue: "<text>"}])`);
  }
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
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

async function updateComponentPropertySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Node ${p.id} is a ${node.type}, not a COMPONENT or COMPONENT_SET.`);
  const comp = node as any;

  // Resolve property name with prefix matching (agents may omit the #suffix)
  function resolveKey(name: string): string {
    const defs = comp.componentPropertyDefinitions;
    if (defs[name]) return name;
    const match = Object.keys(defs).find(k => k.startsWith(name + "#"));
    return match ?? name;
  }

  // Delete property
  if (p.action === "delete") {
    comp.deleteComponentProperty(resolveKey(p.propertyName));
    return {};
  }

  // Rename variant options: changes child component names within a component set
  if (p.action === "rename_variant") {
    if (comp.type !== "COMPONENT_SET") throw new Error("rename_variant requires a COMPONENT_SET node");
    const propName = p.propertyName;
    if (p.defaultValue === undefined || p.name === undefined) throw new Error("rename_variant requires defaultValue (current option name) and name (new option name)");
    const fromValue = String(p.defaultValue);
    const toValue = String(p.name);
    let renamed = 0;
    for (const child of comp.children) {
      if (child.type !== "COMPONENT") continue;
      const vp = child.variantProperties;
      if (!vp || vp[propName] !== fromValue) continue;
      const parts = child.name.split(", ");
      child.name = parts.map((part: string) => {
        const eq = part.indexOf("=");
        if (eq === -1) return part;
        const key = part.slice(0, eq).trim();
        const val = part.slice(eq + 1).trim();
        return key === propName && val === fromValue ? `${key}=${toValue}` : part;
      }).join(", ");
      renamed++;
    }
    if (renamed === 0) {
      const available = comp.children
        .filter((c: any) => c.type === "COMPONENT" && c.variantProperties?.[propName])
        .map((c: any) => c.variantProperties[propName]);
      throw new Error(`No variant with ${propName}="${fromValue}" found. Available: [${[...new Set(available)].join(", ")}]`);
    }
    return { renamed };
  }

  // Edit existing property
  if (p.action === "edit") {
    const propKey = resolveKey(p.propertyName);
    const propDef = comp.componentPropertyDefinitions[propKey];

    // VARIANT defaultValue: reorder children to set the default variant
    if (propDef?.type === "VARIANT" && p.defaultValue !== undefined && comp.type === "COMPONENT_SET") {
      const targetChild = comp.children.find((c: any) => {
        if (c.type !== "COMPONENT") return false;
        return c.variantProperties?.[propKey] === String(p.defaultValue);
      });
      if (!targetChild) {
        const available = comp.children
          .filter((c: any) => c.type === "COMPONENT")
          .map((c: any) => c.variantProperties?.[propKey])
          .filter(Boolean);
        throw new Error(`Variant "${p.defaultValue}" not found for property "${propKey}". Available: [${[...new Set(available)].join(", ")}]`);
      }
      comp.insertChild(0, targetChild);
      // Process other edits (e.g. name rename) without defaultValue
      const edit: any = {};
      if (p.name !== undefined) edit.name = p.name;
      if (p.preferredValues !== undefined) edit.preferredValues = p.preferredValues;
      if (Object.keys(edit).length > 0) comp.editComponentProperty(propKey, edit);
      return {};
    }

    const edit: any = {};
    if (p.name !== undefined) edit.name = p.name;
    if (p.defaultValue !== undefined) edit.defaultValue = p.defaultValue;
    if (p.preferredValues !== undefined) edit.preferredValues = p.preferredValues;
    const newKey = comp.editComponentProperty(propKey, edit);
    return { propertyKey: newKey };
  }

  // Default: add property (backward compat)
  const options = p.preferredValues ? { preferredValues: p.preferredValues } : undefined;
  comp.addComponentProperty(p.propertyName, p.type, p.defaultValue, options);
  const defs = comp.componentPropertyDefinitions;
  const key = Object.keys(defs).find(k => k === p.propertyName || k.startsWith(p.propertyName + "#"));
  if (key && p.type === "TEXT") {
    const roots = node.type === "COMPONENT_SET"
      ? comp.children.filter((c: any) => c.type === "COMPONENT")
      : [node];
    for (const root of roots) {
      const textNode = findTextNodes(root).find(
        (t: TextNode) => t.name === p.propertyName || t.characters === p.defaultValue
      );
      if (textNode) (textNode as any).componentPropertyReferences = { characters: key };
    }
  }
  return key ? { propertyKey: key } : {};
}

async function deleteComponentSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Node ${p.id} is a ${node.type}, not a COMPONENT or COMPONENT_SET.`);
  node.remove();
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
  if (p.name) inst.name = p.name;
  if (p.x !== undefined) inst.x = p.x;
  if (p.y !== undefined) inst.y = p.y;
  if (p.width !== undefined || p.height !== undefined) {
    inst.resize(p.width ?? inst.width, p.height ?? inst.height);
  }

  const hints: string[] = [];
  await applyTokens(inst, { opacity: p.opacity }, hints);

  // Min/max constraints
  if (p.minWidth !== undefined) (inst as any).minWidth = p.minWidth;
  if (p.maxWidth !== undefined) (inst as any).maxWidth = p.maxWidth;
  if (p.minHeight !== undefined) (inst as any).minHeight = p.minHeight;
  if (p.maxHeight !== undefined) (inst as any).maxHeight = p.maxHeight;

  // Defer FILL sizing until after parent append
  const deferH = p.parentId && p.layoutSizingHorizontal === "FILL";
  const deferV = p.parentId && p.layoutSizingVertical === "FILL";
  if (p.layoutSizingHorizontal && !deferH) inst.layoutSizingHorizontal = p.layoutSizingHorizontal;
  if (p.layoutSizingVertical && !deferV) inst.layoutSizingVertical = p.layoutSizingVertical;

  const parent = await appendToParent(inst, p.parentId);
  const parentIsAL = parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  if (deferH) {
    if (parentIsAL) inst.layoutSizingHorizontal = "FILL";
    else hints.push("layoutSizingHorizontal 'FILL' ignored — parent is not an auto-layout frame.");
  }
  if (deferV) {
    if (parentIsAL) inst.layoutSizingVertical = "FILL";
    else hints.push("layoutSizingVertical 'FILL' ignored — parent is not an auto-layout frame.");
  }

  const result: any = { id: inst.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function instanceGetFigma(params: any) {
  const inst: any = await figma.getNodeByIdAsync(params.id);
  if (!inst) throw new Error(`Instance not found: ${params.id}`);
  if (inst.type !== "INSTANCE") throw new Error("Node is not an instance");
  const overrides = inst.overrides || [];
  const main = await inst.getMainComponentAsync();
  return {
    mainComponentId: main?.id,
    componentProperties: inst.componentProperties,
    overrides: overrides.map((o: any) => ({ id: o.id, fields: o.overriddenFields })),
  };
}

async function instanceUpdateSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  const inst = node as InstanceNode;
  // Resolve partial property keys: "Label" → "Label#2:33"
  // Agents often don't know the full key suffix — match by prefix.
  const defs = inst.componentProperties;
  const resolvedProps: Record<string, any> = {};
  for (const [key, value] of Object.entries(p.properties)) {
    if (defs[key]) {
      resolvedProps[key] = value;
    } else {
      const match = Object.keys(defs).find(k => k.startsWith(key + "#"));
      resolvedProps[match ?? key] = value;
    }
  }
  inst.setProperties(resolvedProps);
  return {};
}

async function instanceSwapSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  let comp: any = await figma.getNodeByIdAsync(p.componentId);
  if (!comp) throw new Error(`Component not found: ${p.componentId}`);
  if (comp.type === "COMPONENT_SET") comp = comp.defaultVariant || comp.children?.[0];
  if (comp.type !== "COMPONENT") throw new Error(`Node ${p.componentId} is ${comp.type}, not a COMPONENT`);
  (node as InstanceNode).swapComponent(comp as ComponentNode);
  return {};
}

async function instanceDetachSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  const frame = (node as InstanceNode).detachInstance();
  return { id: frame.id };
}

async function instanceResetOverridesSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  (node as any).removeOverrides();
  return {};
}

// ─── Handler Exports ─────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  components: createDispatcher({
    create: createComponentDispatch,
    get: getComponentFigma,
    list: listComponentsFigma,
    update: (p) => batchHandler(p, updateComponentPropertySingle),
    delete: (p) => batchHandler(p, deleteComponentSingle),
  }),
  instances: createDispatcher({
    create: (p) => batchHandler(p, instanceCreateSingle),
    get: instanceGetFigma,
    update: (p) => batchHandler(p, instanceUpdateSingle),
    swap: (p) => batchHandler(p, instanceSwapSingle),
    detach: (p) => batchHandler(p, instanceDetachSingle),
    reset_overrides: (p) => batchHandler(p, instanceResetOverridesSingle),
  }),
};
