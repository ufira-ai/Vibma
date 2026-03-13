import { applyToken, applyTokens, applyFillWithAutoBind, applyStrokeWithAutoBind, batchHandler, coerceColor, solidPaint, type Hint } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

export async function setFillSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("fills" in node)) throw new Error(`Node does not support fills: ${p.nodeId}`);

  if (p.clear) {
    (node as any).fills = [];
    return {};
  }

  const hints: Hint[] = [];
  // Normalize to fills (same priority as batchHandler: variableName > styleName > color)
  let fills = p.fills;
  if (fills === undefined) {
    if (p.variableName) fills = { _variable: p.variableName };
    else if (p.variableId) fills = { _variableId: p.variableId };
    else if (p.styleName) fills = { _style: p.styleName };
    else if (p.color !== undefined) {
      const c = coerceColor(p.color);
      fills = c ? [solidPaint(c)] : p.color;
    }
  }
  await applyFillWithAutoBind(node, { fills }, hints);

  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export async function setStrokeSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("strokes" in node)) throw new Error(`Node does not support strokes: ${p.nodeId}`);

  const hints: Hint[] = [];
  // Normalize legacy flat params → strokes (canonical) if not already set
  let strokes = p.strokes;
  if (strokes === undefined) {
    if (p.variableName) strokes = { _variable: p.variableName };
    else if (p.variableId) strokes = { _variableId: p.variableId };
    else if (p.styleName) strokes = { _style: p.styleName };
    else if (p.color !== undefined) {
      const c = coerceColor(p.color);
      strokes = c ? [solidPaint(c)] : p.color;
    }
  }
  await applyStrokeWithAutoBind(node, {
    strokes,
    strokeWeight: p.strokeWeight,
    strokeTopWeight: p.strokeTopWeight,
    strokeBottomWeight: p.strokeBottomWeight,
    strokeLeftWeight: p.strokeLeftWeight,
    strokeRightWeight: p.strokeRightWeight,
  }, hints);

  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export async function setCornerSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("cornerRadius" in node)) throw new Error(`Node does not support corner radius: ${p.nodeId}`);

  const hints: Hint[] = [];

  // Map input params (topLeft, topRight, etc.) to Figma fields (topLeftRadius, etc.)
  const mapping = [
    ["topLeft", "topLeftRadius"],
    ["topRight", "topRightRadius"],
    ["bottomRight", "bottomRightRadius"],
    ["bottomLeft", "bottomLeftRadius"],
  ] as const;

  const hasPer = mapping.some(([key]) => p[key] !== undefined);

  if (hasPer && "topLeftRadius" in node) {
    const cornerFields: Record<string, number | string | undefined> = {};
    for (const [key, field] of mapping) {
      cornerFields[field] = p[key] ?? p.radius;
    }
    await applyTokens(node, cornerFields, hints);
  } else if (p.radius !== undefined) {
    if ("topLeftRadius" in node) {
      // Expand shorthand to all four corners
      const cornerFields: Record<string, number | string> = {};
      for (const [, field] of mapping) cornerFields[field] = p.radius;
      await applyTokens(node, cornerFields, hints);
    } else {
      // Node only supports single cornerRadius (e.g. non-rectangle)
      const bound = await applyToken(node, "cornerRadius", p.radius, hints);
      if (!bound && p.radius !== 0) {
        hints.push({ type: "suggest", message: `Hardcoded cornerRadius. Use an existing FLOAT variable or create one with variables(method:"create"), then pass the variable name string instead of a number.` });
      }
    }
  }

  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export async function setOpacitySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("opacity" in node)) throw new Error(`Node does not support opacity`);
  const hints: Hint[] = [];
  await applyTokens(node, { opacity: p.opacity }, hints);
  const result: any = {};
  if (hints.length > 0) result.hints = hints;
  return result;
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_fill_color: (p) => batchHandler(p, setFillSingle),
  set_stroke_color: (p) => batchHandler(p, setStrokeSingle),
  set_corner_radius: (p) => batchHandler(p, setCornerSingle),
  set_opacity: (p) => batchHandler(p, setOpacitySingle),
};
