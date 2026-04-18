import { batchHandler, appendAndApplySizing, checkOverlappingSiblings, isSmallIntrinsic, applyTokens, resolveComponentPropertyKey, normalizeAliases, TEXT_ALIAS_KEYS, FRAME_ALIAS_KEYS, type Hint } from "./helpers";
import { setupFrameNode } from "./create-frame";
import { auditNode } from "./lint";
import { validateAndFixInlineChildren, formatDiff, buildCorrectedPayload } from "./inline-tree";
import { createStageContainer } from "./stage";
import { createDispatcher, paginate, pickFields } from "@ufira/vibma/endpoint";
import {
  componentsCreateComponent, componentsCreateFromNode, componentsCreateVariantSet,
  componentsUpdate, instancesCreate, instancesUpdate, instancesSwap,
  instancesDetach, instancesResetOverrides, nodeUpdate,
} from "@ufira/vibma/guards";

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

function warnUnboundText(comp: ComponentNode, hints: Hint[]) {
  const textNodes = findTextNodes(comp, true)
    .filter(t => !(t as any).componentPropertyReferences?.characters);
  if (textNodes.length > 0) {
    hints.push({ type: "suggest", message: `Component has ${textNodes.length} unbound text node${textNodes.length > 1 ? "s" : ""}. Fix: use components(method:"create", type:"from_node") with exposeText:true, or add properties with components(method:"update") then bind via text/frames(method:"update", items:[{id:"<textNodeId>", componentPropertyName:"<propName>"}]).` });
  }
}

// -- inline children --

import { prepCreateText, createTextSingle, type CreateTextContext } from "./create-text";

/**
 * Normalize inline child types in-place before processing.
 * - Lowercase: "TEXT" → "text"
 * - Infer: {text:"hello"} → type:"text", {componentId:"1:2"} → type:"instance"
 * - Alias: instance.id → componentId
 * Recurses into frame/component children.
 */
export function normalizeInlineChildTypes(children: any[]): void {
  for (const child of children) {
    if (child.type) {
      child.type = child.type.toLowerCase();
    } else if (child.text !== undefined || child.characters !== undefined) {
      child.type = "text";
    } else if (child.componentId || child.id) {
      child.type = "instance";
    } else if (child.name) {
      child.type = "frame";
    }
    // Alias: id → componentId for instances
    if (child.type === "instance" && !child.componentId && child.id) {
      child.componentId = child.id;
      delete child.id;
    }
    // Recurse
    if ((child.type === "frame" || child.type === "component") && child.children?.length) {
      normalizeInlineChildTypes(child.children);
    }
  }
}

export function collectTextChildren(children: any[]): any[] {
  const result: any[] = [];
  for (const child of children) {
    if (child.type === "text") result.push(child);
    else if ((child.type === "frame" || child.type === "component") && child.children?.length) {
      result.push(...collectTextChildren(child.children));
    }
  }
  return result;
}

/**
 * Create child nodes inline during creation.
 * Works for both components (with property binding) and plain frames (without).
 * Text children delegate to createTextSingle for full feature parity.
 * Frame children use setupFrameNode and recurse for nested trees.
 */
