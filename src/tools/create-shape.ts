import { z } from "zod";
import { flexJson } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler, appendToParent } from "./helpers";

// ─── Schemas ─────────────────────────────────────────────────────

const rectItem = z.object({
  name: z.string().optional().describe("Name (default: 'Rectangle')"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 100)"),
  height: z.coerce.number().optional().describe("Height (default: 100)"),
  parentId: S.parentId,
});

const ellipseItem = z.object({
  name: z.string().optional().describe("Layer name (default: 'Ellipse')"),
  x: S.xPos,
  y: S.yPos,
  width: z.coerce.number().optional().describe("Width (default: 100)"),
  height: z.coerce.number().optional().describe("Height (default: 100)"),
  parentId: S.parentId,
});

const lineItem = z.object({
  name: z.string().optional().describe("Layer name (default: 'Line')"),
  x: S.xPos,
  y: S.yPos,
  length: z.coerce.number().optional().describe("Length (default: 100)"),
  rotation: z.coerce.number().optional().describe("Rotation in degrees (default: 0)"),
  parentId: S.parentId,
});

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

const boolOpItem = z.object({
  nodeIds: flexJson(z.array(z.string())).describe("Array of node IDs (min 2)"),
  operation: z.enum(["UNION", "INTERSECT", "SUBTRACT", "EXCLUDE"]).describe("Boolean operation type"),
  name: z.string().optional().describe("Name for the result. Omit to auto-generate."),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "create_rectangle",
    "Create rectangles (leaf nodes — cannot have children). For containers/cards/panels, use create_frame instead. Batch: pass multiple items.",
    { items: flexJson(z.array(rectItem)).describe("Array of rectangles to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_rectangle", params)); }
      catch (e) { return mcpError("Error creating rectangles", e); }
    }
  );

  server.tool(
    "create_ellipse",
    "Create ellipses (leaf nodes — cannot have children). For circular containers, use create_frame with cornerRadius instead. Batch: pass multiple items.",
    { items: flexJson(z.array(ellipseItem)).describe("Array of ellipses to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_ellipse", params)); }
      catch (e) { return mcpError("Error creating ellipses", e); }
    }
  );

  server.tool(
    "create_line",
    "Create lines (leaf nodes — cannot have children). For dividers inside layouts, use create_frame with a thin height and fill color instead. Batch: pass multiple items.",
    { items: flexJson(z.array(lineItem)).describe("Array of lines to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_line", params)); }
      catch (e) { return mcpError("Error creating lines", e); }
    }
  );

  server.tool(
    "create_section",
    "Create section nodes to organize content on the canvas.",
    { items: flexJson(z.array(sectionItem)).describe("Array of sections to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_section", params)); }
      catch (e) { return mcpError("Error creating sections", e); }
    }
  );

  server.tool(
    "create_node_from_svg",
    "Create nodes from SVG strings.",
    { items: flexJson(z.array(svgItem)).describe("Array of SVG items to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_node_from_svg", params)); }
      catch (e) { return mcpError("Error creating SVG nodes", e); }
    }
  );

  server.tool(
    "create_boolean_operation",
    "Create a boolean operation (union, intersect, subtract, exclude) from multiple nodes.",
    { items: flexJson(z.array(boolOpItem)).describe("Array of boolean operations to create"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("create_boolean_operation", params)); }
      catch (e) { return mcpError("Error creating boolean operations", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleRect(p: any) {
  const rect = figma.createRectangle();
  rect.x = p.x ?? 0;
  rect.y = p.y ?? 0;
  rect.resize(p.width ?? 100, p.height ?? 100);
  rect.name = p.name || "Rectangle";
  await appendToParent(rect, p.parentId);
  return { id: rect.id };
}

async function createSingleEllipse(p: any) {
  const el = figma.createEllipse();
  el.x = p.x ?? 0;
  el.y = p.y ?? 0;
  el.resize(p.width ?? 100, p.height ?? 100);
  if (p.name) el.name = p.name;
  await appendToParent(el, p.parentId);
  return { id: el.id };
}

async function createSingleLine(p: any) {
  const line = figma.createLine();
  line.x = p.x ?? 0;
  line.y = p.y ?? 0;
  line.resize(p.length ?? 100, 0);
  if (p.rotation) line.rotation = p.rotation;
  if (p.name) line.name = p.name;
  line.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];
  await appendToParent(line, p.parentId);
  return { id: line.id };
}

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
  return { id: node.id, type: node.type };
}

async function createSingleBoolOp(p: any) {
  if (!p.nodeIds?.length || p.nodeIds.length < 2) throw new Error("Need at least 2 nodes");
  const nodes: SceneNode[] = [];
  for (const id of p.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node as SceneNode);
  }
  const boolOp = figma.createBooleanOperation();
  boolOp.booleanOperation = p.operation;
  for (const node of nodes) boolOp.appendChild(node.clone());
  if (p.name) boolOp.name = p.name;
  return { id: boolOp.id };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_rectangle: (p) => batchHandler(p, createSingleRect),
  create_ellipse: (p) => batchHandler(p, createSingleEllipse),
  create_line: (p) => batchHandler(p, createSingleLine),
  create_section: (p) => batchHandler(p, createSingleSection),
  create_node_from_svg: (p) => batchHandler(p, createSingleSvg),
  create_boolean_operation: (p) => batchHandler(p, createSingleBoolOp),
};
