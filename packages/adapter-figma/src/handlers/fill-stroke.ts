import { batchHandler, coerceColor, findVariableById, solidPaint, styleNotFoundHint, suggestStyleForColor } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

async function resolveStyle(name: string): Promise<{ match: { id: string; name: string } | null, available: string[] }> {
  const styles = await figma.getLocalPaintStylesAsync();
  const available = styles.map(s => s.name);
  const exact = styles.find(s => s.name === name);
  if (exact) return { match: { id: exact.id, name: exact.name }, available };
  const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  if (fuzzy) return { match: { id: fuzzy.id, name: fuzzy.name }, available };
  return { match: null, available };
}

export async function setFillSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("fills" in node)) throw new Error(`Node does not support fills: ${p.nodeId}`);

  if (p.clear) {
    (node as any).fills = [];
    return {};
  }

  if (p.variableId) {
    const v = await findVariableById(p.variableId);
    if (!v) throw new Error(`Fill variableId '${p.variableId}' not found`);
    const c = coerceColor(p.color) ?? { r: 0, g: 0, b: 0, a: 1 };
    (node as any).fills = [solidPaint(c)];
    const bound = figma.variables.setBoundVariableForPaint((node as any).fills[0], "color", v);
    (node as any).fills = [bound];
    return {};
  } else if (p.styleName) {
    const { match, available } = await resolveStyle(p.styleName);
    if (match) {
      await (node as any).setFillStyleIdAsync(match.id);
      const result: any = { matchedStyle: match.name };
      if (p.color) result.warning = "Both styleName and color provided — used styleName, ignored color. Pass only one.";
      return result;
    }
    throw new Error(styleNotFoundHint("styleName", p.styleName, available));
  } else if (p.color) {
    const c = coerceColor(p.color);
    if (!c) throw new Error(`Invalid fill color: ${JSON.stringify(p.color)}. Use hex "#FF0000" or {r, g, b, a?} with values 0-1.`);
    (node as any).fills = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
    const suggestion = await suggestStyleForColor(c, "styleName");
    if (suggestion) return { warning: suggestion };
  }
  return {};
}

export async function setStrokeSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("strokes" in node)) throw new Error(`Node does not support strokes: ${p.nodeId}`);

  if (p.variableId) {
    const v = await findVariableById(p.variableId);
    if (!v) throw new Error(`Stroke variableId '${p.variableId}' not found`);
    const c = coerceColor(p.color) ?? { r: 0, g: 0, b: 0, a: 1 };
    (node as any).strokes = [solidPaint(c)];
    const bound = figma.variables.setBoundVariableForPaint((node as any).strokes[0], "color", v);
    (node as any).strokes = [bound];
  } else if (p.styleName) {
    const { match, available } = await resolveStyle(p.styleName);
    if (match) {
      await (node as any).setStrokeStyleIdAsync(match.id);
      const result: any = { matchedStyle: match.name };
      if (p.color) result.warning = "Both styleName and color provided — used styleName, ignored color. Pass only one.";
      if (p.strokeWeight !== undefined && "strokeWeight" in node) (node as any).strokeWeight = p.strokeWeight;
      return result;
    }
    throw new Error(styleNotFoundHint("styleName", p.styleName, available));
  } else if (p.color) {
    const c = coerceColor(p.color);
    if (!c) throw new Error(`Invalid stroke color: ${JSON.stringify(p.color)}. Use hex "#FF0000" or {r, g, b, a?} with values 0-1.`);
    (node as any).strokes = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
  }
  if (p.strokeWeight !== undefined && "strokeWeight" in node) (node as any).strokeWeight = p.strokeWeight;
  // Per-side stroke weights (requires individual stroke weights enabled)
  if (p.strokeTopWeight !== undefined || p.strokeBottomWeight !== undefined ||
      p.strokeLeftWeight !== undefined || p.strokeRightWeight !== undefined) {
    if ("strokeTopWeight" in node) {
      if (p.strokeTopWeight !== undefined) (node as any).strokeTopWeight = p.strokeTopWeight;
      if (p.strokeBottomWeight !== undefined) (node as any).strokeBottomWeight = p.strokeBottomWeight;
      if (p.strokeLeftWeight !== undefined) (node as any).strokeLeftWeight = p.strokeLeftWeight;
      if (p.strokeRightWeight !== undefined) (node as any).strokeRightWeight = p.strokeRightWeight;
    }
  }
  const result: any = {};
  if (p.color) {
    const c = coerceColor(p.color);
    if (c) {
      const suggestion = await suggestStyleForColor(c, "styleName");
      if (suggestion) result.warning = suggestion;
    }
  }
  return result;
}

export async function setCornerSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("cornerRadius" in node)) throw new Error(`Node does not support corner radius: ${p.nodeId}`);

  const corners = p.corners || [true, true, true, true];
  if ("topLeftRadius" in node && Array.isArray(corners) && corners.length === 4) {
    if (corners[0]) (node as any).topLeftRadius = p.radius;
    if (corners[1]) (node as any).topRightRadius = p.radius;
    if (corners[2]) (node as any).bottomRightRadius = p.radius;
    if (corners[3]) (node as any).bottomLeftRadius = p.radius;
  } else {
    (node as any).cornerRadius = p.radius;
  }
  return {};
}

export async function setOpacitySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("opacity" in node)) throw new Error(`Node does not support opacity`);
  (node as any).opacity = p.opacity;
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_fill_color: (p) => batchHandler(p, setFillSingle),
  set_stroke_color: (p) => batchHandler(p, setStrokeSingle),
  set_corner_radius: (p) => batchHandler(p, setCornerSingle),
  set_opacity: (p) => batchHandler(p, setOpacitySingle),
};
