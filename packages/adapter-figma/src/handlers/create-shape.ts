import { batchHandler, appendToParent } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleSection(p: any) {
  const section = figma.createSection();
  section.x = p.x ?? 0;
  section.y = p.y ?? 0;
  section.resizeWithoutConstraints(p.width ?? 500, p.height ?? 500);
  section.name = p.name || "Section";
  await appendToParent(section, p.parentId);
  return { id: section.id };
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
