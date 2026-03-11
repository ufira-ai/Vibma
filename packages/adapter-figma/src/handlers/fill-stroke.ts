import { applyToken, applyTokens, batchHandler, coerceColor, findVariableById, findVariableByName, solidPaint, styleNotFoundHint, suggestStyleForColor } from "./helpers";

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

  if (p.variableName || p.variableId) {
    const v = p.variableName
      ? await findVariableByName(p.variableName)
      : await findVariableById(p.variableId);
    if (!v) throw new Error(`Fill variable '${p.variableName || p.variableId}' not found`);
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
    const match = await suggestStyleForColor(c, "styleName", "ALL_FILLS");
    if (match.variable) {
      const bound = figma.variables.setBoundVariableForPaint((node as any).fills[0], "color", match.variable);
      (node as any).fills = [bound];
      return { warning: match.hint };
    }
    if (match.paintStyleId) {
      try { await (node as any).setFillStyleIdAsync(match.paintStyleId); return { warning: match.hint }; } catch {}
    }
    return { warning: match.hint };
  }
  return {};
}

export async function setStrokeSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("strokes" in node)) throw new Error(`Node does not support strokes: ${p.nodeId}`);

  if (p.variableName || p.variableId) {
    const v = p.variableName
      ? await findVariableByName(p.variableName)
      : await findVariableById(p.variableId);
    if (!v) throw new Error(`Stroke variable '${p.variableName || p.variableId}' not found`);
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
      if (p.strokeWeight !== undefined && "strokeWeight" in node) {
        const swHints: string[] = [];
        await applyTokens(node, { strokeWeight: p.strokeWeight }, swHints);
        if (swHints.length > 0) result.warning = (result.warning ? result.warning + " " : "") + swHints.join(" ");
      }
      return result;
    }
    throw new Error(styleNotFoundHint("styleName", p.styleName, available));
  } else if (p.color) {
    const c = coerceColor(p.color);
    if (!c) throw new Error(`Invalid stroke color: ${JSON.stringify(p.color)}. Use hex "#FF0000" or {r, g, b, a?} with values 0-1.`);
    (node as any).strokes = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
  }
  const hints: string[] = [];
  const swFields: Record<string, any> = {};
  for (const f of ["strokeWeight", "strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"]) {
    if (p[f] !== undefined && f in node) swFields[f] = p[f];
  }
  await applyTokens(node, swFields, hints);
  const result: any = {};
  if (hints.length > 0) result.warning = hints.join(" ");
  if (p.color && !p.styleName && !p.variableId && !p.variableName) {
    const c = coerceColor(p.color);
    if (c) {
      const match = await suggestStyleForColor(c, "styleName", "STROKE_COLOR");
      if (match.variable) {
        const bound = figma.variables.setBoundVariableForPaint((node as any).strokes[0], "color", match.variable);
        (node as any).strokes = [bound];
      } else if (match.paintStyleId) {
        try { await (node as any).setStrokeStyleIdAsync(match.paintStyleId); } catch {}
      }
      result.warning = match.hint;
    }
  }
  return result;
}

export async function setCornerSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("cornerRadius" in node)) throw new Error(`Node does not support corner radius: ${p.nodeId}`);

  const hints: string[] = [];

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
      if (!bound) {
        hints.push(`Hardcoded cornerRadius. Use an existing FLOAT variable or create one with variables(method:"create"), then pass the variable name string instead of a number.`);
      }
    }
  }

  const result: any = {};
  const unique = [...new Set(hints)];
  if (unique.length > 0) result.warning = unique.join(" ");
  return result;
}

export async function setOpacitySingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("opacity" in node)) throw new Error(`Node does not support opacity`);
  const hints: string[] = [];
  await applyTokens(node, { opacity: p.opacity }, hints);
  const result: any = {};
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_fill_color: (p) => batchHandler(p, setFillSingle),
  set_stroke_color: (p) => batchHandler(p, setStrokeSingle),
  set_corner_radius: (p) => batchHandler(p, setCornerSingle),
  set_opacity: (p) => batchHandler(p, setOpacitySingle),
};