export async function createInlineChildren(
  appendTo: FrameNode | ComponentNode,
  comp: ComponentNode | null,
  children: any[],
  hints: Hint[],
  textCtx: CreateTextContext,
): Promise<void> {
  for (const child of children) {
    // Type normalization (lowercase, inference, id→componentId) handled by normalizeInlineChildTypes pre-pass.
    // Catch anything that still has no type (e.g. empty object).
    if (!child.type) {
      hints.push({ type: "error", message: `Inline child missing 'type'. Set type: "text", "frame", "instance", or "component".` });
      continue;
    }

    if (child.type === "text") {
      normalizeAliases(child, TEXT_ALIAS_KEYS);

      // Pre-create TEXT property on the component and capture the actual key
      // (Figma may rename duplicates: "Label" → "Label2")
      let resolvedTextKey: string | undefined;
      if (child.componentPropertyName && comp) {
        const text = child.text ?? child.characters ?? "Text";
        const keysBefore = new Set(Object.keys(comp.componentPropertyDefinitions));
        comp.addComponentProperty(child.componentPropertyName, "TEXT", text);
        const keysAfter = Object.keys(comp.componentPropertyDefinitions);
        resolvedTextKey = keysAfter.find(k => !keysBefore.has(k));
      }

      // Delegate to shared text creation logic — omit componentPropertyName so we bind manually
      const { componentPropertyName: _, ...textParams } = child;
      const result = await createTextSingle({
        ...textParams,
        parentId: appendTo.id,
        ...(comp ? { componentId: comp.id } : {}),
        name: child.name || child.componentPropertyName || child.text || child.characters || "Text",
      }, textCtx);

      // Bind to the exact key (not by name resolution which can hit the wrong duplicate)
      if (resolvedTextKey && result.id) {
        const textNode = await figma.getNodeByIdAsync(result.id);
        if (textNode) {
          (textNode as any).componentPropertyReferences = { ...(textNode as any).componentPropertyReferences, characters: resolvedTextKey };
        }
      }

      if (result.hints) hints.push(...result.hints);
    } else if (child.type === "frame") {
      child.parentId = appendTo.id;

      const frame = figma.createFrame();
      try {
        frame.name = child.name || "Frame";

        const { hints: frameHints } = await setupFrameNode(frame, child);
        hints.push(...frameHints);

        // Recurse for nested children — properties bind to the root component
        if (child.children?.length) {
          await createInlineChildren(frame, comp, child.children, hints, textCtx);
        }
      } catch (e) {
        frame.remove();
        throw e;
      }
    } else if (child.type === "instance") {
      if (!child.componentId) {
        hints.push({ type: "error", message: "Inline instance child requires componentId." });
        continue;
      }

      const result = await instanceCreateSingle({
        ...child,
        parentId: appendTo.id,
      });

      // Post-create: bind INSTANCE_SWAP property using the resolved component
      if (child.componentPropertyName && comp && result.id) {
        // Resolve the main component for the default value (handles COMPONENT_SET → variant)
        const tempInst = await figma.getNodeByIdAsync(result.id) as InstanceNode | null;
        const mainComp = tempInst && await tempInst.getMainComponentAsync();
        if (mainComp) {
          const keysBefore = new Set(Object.keys(comp.componentPropertyDefinitions));
          comp.addComponentProperty(child.componentPropertyName, "INSTANCE_SWAP", mainComp.id);
          const keysAfter = Object.keys(comp.componentPropertyDefinitions);
          const swapKey = keysAfter.find(k => !keysBefore.has(k));
          if (swapKey) {
            // Re-fetch instance after modifying component properties (Figma may invalidate refs)
            const inst = await figma.getNodeByIdAsync(result.id) as InstanceNode | null;
            if (inst) {
              inst.componentPropertyReferences = { ...inst.componentPropertyReferences, mainComponent: swapKey };
            }
          }
        }
      }

      if (result.hints) hints.push(...result.hints);
    } else if (child.type === "component") {
      if (!child.name) {
        hints.push({ type: "error", message: "Inline component child requires name." });
        continue;
      }
      const result = await createComponentSingle({
        ...child,
        parentId: appendTo.id,
      });
      if (result.hints) hints.push(...result.hints);
    } else {
      hints.push({ type: "error", message: `Inline child type '${child.type}' not supported. Use 'text', 'frame', 'instance', or 'component'.` });
    }
  }
}

// -- components handlers --

