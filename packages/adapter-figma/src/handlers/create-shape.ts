import { batchHandler, appendToParent, solidPaint, styleNotFoundHint, suggestStyleForColor, findVariableById } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

async function resolvePaintStyle(name: string): Promise<{ id: string | null, available: string[] }> {
  const styles = await figma.getLocalPaintStylesAsync();
  const available = styles.map(s => s.name);
  const exact = styles.find(s => s.name === name);
  if (exact) return { id: exact.id, available };
  const fuzzy = styles.find(s => s.name.toLowerCase().includes(name.toLowerCase()));
  return { id: fuzzy?.id ?? null, available };
}

async function createSingleSection(p: any) {
  const section = figma.createSection();
  section.x = p.x ?? 0;
  section.y = p.y ?? 0;
  section.resizeWithoutConstraints(p.width ?? 500, p.height ?? 500);
  section.name = p.name || "Section";
  section.fills = [];

  const hints: string[] = [];
  if (p.fillVariableId) {
    const v = await findVariableById(p.fillVariableId);
    if (v) {
      section.fills = [solidPaint(p.fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(section.fills[0] as SolidPaint, "color", v);
      section.fills = [bound];
    } else {
      hints.push(`fillVariableId '${p.fillVariableId}' not found.`);
    }
  } else if (p.fillStyleName) {
    const { id: sid, available } = await resolvePaintStyle(p.fillStyleName);
    if (sid) {
      try { await (section as any).setFillStyleIdAsync(sid); }
      catch (e: any) { hints.push(`fillStyleName '${p.fillStyleName}' matched but failed to apply: ${e.message}`); }
    } else hints.push(styleNotFoundHint("fillStyleName", p.fillStyleName, available));
  } else if (p.fillColor) {
    section.fills = [solidPaint(p.fillColor)];
    const suggestion = await suggestStyleForColor(p.fillColor, "fillStyleName");
    if (suggestion) hints.push(suggestion);
  }

  await appendToParent(section, p.parentId);
  const result: any = { id: section.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

async function createSingleSvg(p: any) {
  const node = figma.createNodeFromSvg(p.svg);
  node.x = p.x ?? 0;
  node.y = p.y ?? 0;
  if (p.name) node.name = p.name;
  await appendToParent(node, p.parentId);
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_section: (p) => batchHandler(p, createSingleSection),
  create_node_from_svg: (p) => batchHandler(p, createSingleSvg),
};
