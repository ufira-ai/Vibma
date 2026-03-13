import { batchHandler, findVariableById, findVariableByName, type Hint } from "./helpers";
import { setFillSingle, setStrokeSingle, setCornerSingle, setOpacitySingle } from "./fill-stroke";
import { setEffectsSingle, setConstraintsSingle, setExportSettingsSingle, setNodePropertiesSingle } from "./effects";
import { moveSingle, resizeSingle } from "./modify-node";
import { updateFrameSingle } from "./update-frame";
import { prepSetTextProperties, setTextPropertiesSingle } from "./text";
import type { TextPropsContext } from "./text";
import { nodeUpdate, mixinTextParams } from "@ufira/vibma/guards";

// ─── Sub-dispatch groups (handler-level concern, not schema validation) ────

const SIMPLE_PROPS = ["name", "visible", "locked", "rotation", "blendMode", "layoutPositioning"] as const;

const FILL_KEYS = ["fills", "fillColor", "fillStyleName", "fillVariableName", "clearFill"] as const;

const STROKE_KEYS = ["strokes", "strokeColor", "strokeStyleName", "strokeVariableName", "strokeWeight",
  "strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"] as const;

const CORNER_KEYS = ["cornerRadius", "topLeftRadius", "topRightRadius",
  "bottomRightRadius", "bottomLeftRadius"] as const;

const EFFECT_KEYS = ["effects", "effectStyleName"] as const;

const LAYOUT_KEYS = ["layoutMode", "layoutWrap", "padding",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "primaryAxisAlignItems", "counterAxisAlignItems",
  "layoutSizingHorizontal", "layoutSizingVertical",
  "itemSpacing", "counterAxisSpacing"] as const;

export const TEXT_KEYS = [...mixinTextParams] as string[];

// Validation set: schema-generated + handler-level extensions
const ALL_KNOWN = new Set<string>([
  ...nodeUpdate,
  "nodeId",              // handler alias for id
  "componentProperties", // instance handler extension
]);

export function hasAny(item: any, keys: readonly string[]): boolean {
  return keys.some(k => item[k] !== undefined);
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function doResize(item: any): Promise<void> {
  let w = item.width;
  let h = item.height;
  if (w === undefined || h === undefined) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    if ("width" in node && "height" in node) {
      w = w ?? (node as any).width;
      h = h ?? (node as any).height;
    } else {
      throw new Error(`Node does not support resize: ${item.nodeId}`);
    }
  }
  await resizeSingle({ nodeId: item.nodeId, width: w, height: h });
}