async function createComponentSingle(p: any) {
  if (!p.name) throw new Error("Missing name");

  const hints: Hint[] = [];

  // Validate inline children BEFORE creating any Figma nodes.
  if (p.children?.length) {
    const originalParams = p._originalParams;
    delete p._originalParams;

    normalizeInlineChildTypes(p.children);
    const validation = validateAndFixInlineChildren(p, hints);

    if (validation.hasAmbiguity) {
      const diff = formatDiff(validation.inferences);
      const correctedPayload = buildCorrectedPayload(p, originalParams);
      const canEdit = p._caps?.edit;

      // Edit-tier: auto-stage
      if (canEdit) {
        const stageFrame = await createStageContainer(p, p.name);
        try {
          const stagedP = { ...p, parentId: stageFrame.id, x: undefined, y: undefined };
          const comp = figma.createComponent();
          comp.name = p.name;
          if (p.description) comp.description = p.description;
          const { hints: setupHints } = await setupFrameNode(comp, stagedP);
          hints.push(...setupHints);
          if (p.children?.length) {
            const textChildren = collectTextChildren(p.children);
            const textCtx = await prepCreateText({ items: textChildren });
            await createInlineChildren(comp, comp, p.children, hints, textCtx);
          }
          return { id: stageFrame.id, status: "staged", diff, correctedPayload, hints };
        } catch (e) {
          stageFrame.remove();
          throw e;
        }
      }

      // Create-tier: reject
      return {
        error: `Ambiguous layout intent detected — review the diff and re-create with the corrected payload.`,
        diff,
        correctedPayload,
      };
    }
  }

  const comp = figma.createComponent();
  try {
    comp.name = p.name;
    if (p.description) comp.description = p.description;

    const { hints: setupHints } = await setupFrameNode(comp, p);
    hints.push(...setupHints);

    // Create inline children after setup (Figma node is now configured)
    if (p.children?.length) {
      const textChildren = collectTextChildren(p.children);
      const textCtx = await prepCreateText({ items: textChildren });
      await createInlineChildren(comp, comp, p.children, hints, textCtx);
    }

    // Add explicit component properties if provided
    if (p.properties?.length) {
      for (const prop of p.properties) {
        // Skip TEXT properties that were already auto-created by inline children
        if (prop.type === "TEXT") {
          const existing = resolveComponentPropertyKey(comp.componentPropertyDefinitions, prop.propertyName);
          if (existing) continue;
        }
        const options = prop.preferredValues ? { preferredValues: prop.preferredValues } : undefined;
        comp.addComponentProperty(prop.propertyName, prop.type, prop.defaultValue, options);
      }
      // Auto-bind TEXT properties to matching text children by name
      const textNodes = findTextNodes(comp, true);
      const defs = comp.componentPropertyDefinitions;
      for (const prop of p.properties) {
        if (prop.type !== "TEXT") continue;
        const key = resolveComponentPropertyKey(defs, prop.propertyName);
        if (!key) continue;
        const match = textNodes.find(t => t.name.toLowerCase() === prop.propertyName.toLowerCase());
        if (match && !(match as any).componentPropertyReferences?.characters) {
          (match as any).componentPropertyReferences = { characters: key };
        }
      }
    }

    // Post-children checks: single findTextNodes traversal for both warnings
    // Skip warnUnboundText if inline children were used — createTextSingle already warned per-node
    if (!p.children?.length) {
      warnUnboundText(comp, hints);
    }

    // Warn if component has text children but no width constraint
    if (comp.layoutMode !== "NONE" && comp.layoutSizingHorizontal === "HUG" && comp.layoutSizingVertical === "HUG" && !isSmallIntrinsic(comp)) {
      const allText = findTextNodes(comp, true);
      if (allText.length > 0 && allText.some(t => (t.characters?.length ?? 0) > 20)) {
        hints.push({ type: "warn", message: `"${comp.name}" has text content but no width constraint — text won't wrap. Set a width and layoutSizingHorizontal:"FIXED".` });
      }
    }

    const result: any = { id: comp.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    comp.remove();
    throw e;
  }
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
  if (p.name) comp.name = p.name;

  const hints: Hint[] = [];
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
  if (hints.length > 0) result.hints = hints;
  return result;
}

/**
 * Validate that inline variant children all have compatible shapes.
 * "Shape" = sorted set of {name, type} from the children definition.
 * Rejects non-component types and mismatched structures.
 */
function validateVariantChildren(children: any[]): void {
  // All children must be type: "component"
  const invalid = children.filter(c => c.type !== "component");
  if (invalid.length > 0) {
    const types = [...new Set(invalid.map(c => c.type || "undefined"))].join(", ");
    throw new Error(`Variant set children must all be type:"component". Found: ${types}. Use components(method:"create", type:"component") for non-variant children.`);
  }

  // All must have names
  const unnamed = children.filter(c => !c.name);
  if (unnamed.length > 0) {
    throw new Error(`All variant components require a name.`);
  }

  // Validate consistent child shape across variants.
  // Shape = sorted set of {type, name} — uses explicit name or componentPropertyName,
  // NOT text content (which varies between variants and would always mismatch).
  function childShape(c: any): string {
    const kids = c.children || [];
    const shape = kids.map((k: any) => {
      const type = k.type || "unknown";
      // For shape matching: explicit name > componentPropertyName > positional type.
      // Deliberately exclude k.text — text content differs between variants by design.
      const name = k.name || k.componentPropertyName || type;
      return `${type}:${name}`;
    }).sort();
    return shape.join("|");
  }

  const shapes = children.map(c => ({ name: c.name, shape: childShape(c) }));
  const firstShape = shapes[0].shape;
  const mismatched = shapes.filter(s => s.shape !== firstShape);
  if (mismatched.length > 0) {
    throw new Error(
      `Variant components must have the same child structure. "${shapes[0].name}" has [${firstShape.replace(/\|/g, ", ")}] but "${mismatched[0].name}" has [${mismatched[0].shape.replace(/\|/g, ", ")}]. ` +
      `Ensure all variants define the same children with the same names. ` +
      `Tip: set explicit "name" on each child, or use "componentPropertyName" — text content alone is not used for matching.`
    );
  }
}

async function combineSingle(p: any) {
  // Accept nodeIds as alias for componentIds (consistent with group/boolean_operation)
  if (!p.componentIds && p.nodeIds) p.componentIds = p.nodeIds;

  // children = inline variant definitions, componentIds = existing components — mutually exclusive
  if (p.children?.length && p.componentIds?.length) {
    throw new Error("Cannot use both children and componentIds. Use children to define variants inline, or componentIds to combine existing components.");
  }

  // Inline variant creation path
  if (p.children?.length) {
    normalizeInlineChildTypes(p.children);
    validateVariantChildren(p.children);
    if (p.children.length < 2) throw new Error("Need at least 2 variant components in children.");

    // Create each variant component
    const compIds: string[] = [];
    const hints: Hint[] = [];
    for (const child of p.children) {
      child._skipOverlapCheck = true; // transient — will be combined into variant set
      const result = await createComponentSingle(child);
      if (!result.id) throw new Error(`Failed to create variant component "${child.name}"`);
      compIds.push(result.id);
      if (result.hints) hints.push(...result.hints);
    }
    // Delegate to the existing combine path with created component IDs
    const { children: _, ...rest } = p;
    return combineSingle({ ...rest, componentIds: compIds, _inlineHints: hints });
  }

  if (!p.componentIds?.length || p.componentIds.length < 2) throw new Error("Provide either componentIds (min 2 existing component IDs) or children (min 2 inline variant components).");
  const comps: ComponentNode[] = [];
  for (const id of p.componentIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Component not found: ${id}`);
    if (node.type !== "COMPONENT") throw new Error(`Node ${id} is not a COMPONENT`);
    comps.push(node as ComponentNode);
  }
  // Pre-flight: check for stale property references that cause combineAsVariants to produce errored sets
  for (const comp of comps) {
    try {
      const defs = comp.componentPropertyDefinitions;
      for (const [key, def] of Object.entries(defs) as [string, any][]) {
        if (def.type === "TEXT") {
          // Verify the referenced text node still exists by checking property references
          let bound = false;
          const walk = (n: SceneNode) => {
            if ("componentPropertyReferences" in n) {
              const refs = (n as any).componentPropertyReferences;
              if (refs && Object.values(refs).includes(key)) bound = true;
            }
            if ("children" in n) (n as any).children.forEach(walk);
          };
          walk(comp);
          if (!bound) {
            throw new Error(`Component "${comp.name}" has stale TEXT property "${key.split("#")[0]}" — no text node references it. Delete it first: components(method:"update", items:[{id:"${comp.id}", action:"delete", propertyName:"${key.split("#")[0]}"}])`);
          }
        }
      }
    } catch (e: any) {
      if (e.message.includes("stale TEXT property")) throw e;
      // componentPropertyDefinitions may throw on variant components — skip
    }
  }

  const parent = comps[0].parent && comps.every(c => c.parent === comps[0].parent)
    ? comps[0].parent : figma.currentPage;
  const set = figma.combineAsVariants(comps, parent as any);
  if (p.name) set.name = p.name;
  // Reset combineAsVariants' defaults so setupFrameNode applies cleanly
  set.layoutMode = "NONE";
  set.cornerRadius = 0;

  // setupFrameNode handles x/y, fills reset, normalizeAliases, and all layout/styling
  const { hints } = await setupFrameNode(set as any, p);

  // Carry forward hints from inline variant creation
  if (p._inlineHints?.length) hints.push(...p._inlineHints);

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
        hints.push({ type: "error", message: `Failed to rename variant property "${autoKey}" to "${p.variantPropertyName}": ${e.message}` });
      }
    } else if (variantKeys.length === 0) {
      hints.push({ type: "error", message: `No VARIANT properties found to rename.` });
    } else {
      hints.push({ type: "warn", message: `Multiple variant properties found (${variantKeys.join(", ")}). Cannot auto-rename — use components(method:"update", action:"edit") to rename each.` });
    }
  }

  // Check for unbound text nodes across all variants
  const unboundCount = comps.reduce((n, c) => {
    return n + findTextNodes(c).filter(t => !(t as any).componentPropertyReferences?.characters).length;
  }, 0);
  const result: any = { id: set.id };
  if (unboundCount > 0) {
    hints.push({ type: "suggest", message: `${unboundCount} text node${unboundCount > 1 ? "s" : ""} across variants not exposed as properties — instances cannot edit this text via properties. Fix: components(method:"update", items:[{id:"${set.id}", propertyName:"<textNodeName>", type:"TEXT", defaultValue:"<text>"}]) then bind via text/frames(method:"update", items:[{id:"<textNodeId>", componentPropertyName:"<propName>"}])` });
  }
  if (hints.length > 0) result.hints = hints;
  return result;
}

