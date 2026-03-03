import { z } from "zod";
import { flexJson } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

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
