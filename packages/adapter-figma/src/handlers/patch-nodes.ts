import { batchHandler, findVariableById, findVariableByName } from "./helpers";
import { setFillSingle, setStrokeSingle, setCornerSingle, setOpacitySingle } from "./fill-stroke";
import { setEffectsSingle, setConstraintsSingle, setExportSettingsSingle, setNodePropertiesSingle } from "./effects";
import { moveSingle, resizeSingle } from "./modify-node";
import { updateFrameSingle } from "./update-frame";
import { prepSetTextProperties, setTextPropertiesSingle } from "./text";
import type { TextPropsContext } from "./text";

// ─── Figma Handlers ──────────────────────────────────────────────

const SIMPLE_PROPS = ["name", "visible", "locked", "rotation", "blendMode", "layoutPositioning",
  "minWidth", "maxWidth", "minHeight", "maxHeight"] as const;

async function patchSingleNode(item: any, textCtx: TextPropsContext | null): Promise<any> {
  const result: any = {};

  // 0. Simple scalar properties
  const simpleUpdates = SIMPLE_PROPS.filter(k => item[k] !== undefined);
  if (simpleUpdates.length > 0) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    for (const key of simpleUpdates) {
      if (key in node) (node as any)[key] = item[key];
      else result.warning = appendWarning(result.warning, `Property '${key}' not supported on ${node.type}`);
    }
  }

  // 1. Geometry: move
  if (item.x !== undefined || item.y !== undefined) {
    await moveSingle({ nodeId: item.nodeId, x: item.x, y: item.y });
  }

  // 2. Geometry: resize
  if (item.width !== undefined || item.height !== undefined) {
    if (item.width === undefined || item.height === undefined) {
      throw new Error("width and height must both be provided for resize");
    }
    await resizeSingle({ nodeId: item.nodeId, width: item.width, height: item.height });
  }

  // 3. Fill
  if (item.fill) {
    const r = await setFillSingle({ nodeId: item.nodeId, ...item.fill });
    if (r.matchedStyle) result.matchedFillStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 4. Stroke
  if (item.stroke) {
    const r = await setStrokeSingle({
      nodeId: item.nodeId,
      color: item.stroke.color,
      strokeWeight: item.stroke.weight,
      styleName: item.stroke.styleName,
      variableName: item.stroke.variableName,
      variableId: item.stroke.variableId,
      strokeTopWeight: item.stroke.strokeTopWeight,
      strokeBottomWeight: item.stroke.strokeBottomWeight,
      strokeLeftWeight: item.stroke.strokeLeftWeight,
      strokeRightWeight: item.stroke.strokeRightWeight,
    });
    if (r.matchedStyle) result.matchedStrokeStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 5. Corner radius
  if (item.cornerRadius) {
    await setCornerSingle({ nodeId: item.nodeId, ...item.cornerRadius });
  }

  // 6. Opacity
  if (item.opacity !== undefined) {
    await setOpacitySingle({ nodeId: item.nodeId, opacity: item.opacity });
  }

  // 7. Effects
  if (item.effects) {
    const r = await setEffectsSingle({
      nodeId: item.nodeId,
      effects: item.effects.effects,
      effectStyleName: item.effects.styleName,
    });
    if (r.matchedStyle) result.matchedEffectStyle = r.matchedStyle;
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 8. Constraints
  if (item.constraints) {
    await setConstraintsSingle({ nodeId: item.nodeId, ...item.constraints });
  }

  // 9. Export settings
  if (item.exportSettings) {
    await setExportSettingsSingle({ nodeId: item.nodeId, settings: item.exportSettings });
  }

  // 10. Layout
  if (item.layout) {
    await updateFrameSingle({ nodeId: item.nodeId, ...item.layout });
  }

  // 11. Text
  if (item.text && textCtx) {
    const r = await setTextPropertiesSingle({ nodeId: item.nodeId, ...item.text }, textCtx);
    if (r.warning) result.warning = appendWarning(result.warning, r.warning);
  }

  // 12. Variable bindings
  if (item.bindings) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    for (const b of item.bindings) {
      const variable = b.variableName
        ? await findVariableByName(b.variableName)
        : await findVariableById(b.variableId);
      if (!variable) { result.warning = appendWarning(result.warning, `Variable not found: ${b.variableName || b.variableId}`); continue; }
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
        result.warning = appendWarning(result.warning, `Node does not support variable binding for field: ${b.field}`);
      }
    }
  }

  // 13. Explicit variable mode
  if (item.explicitMode) {
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node) throw new Error(`Node not found: ${item.nodeId}`);
    if (!("setExplicitVariableModeForCollection" in node)) {
      result.warning = appendWarning(result.warning, `Node ${item.nodeId} does not support explicit variable modes.`);
    } else {
      const allCollections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = allCollections.find((c: any) => c.id === item.explicitMode.collectionId);
      if (!collection) throw new Error(`Collection not found: ${item.explicitMode.collectionId}`);
      (node as any).setExplicitVariableModeForCollection(collection, item.explicitMode.modeId);
    }
  }

  // 14. Properties escape hatch (last)
  if (item.properties) {
    await setNodePropertiesSingle({ nodeId: item.nodeId, properties: item.properties });
  }

  return result;
}

function appendWarning(existing: string | undefined, addition: string): string {
  return existing ? `${existing} ${addition}` : addition;
}

async function patchNodesBatch(params: any) {
  const items = params.items || [params];

  // Phase 1: Prep text context if any items have text sub-object
  let textCtx: TextPropsContext | null = null;
  const textItems = items.filter((item: any) => item.text);
  if (textItems.length > 0) {
    const syntheticItems = textItems.map((item: any) => ({
      nodeId: item.nodeId,
      ...item.text,
    }));
    textCtx = await prepSetTextProperties({ items: syntheticItems });
  }

  // Phase 2: Process each item
  return batchHandler(params, (item: any) => patchSingleNode(item, textCtx));
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  patch_nodes: patchNodesBatch,
};