// Extend variant_set guard to accept nodeIds as alias for componentIds
const VARIANT_SET_KEYS = new Set([...componentsCreateVariantSet, "nodeIds"]) as ReadonlySet<string>;

async function createSlotSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.componentId);
  if (!node) throw new Error(`Component not found: ${p.componentId}`);
  if (node.type !== "COMPONENT") throw new Error(`Node ${p.componentId} is ${node.type}, not a COMPONENT`);
  const slot = (node as ComponentNode).createSlot();
  if (p.name) slot.name = p.name;
  return { id: slot.id };
}

async function createComponentDispatch(params: any) {
  switch (params.type) {
    case "component": return batchHandler(params, createComponentSingle, { keys: componentsCreateComponent, help: 'components(method: "help", topic: "create")' });
    case "from_node": return batchHandler(params, fromNodeSingle, { keys: componentsCreateFromNode, help: 'components(method: "help", topic: "create")' });
    case "variant_set": return batchHandler(params, combineSingle, { keys: VARIANT_SET_KEYS, help: 'components(method: "help", topic: "create")' });
    case "slot": return batchHandler(params, createSlotSingle);
    default: throw new Error(`Unknown create type: ${params.type}`);
  }
}

async function getComponentFigma(params: any) {
  const depth = params.depth;
  const verbose = params.verbose === true;

  // Resolve target nodes: by names (batch) or id (single)
  const names: string[] | undefined = params.names;
  let targets: { node: any; error?: string; name?: string }[] = [];

  if (names?.length) {
    await figma.loadAllPagesAsync();
    const all = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] as any })
      .filter((c: any) => !c.remote)
      .filter((c: any) => !(c.type === "COMPONENT" && c.parent?.type === "COMPONENT_SET"));
    for (const name of names) {
      const nameLower = name.toLowerCase();
      const match = all.find((c: any) => c.name.toLowerCase() === nameLower)
        || all.find((c: any) => c.name.toLowerCase().includes(nameLower));
      if (!match) { targets.push({ node: null, error: `Not found`, name }); continue; }
      targets.push({ node: match });
    }
  } else {
    const node = await figma.getNodeByIdAsync(params.id);
    if (!node) throw new Error(`Component not found: ${params.id}`);
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Not a component: ${node.type}`);
    if ((node as any).remote) throw new Error(`Component "${node.name}" is from an external library. To customize: components(method:"clone", id:"<instanceId>") to clone the library component into a local copy, then edit the new local component.`);
    targets.push({ node });
  }

  // Without depth: return property summary (backward compatible)
  if (depth === undefined) {
    const results = targets.map(t => {
      if (!t.node) return { name: t.name, error: t.error };
      return serializeComponentSummary(t.node);
    });
    return { results };
  }

  // With depth: full node tree (same as frames.get) + component properties merged in
  const { serializeNode, DEFAULT_NODE_BUDGET } = await import("../utils/serialize-node");
  const budget = { remaining: DEFAULT_NODE_BUDGET };
  const results: any[] = [];
  for (const t of targets) {
    if (!t.node) { results.push({ name: t.name, error: t.error }); continue; }
    try {
      const serialized = await serializeNode(t.node, depth, 0, budget, verbose);
      // Merge component property definitions into the serialized tree (may fail on corrupted sets)
      const summary = serializeComponentSummary(t.node);
      if (summary.properties) serialized.properties = summary.properties;
      if (summary._error) serialized._error = summary._error;
      results.push(serialized);
    } catch {
      // Corrupted component set — return degraded result with what we can read
      const degraded: any = { id: t.node.id, name: t.node.name, type: t.node.type };
      if ("children" in t.node) {
        degraded.children = (t.node as any).children.map((c: any) => ({ id: c.id, name: c.name, type: c.type }));
      }
      degraded._error = `Component set has duplicate variant value combinations — property definitions unavailable.`;
      results.push(degraded);
    }
  }
  const out: any = { results };
  if (budget.remaining <= 0) { out._truncated = true; }
  return out;
}

function serializeComponentSummary(node: any): any {
  const out: any = { id: node.id, name: node.name };
  if (node.description) out.description = node.description;
  try {
    const defs = node.componentPropertyDefinitions;
    if (defs && Object.keys(defs).length > 0) {
      const props: Record<string, any> = {};
      for (const [key, def] of Object.entries(defs) as [string, any][]) {
        const clean = key.indexOf("#") > 0 ? key.slice(0, key.indexOf("#")) : key;
        const p: any = { type: def.type };
        if (def.defaultValue !== undefined) p.defaultValue = def.defaultValue;
        if (def.type === "VARIANT" && def.variantOptions) p.options = def.variantOptions;
        props[clean] = p;
      }
      out.properties = props;
    }
  } catch {
    out._error = `Component set "${node.name}" has duplicate variant value combinations — Figma's Plugin API cannot read property definitions in this state. Fix the conflicting variant names in Figma to restore access.`;
  }
  return out;
}