export async function patchSingleNode(item: any, textCtx: TextPropsContext | null): Promise<any> {
  const result: any = {};
  const hints: Hint[] = [];

  /** Collect hints from a sub-handler result */
  function collectHints(r: any) {
    if (r?.hints) hints.push(...(r.hints as Hint[]));
  }

  // 1. Simple scalar properties
  const simpleUpdates = SIMPLE_PROPS.filter(k => item[k] !== undefined);
  const sizeConstraints = (["minWidth", "maxWidth", "minHeight", "maxHeight"] as const).filter(k => item[k] !== undefined);
  if (simpleUpdates.length > 0 || sizeConstraints.length > 0) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    for (const key of [...simpleUpdates, ...sizeConstraints]) {
      if (key in node) (node as any)[key] = item[key];
      else hints.push({ type: "error", message: `Property '${key}' not supported on ${node.type}` });
    }
  }

  // 2. Geometry: move
  if (item.x !== undefined || item.y !== undefined) {
    await moveSingle({ nodeId: item.nodeId, x: item.x, y: item.y });
  }

  // 3. Padding shorthand expansion (before layout detection)
  if (item.padding !== undefined) {
    item.paddingTop ??= item.padding;
    item.paddingRight ??= item.padding;
    item.paddingBottom ??= item.padding;
    item.paddingLeft ??= item.padding;
  }

  // 4. Detect layout and resize deferral
  const hasLayout = hasAny(item, LAYOUT_KEYS);
  const needsResize = item.width !== undefined || item.height !== undefined;
  if (needsResize && !hasLayout) {
    await doResize(item);
  }

  // 5. Fill (fills is canonical — all aliases normalized by batchHandler)
  if (hasAny(item, FILL_KEYS)) {
    const r = await setFillSingle({
      nodeId: item.nodeId,
      fills: item.fills,
      clear: item.clearFill,
    });
    collectHints(r);
  }

  // 6. Stroke (strokes is canonical — all aliases normalized by batchHandler)
  if (hasAny(item, STROKE_KEYS)) {
    const r = await setStrokeSingle({
      nodeId: item.nodeId,
      strokes: item.strokes,
      strokeWeight: item.strokeWeight,
      strokeTopWeight: item.strokeTopWeight,
      strokeBottomWeight: item.strokeBottomWeight,
      strokeLeftWeight: item.strokeLeftWeight,
      strokeRightWeight: item.strokeRightWeight,
    });
    collectHints(r);
  }

  // 7. Corner radius (flat: cornerRadius, topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius)
  if (hasAny(item, CORNER_KEYS)) {
    const r = await setCornerSingle({
      nodeId: item.nodeId,
      radius: item.cornerRadius,
      topLeft: item.topLeftRadius,
      topRight: item.topRightRadius,
      bottomRight: item.bottomRightRadius,
      bottomLeft: item.bottomLeftRadius,
    });
    collectHints(r);
  }

  // 8. Opacity
  if (item.opacity !== undefined) {
    const r = await setOpacitySingle({ nodeId: item.nodeId, opacity: item.opacity });
    collectHints(r);
  }

  // 9. Effects (flat: effects, effectStyleName)
  if (hasAny(item, EFFECT_KEYS)) {
    const r = await setEffectsSingle({
      nodeId: item.nodeId,
      effects: item.effects,
      effectStyleName: item.effectStyleName,
    });
    if (r.matchedStyle) result.matchedEffectStyle = r.matchedStyle;
    collectHints(r);
  }

  // 10. Constraints
  if (item.constraints) {
    await setConstraintsSingle({ nodeId: item.nodeId, ...item.constraints });
  }

  // 11. Export settings
  if (item.exportSettings) {
    await setExportSettingsSingle({ nodeId: item.nodeId, settings: item.exportSettings });
  }

  // 12. Layout (flat: layoutMode, layoutWrap, paddingTop, ..., layoutSizingHorizontal, itemSpacing, ...)
  if (hasLayout) {
    const r = await updateFrameSingle({
      nodeId: item.nodeId,
      layoutMode: item.layoutMode,
      layoutWrap: item.layoutWrap,
      paddingTop: item.paddingTop,
      paddingRight: item.paddingRight,
      paddingBottom: item.paddingBottom,
      paddingLeft: item.paddingLeft,
      primaryAxisAlignItems: item.primaryAxisAlignItems,
      counterAxisAlignItems: item.counterAxisAlignItems,
      layoutSizingHorizontal: item.layoutSizingHorizontal,
      layoutSizingVertical: item.layoutSizingVertical,
      itemSpacing: item.itemSpacing,
      counterAxisSpacing: item.counterAxisSpacing,
    });
    collectHints(r);
  }

  // 12b. Deferred resize — after layout so sizing mode (FIXED/HUG/FILL) is set first
  if (needsResize && hasLayout) {
    await doResize(item);
  }

  // 13. Text (flat: fontSize, fontFamily, fontStyle, fontWeight, fills, ...)
  const hasText = hasAny(item, TEXT_KEYS);
  if (hasText && textCtx) {
    const r = await setTextPropertiesSingle({
      nodeId: item.nodeId,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      fontStyle: item.fontStyle,
      fontWeight: item.fontWeight,
      fills: item.fills,
      textStyleId: item.textStyleId,
      textStyleName: item.textStyleName,
      textAlignHorizontal: item.textAlignHorizontal,
      textAlignVertical: item.textAlignVertical,
      textAutoResize: item.textAutoResize,
    }, textCtx);
    collectHints(r);
  }

  // 14. Variable bindings
  if (item.bindings) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    for (const b of item.bindings) {
      const variable = b.variableName
        ? await findVariableByName(b.variableName)
        : await findVariableById(b.variableId);
      if (!variable) { hints.push({ type: "error", message: `Variable not found: ${b.variableName || b.variableId}` }); continue; }
      const paintMatch = b.field.match(/^(fills|strokes)\/(\d+)\/color$/);
      if (paintMatch) {
        const prop = paintMatch[1];
        const index = parseInt(paintMatch[2], 10);
        if (!(prop in node)) throw new Error(`Node does not have ${prop}`);
        const paints = (node as any)[prop].slice();
        // Auto-create default solid paints if index doesn't exist yet
        while (index >= paints.length) {
          paints.push({ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 1 });
        }
        paints[index] = figma.variables.setBoundVariableForPaint(paints[index], "color", variable);
        (node as any)[prop] = paints;
      } else if ("setBoundVariable" in node) {
        (node as any).setBoundVariable(b.field, variable);
      } else {
        hints.push({ type: "error", message: `Node does not support variable binding for field: ${b.field}` });
      }
    }
  }

  // 15. Explicit variable mode — accepts name-based ({ collectionName, modeName }) or ID-based ({ collectionId, modeId })
  if (item.explicitMode) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    if (!("setExplicitVariableModeForCollection" in node)) {
      hints.push({ type: "error", message: `Node ${item.nodeId} does not support explicit variable modes.` });
    } else {
      const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
      const em = item.explicitMode;
      let collection: any;
      let modeId: string;

      if (em.collectionName) {
        const cName = em.collectionName.toLowerCase();
        collection = allCollections.find((c: any) => c.name.toLowerCase() === cName);
        if (!collection) throw new Error(`Collection not found: "${em.collectionName}". Available: ${allCollections.map((c: any) => c.name).join(", ")}`);
      } else {
        collection = allCollections.find((c: any) => c.id === em.collectionId);
        if (!collection) throw new Error(`Collection not found: ${em.collectionId}. Available: ${allCollections.map((c: any) => `${c.name} (${c.id})`).join(", ")}`);
      }

      if (em.modeName) {
        const mName = em.modeName.toLowerCase();
        const mode = collection.modes.find((m: any) => m.name.toLowerCase() === mName);
        if (!mode) throw new Error(`Mode not found: "${em.modeName}" in collection "${collection.name}". Available: ${collection.modes.map((m: any) => m.name).join(", ")}`);
        modeId = mode.modeId;
      } else {
        modeId = em.modeId;
        if (!modeId) throw new Error(`explicitMode requires either modeName or modeId`);
      }

      (node as any).setExplicitVariableModeForCollection(collection, modeId);
    }
  }

  // 16. Properties escape hatch (last)
  if (item.properties) {
    await setNodePropertiesSingle({ nodeId: item.nodeId, properties: item.properties });
  }

  if (hints.length > 0) result.hints = hints;
  return result;
}

async function patchNodesBatch(params: any) {
  const items = params.items || [params];

  // Phase 1: Prep text context if any items have text params
  let textCtx: TextPropsContext | null = null;
  const textItems = items.filter((item: any) => hasAny(item, TEXT_KEYS));
  if (textItems.length > 0) {
    const syntheticItems = textItems.map((item: any) => ({
      nodeId: item.nodeId,
      fontSize: item.fontSize,
      fontFamily: item.fontFamily,
      fontStyle: item.fontStyle,
      fontWeight: item.fontWeight,
      textStyleId: item.textStyleId,
      textStyleName: item.textStyleName,
    }));
    textCtx = await prepSetTextProperties({ items: syntheticItems });
  }

  // Phase 2: Process each item
  return batchHandler(params, (item: any) => patchSingleNode(item, textCtx), { keys: ALL_KNOWN, help: 'frames(method: "help", topic: "update")' });
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  patch_nodes: patchNodesBatch,
};
