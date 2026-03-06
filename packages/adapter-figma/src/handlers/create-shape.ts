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

  // Bind fill style/variable to all vector children
  if (p.fillStyleName || p.fillVariableId) {
    const vectors: SceneNode[] = [];
    const collect = (n: SceneNode) => {
      if (n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION" || n.type === "STAR" || n.type === "LINE" || n.type === "ELLIPSE" || n.type === "POLYGON") vectors.push(n);
      if ("children" in n) (n as any).children.forEach(collect);
    };
    collect(node);

    if (p.fillVariableId) {
      const v = await findVariableById(p.fillVariableId);
      if (v) {
        for (const vec of vectors) {
          if ("fills" in vec && (vec as any).fills.length > 0) {
            const paints = (vec as any).fills.slice();
            paints[0] = figma.variables.setBoundVariableForPaint(paints[0], "color", v);
            (vec as any).fills = paints;
          }
        }
      }
    } else if (p.fillStyleName) {
      const { id: sid } = await resolvePaintStyle(p.fillStyleName);
      if (sid) {
        for (const vec of vectors) {
          try { await (vec as any).setFillStyleIdAsync(sid); } catch {}
        }
      }
    }
  }

  return { id: node.id };
}

// ─── Shape helpers ──────────────────────────────────────────────

async function applyShapeFill(node: any, p: any, hints: string[]) {
  if (p.fillVariableId) {
    const v = await findVariableById(p.fillVariableId);
    if (v) {
      node.fills = [solidPaint(p.fillColor || { r: 0, g: 0, b: 0 })];
      const bound = figma.variables.setBoundVariableForPaint(node.fills[0], "color", v);
      node.fills = [bound];
    } else hints.push(`fillVariableId '${p.fillVariableId}' not found.`);
  } else if (p.fillStyleName) {
    const { id: sid, available } = await resolvePaintStyle(p.fillStyleName);
    if (sid) {
      try { await node.setFillStyleIdAsync(sid); }
      catch (e: any) { hints.push(`fillStyleName '${p.fillStyleName}' failed: ${e.message}`); }
    } else hints.push(styleNotFoundHint("fillStyleName", p.fillStyleName, available));
  } else if (p.fillColor) {
    node.fills = [solidPaint(p.fillColor)];
    const suggestion = await suggestStyleForColor(p.fillColor, "fillStyleName");
    if (suggestion) hints.push(suggestion);
  }
}

async function applyShapeStroke(node: any, p: any) {
  if (p.strokeColor) node.strokes = [solidPaint(p.strokeColor)];
  if (p.strokeWeight !== undefined) node.strokeWeight = p.strokeWeight;
}

// ─── Rectangle ──────────────────────────────────────────────────

async function createSingleRectangle(p: any) {
  const rect = figma.createRectangle();
  rect.x = p.x ?? 0;
  rect.y = p.y ?? 0;
  rect.resize(p.width ?? 100, p.height ?? 100);
  rect.name = p.name || "Rectangle";
  if (p.cornerRadius !== undefined) rect.cornerRadius = p.cornerRadius;
  if (p.opacity !== undefined) rect.opacity = p.opacity;

  const hints: string[] = [];
  await applyShapeFill(rect, p, hints);
  await applyShapeStroke(rect, p);
  await appendToParent(rect, p.parentId);

  const result: any = { id: rect.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

// ─── Ellipse ────────────────────────────────────────────────────

async function createSingleEllipse(p: any) {
  const ellipse = figma.createEllipse();
  ellipse.x = p.x ?? 0;
  ellipse.y = p.y ?? 0;
  ellipse.resize(p.width ?? 100, p.height ?? p.width ?? 100);
  ellipse.name = p.name || "Ellipse";
  if (p.opacity !== undefined) ellipse.opacity = p.opacity;

  const hints: string[] = [];
  await applyShapeFill(ellipse, p, hints);
  await applyShapeStroke(ellipse, p);
  await appendToParent(ellipse, p.parentId);

  const result: any = { id: ellipse.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
}

// ─── Line ───────────────────────────────────────────────────────

async function createSingleLine(p: any) {
  const line = figma.createLine();
  line.x = p.x ?? 0;
  line.y = p.y ?? 0;
  line.resize(p.length ?? 100, 0);
  line.name = p.name || "Line";
  if (p.rotation !== undefined) line.rotation = p.rotation;
  if (p.opacity !== undefined) line.opacity = p.opacity;

  // Lines use strokes not fills
  line.strokes = [solidPaint(p.strokeColor || { r: 0, g: 0, b: 0 })];
  if (p.strokeWeight !== undefined) line.strokeWeight = p.strokeWeight;

  await appendToParent(line, p.parentId);
  return { id: line.id };
}

// ─── Group ──────────────────────────────────────────────────────

async function createSingleGroup(p: any) {
  if (!p.nodeIds?.length) throw new Error("nodeIds required (at least 1 node)");

  const nodes: SceneNode[] = [];
  for (const id of p.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node as SceneNode);
  }

  const parent = p.parentId
    ? await figma.getNodeByIdAsync(p.parentId)
    : nodes[0].parent;
  if (!parent || !("children" in parent)) throw new Error("Invalid parent for group");

  const group = figma.group(nodes, parent as any);
  if (p.name) group.name = p.name;

  return { id: group.id };
}

// ─── Boolean Operation ─────────────────────────────────────────

async function createSingleBooleanOperation(p: any) {
  if (!p.nodeIds?.length || p.nodeIds.length < 2) throw new Error("nodeIds required (at least 2 nodes)");

  const nodes: SceneNode[] = [];
  for (const id of p.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node as SceneNode);
  }

  const parent = p.parentId
    ? await figma.getNodeByIdAsync(p.parentId)
    : nodes[0].parent;
  if (!parent || !("children" in parent)) throw new Error("Invalid parent for boolean operation");

  const ops: Record<string, (nodes: readonly SceneNode[], parent: BaseNode & ChildrenMixin) => BooleanOperationNode> = {
    UNION: figma.union,
    SUBTRACT: figma.subtract,
    INTERSECT: figma.intersect,
    EXCLUDE: figma.exclude,
  };

  const op = ops[p.operation];
  if (!op) throw new Error(`Unknown boolean operation: ${p.operation}. Expected: UNION, SUBTRACT, INTERSECT, EXCLUDE`);

  const result = op(nodes, parent as any);
  if (p.name) result.name = p.name;

  return { id: result.id };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  create_section: (p) => batchHandler(p, createSingleSection),
  create_node_from_svg: (p) => batchHandler(p, createSingleSvg),
  create_rectangle: (p) => batchHandler(p, createSingleRectangle),
  create_ellipse: (p) => batchHandler(p, createSingleEllipse),
  create_line: (p) => batchHandler(p, createSingleLine),
  create_group: (p) => batchHandler(p, createSingleGroup),
  create_boolean_operation: (p) => batchHandler(p, createSingleBooleanOperation),
};