async function listComponentsFigma(params: any) {
  await figma.loadAllPagesAsync();
  let components = figma.root.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] as any })
    .filter((c: any) => !c.remote)
    .filter((c: any) => {
      if (c.type === "COMPONENT" && c.parent?.type === "COMPONENT_SET") return false;
      if (c.name.startsWith("_")) return false;
      return true;
    });
  const nameFilter = params?.query ?? params?.name;
  if (nameFilter) {
    const f = nameFilter.toLowerCase();
    components = components.filter((c: any) => c.name.toLowerCase().includes(f));
  }
  const paged = paginate(components, params.offset, params.limit);
  const items = paged.items.map((c: any) => c.name);
  return { ...paged, items };
}

async function updateComponentPropertySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Node ${p.id} is a ${node.type}, not a COMPONENT or COMPONENT_SET.`);
  if ((node as any).remote) throw new Error(`Component "${node.name}" is from an external library. Clone it first with components(method:"clone", id:"<instanceId>") to get a local copy.`);
  const comp = node as any;

  // Resolve property name with prefix matching (agents may omit the #suffix)
  function resolveKey(name: string): string {
    return resolveComponentPropertyKey(comp.componentPropertyDefinitions, name) ?? name;
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
  const key = resolveComponentPropertyKey(comp.componentPropertyDefinitions, p.propertyName);
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

// -- audit handler --

/** Collect all text nodes in a subtree with their layer path. */
function collectTextWithPath(node: BaseNode, path: string, skipInstances: boolean): Array<{ node: TextNode; path: string }> {
  if (node.type === "TEXT") return [{ node: node as TextNode, path }];
  if (skipInstances && node.type === "INSTANCE") return [];
  if ("children" in node) {
    const result: Array<{ node: TextNode; path: string }> = [];
    for (const child of (node as any).children) {
      result.push(...collectTextWithPath(child, path ? `${path} > ${child.name}` : child.name, skipInstances));
    }
    return result;
  }
  return [];
}

/**
 * Audit a component's property bindings.
 * Exported so lint can reuse the core logic.
 */
export function auditComponentBindings(comp: ComponentNode | ComponentSetNode) {
  // For component sets, audit each variant; property defs live on the set
  const defOwner = comp.type === "COMPONENT" && comp.parent?.type === "COMPONENT_SET"
    ? comp.parent as ComponentSetNode : comp;
  const defs = defOwner.componentPropertyDefinitions;

  // All TEXT property keys
  const textPropKeys = Object.keys(defs).filter(k => defs[k].type === "TEXT");

  // Collect all text nodes across component(s)
  const roots = comp.type === "COMPONENT_SET"
    ? (comp as ComponentSetNode).children.filter((c: any) => c.type === "COMPONENT") as ComponentNode[]
    : [comp as ComponentNode];

  const allTextEntries: Array<{ node: TextNode; path: string; root: ComponentNode }> = [];
  for (const root of roots) {
    allTextEntries.push(...collectTextWithPath(root, "", true).map(e => ({ ...e, root })));
  }

  // Which property keys are actually bound to a text node?
  const boundKeys = new Set<string>();
  for (const { node } of allTextEntries) {
    const refs = (node as any).componentPropertyReferences;
    if (refs?.characters) boundKeys.add(refs.characters);
  }

  // 1. Unbound text: text nodes with no componentPropertyReferences.characters
  const unboundText = allTextEntries
    .filter(({ node }) => {
      const refs = (node as any).componentPropertyReferences;
      return !refs?.characters;
    })
    .map(({ node }) => ({
      id: node.id,
      name: node.name,
      characters: node.characters?.slice(0, 80),
    }));

  // 2. Orphaned properties: TEXT properties not bound to any node
  const orphanedProperties = textPropKeys
    .filter(k => !boundKeys.has(k))
    .map(k => ({
      key: k,
      name: k.split("#")[0],
      defaultValue: String(defs[k].defaultValue ?? ""),
    }));

  // 3. Unbound nested: text nodes inside child frames (depth > 1) that aren't bound
  const unboundNested = allTextEntries
    .filter(({ node, path }) => {
      const refs = (node as any).componentPropertyReferences;
      return !refs?.characters && path.includes(" > ");
    })
    .map(({ node, path }) => ({
      id: node.id,
      name: node.name,
      characters: node.characters?.slice(0, 80),
      path,
    }));

  // Dedup nested from unboundText would be redundant — nested is a subset for information
  // Keep both lists since they serve different purposes (flat list vs path-aware)

  const issues = unboundText.length + orphanedProperties.length;
  const summary = issues === 0
    ? "All TEXT properties are bound and all text nodes are connected."
    : `Found ${unboundText.length} unbound text node${unboundText.length !== 1 ? "s" : ""}, ${orphanedProperties.length} orphaned propert${orphanedProperties.length !== 1 ? "ies" : "y"}.`;

  return { unboundText, orphanedProperties, unboundNested, summary };
}

async function auditComponentFigma(params: any) {
  const node = await figma.getNodeByIdAsync(params.id);
  if (!node) throw new Error(`Component not found: ${params.id}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") throw new Error(`Not a component: ${node.type}`);

  // Run lint (frames.audit base), then replace lint's component-bindings with our own richer check
  const lintResult = await auditNode({ nodeId: params.id, rules: params.rules, maxDepth: params.maxDepth, maxFindings: params.maxFindings });
  lintResult.categories = lintResult.categories.filter((c: any) => c.rule !== "component-bindings");

  const bindings = auditComponentBindings(node as ComponentNode | ComponentSetNode);
  if (bindings.unboundText.length > 0 || bindings.orphanedProperties.length > 0) {
    const bindingNodes: any[] = [];
    for (const t of bindings.unboundText) {
      bindingNodes.push({ id: t.id, name: t.name, issue: "unbound-text", characters: t.characters });
    }
    for (const p of bindings.orphanedProperties) {
      bindingNodes.push({ id: node.id, name: node.name, severity: "unsafe", issue: "orphaned-property", propertyKey: p.key, propertyName: p.name });
    }
    for (const n of bindings.unboundNested) {
      bindingNodes.push({ id: n.id, name: n.name, severity: "style", issue: "unexposed-nested", path: n.path, characters: n.characters });
    }
    lintResult.categories.push({
      rule: "component-bindings",
      severity: "heuristic",
      category: "component",
      count: bindingNodes.length,
      fix: 'Bind text nodes to properties or delete orphaned ones. guidelines(topic:"component-structure") for details.',
      nodes: bindingNodes,
    });
  }

  return lintResult;
}

