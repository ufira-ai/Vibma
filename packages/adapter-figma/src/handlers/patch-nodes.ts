import { batchHandler } from "./helpers";
import { setFillSingle, setStrokeSingle, setCornerSingle, setOpacitySingle } from "./fill-stroke";
import { setEffectsSingle, setConstraintsSingle, setExportSettingsSingle, setNodePropertiesSingle } from "./effects";
import { moveSingle, resizeSingle } from "./modify-node";
import { updateFrameSingle } from "./update-frame";
import { prepSetTextProperties, setTextPropertiesSingle } from "./text";
import type { TextPropsContext } from "./text";

// ─── Figma Handlers ──────────────────────────────────────────────

async function patchSingleNode(item: any, textCtx: TextPropsContext | null): Promise<any> {
  const result: any = {};

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

  // 12. Properties escape hatch (last)
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
