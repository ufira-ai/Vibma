import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { ToolDef } from "./types";
import { batchHandler, appendToParent } from "./helpers";
import type { IdResult } from "./response-types";

// ─── Schemas ─────────────────────────────────────────────────────

const sectionItem = z.object({
  name: z.string().optional().describe("Name (default: 'Section')"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 500)"),
  height: z.coerce.number().optional().describe("Height (default: 500)"),
  parentId: S.parentId,
});

const svgItem = z.object({
  svg: z.string().describe("SVG markup string"),
  name: z.string().optional().describe("Layer name (default: 'SVG')"),
  x: S.xPos,
  y: S.yPos,
  parentId: S.parentId,
});

// ─── Tool Definitions ───────────────────────────────────────────

export const tools: ToolDef[] = [
  {
    name: "create_section",
    description: "Create section nodes to organize content on the canvas.",
    schema: { items: flexJson(z.array(sectionItem)).describe("Array of sections to create"), depth: S.depth },
    tier: "create",
  },
  {
    name: "create_node_from_svg",
    description: "Create nodes from SVG strings.",
    schema: { items: flexJson(z.array(svgItem)).describe("Array of SVG items to create"), depth: S.depth },
    tier: "create",
  },
];

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleSection(p: any): Promise<IdResult> {
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