// -- instances handlers --

async function instanceCreateSingle(p: any) {
  let node: any;
  if (p.componentKey) {
    // Explicit library key (rare escape hatch). Preferred path: agent calls
    // componentKey is resolved from the library registry by the MCP pre-processor.
    try {
      node = await figma.importComponentByKeyAsync(p.componentKey);
    } catch (err: any) {
      try {
        node = await figma.importComponentSetByKeyAsync(p.componentKey);
      } catch {
        throw new Error(`Could not import by componentKey "${p.componentKey}": ${err?.message || err}. Ensure the source library is enabled for this file.`);
      }
    }
  } else {
    if (!p.componentId) throw new Error(`Missing componentId (local node) or componentKey (published library).`);
    node = await figma.getNodeByIdAsync(p.componentId);
    if (!node) {
      await figma.loadAllPagesAsync();
      node = await figma.getNodeByIdAsync(p.componentId);
    }
    if (!node) throw new Error(`Component not found: ${p.componentId}`);
  }
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

  const hints: Hint[] = [];
  await applyTokens(inst, { opacity: p.opacity }, hints);

  // Min/max constraints
  if (p.minWidth !== undefined) (inst as any).minWidth = p.minWidth;
  if (p.maxWidth !== undefined) (inst as any).maxWidth = p.maxWidth;
  if (p.minHeight !== undefined) (inst as any).minHeight = p.minHeight;
  if (p.maxHeight !== undefined) (inst as any).maxHeight = p.maxHeight;

  // sizing:"contextual" → infer FILL/HUG from parent context (like frames do)
  // Default: inherit from component (no auto-default) for backward compat
  const autoSizing = p.sizing === "contextual";
  const parent = await appendAndApplySizing(inst, p, hints, autoSizing);
  checkOverlappingSiblings(inst, parent, hints);

  if (p.explicitMode) {
    const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
    const em = p.explicitMode;
    let collection: any;
    let modeId: string;
    if (em.collectionName) {
      const cName = em.collectionName.toLowerCase();
      collection = allCollections.find((c: any) => c.name.toLowerCase() === cName);
      if (!collection) hints.push({ type: "error", message: `explicitMode: collection "${em.collectionName}" not found. Available: ${allCollections.map((c: any) => c.name).join(", ")}` });
    } else if (em.collectionId) {
      collection = allCollections.find((c: any) => c.id === em.collectionId);
      if (!collection) hints.push({ type: "error", message: `explicitMode: collection ID "${em.collectionId}" not found.` });
    }
    if (collection) {
      if (em.modeName) {
        const mName = em.modeName.toLowerCase();
        const mode = collection.modes.find((m: any) => m.name.toLowerCase() === mName);
        if (!mode) hints.push({ type: "error", message: `explicitMode: mode "${em.modeName}" not found in "${collection.name}". Available: ${collection.modes.map((m: any) => m.name).join(", ")}` });
        else modeId = mode.modeId;
      } else {
        modeId = em.modeId;
      }
      if (modeId!) {
        try { (inst as any).setExplicitVariableModeForCollection(collection, modeId); }
        catch (e: any) { hints.push({ type: "error", message: `explicitMode failed: ${e.message}` }); }
      }
    }
  }

  const props = p.properties ?? p.componentProperties;
  if (props && typeof props === "object" && Object.keys(props).length > 0) {
    await instanceUpdateComponentProps(inst, props);
  }

  const result: any = { id: inst.id };
  if (hints.length > 0) result.hints = hints;
  return result;
}

async function instanceGetFigma(params: any) {
  const { serializeNode, DEFAULT_NODE_BUDGET } = await import("../utils/serialize-node");
  const node = await figma.getNodeByIdAsync(params.id);
  if (!node) throw new Error(`Instance not found: ${params.id}`);
  if (node.type !== "INSTANCE") throw new Error("Node is not an instance");
  const depth = params.depth !== undefined ? params.depth : 0;
  const verbose = params.verbose === true;
  const budget = { remaining: DEFAULT_NODE_BUDGET };
  const serialized = await serializeNode(node, depth, 0, budget, verbose);
  const out: any = { results: [serialized] };
  if (budget.remaining <= 0) { out._truncated = true; }
  return out;
}

/** Update component properties on an instance (key→value map). Exported for combined handler. */
export async function instanceUpdateComponentProps(inst: InstanceNode, props: Record<string, any>): Promise<void> {
  // Resolve partial property keys: "Label" → "Label#2:33"
  // Agents often don't know the full key suffix — match by prefix.
  const resolvedProps: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    resolvedProps[resolveComponentPropertyKey(inst.componentProperties, key) ?? key] = value;
  }
  inst.setProperties(resolvedProps);
}

async function instanceUpdateSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.id);
  if (!node) throw new Error(`Node not found: ${p.id}`);
  if (node.type !== "INSTANCE") throw new Error(`Node ${p.id} is ${node.type}, not an INSTANCE`);
  const inst = node as InstanceNode;
  // Accept both "properties" and "componentProperties" (mirrors instances.get response shape)
  const props = p.properties ?? p.componentProperties;
  if (!props || typeof props !== "object") throw new Error(`Missing 'properties' — pass a key→value map, e.g. {"Label#1:0":"text"}`);
  await instanceUpdateComponentProps(inst, props);
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

// ─── Combined Instance Update (visual + component properties) ────

import { patchSingleNode, hasAny, TEXT_KEYS } from "./patch-nodes";
import { prepSetTextProperties } from "./text";

// Visual keys derived from generated nodeUpdate guard — single source of truth
const VISUAL_KEYS = [...nodeUpdate];

/**
 * Combined instances.update handler: supports visual PatchItem params AND component properties.
 * Falls through to the component property dispatcher if no visual keys are present.
 */
export async function instanceUpdateCombined(p: any): Promise<any> {
  const items = p.items || [p];
  const anyVisual = items.some((item: any) => VISUAL_KEYS.some(k => item[k] !== undefined));

  if (!anyVisual) {
    // Pure component property update — use the existing dispatcher
    return batchHandler(p, instanceUpdateSingle, { keys: instancesUpdate, help: 'instances(method: "help", topic: "update")' });
  }

  // Prep text context if needed
  let textCtx: any = null;
  const textItems = items.filter((item: any) => hasAny(item, TEXT_KEYS));
  if (textItems.length > 0) {
    const syntheticItems = textItems.map((item: any) => ({
      nodeId: item.id,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      fontStyle: item.fontStyle,
      fontWeight: item.fontWeight,
      textStyleId: item.textStyleId,
      textStyleName: item.textStyleName,
    }));
    textCtx = await prepSetTextProperties({ items: syntheticItems });
  }

  return batchHandler(p, async (item: any) => {
    const result: any = {};
    const hints: Hint[] = [];

    // 1. Visual PatchItem update
    const hasVisual = VISUAL_KEYS.some(k => item[k] !== undefined);
    if (hasVisual) {
      // Strip component property keys — "properties" means escape hatch in PatchItem
      // but component properties in instances. Don't let patchSingleNode misinterpret them.
      const { properties: _cp, componentProperties: _ccp, ...visualItem } = item;
      const patchItem = { ...visualItem, nodeId: item.nodeId ?? item.id };
      const r = await patchSingleNode(patchItem, textCtx);
      if (r.hints) hints.push(...r.hints);
      Object.assign(result, r);
      delete result.hints;
    }

    // 2. Component property update
    const props = item.properties ?? item.componentProperties;
    if (props && typeof props === "object") {
      const node = await figma.getNodeByIdAsync(item.id);
      if (!node) throw new Error(`Node not found: ${item.id}`);
      if (node.type !== "INSTANCE") throw new Error(`Node ${item.id} is ${node.type}, not an INSTANCE`);
      await instanceUpdateComponentProps(node as InstanceNode, props);
    }

    if (hints.length > 0) result.hints = hints;
    return result;
  }, { keys: instancesUpdate, help: 'instances(method: "help", topic: "update")' });
}

// ─── Handler Exports ─────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  components: createDispatcher({
    create: createComponentDispatch,
    get: getComponentFigma,
    list: listComponentsFigma,
    update: (p) => batchHandler(p, updateComponentPropertySingle, { keys: componentsUpdate, help: 'components(method: "help", topic: "update")' }),
    audit: auditComponentFigma,
    delete: (p) => batchHandler(p, deleteComponentSingle),
  }),
  instances: createDispatcher({
    create: (p) => batchHandler(p, instanceCreateSingle, { keys: instancesCreate, help: 'instances(method: "help", topic: "create")' }),
    get: instanceGetFigma,
    update: (p) => batchHandler(p, instanceUpdateSingle, { keys: instancesUpdate, help: 'instances(method: "help", topic: "update")' }),
    swap: (p) => batchHandler(p, instanceSwapSingle, { keys: instancesSwap, help: 'instances(method: "help", topic: "swap")' }),
    detach: (p) => batchHandler(p, instanceDetachSingle, { keys: instancesDetach, help: 'instances(method: "help", topic: "detach")' }),
    reset_overrides: (p) => batchHandler(p, instanceResetOverridesSingle, { keys: instancesResetOverrides, help: 'instances(method: "help", topic: "reset_overrides")' }),
  }),
};
