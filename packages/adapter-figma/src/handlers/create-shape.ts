import { batchHandler, appendToParent, solidPaint, applyFillWithAutoBind, applyStrokeWithAutoBind, findVariableById, findColorVariableByName } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleSection(p: any) {
  const section = figma.createSection();
  section.x = p.x ?? 0;
  section.y = p.y ?? 0;
  section.resizeWithoutConstraints(p.width ?? 500, p.height ?? 500);
  section.name = p.name || "Section";
  section.fills = [];

  const hints: string[] = [];
  await applyFillWithAutoBind(section, p, hints);

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
  if (p.fillStyleName || p.fillVariableId || p.fillVariableName) {
    const vectors: SceneNode[] = [];
    const collect = (n: SceneNode) => {
      if (n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION" || n.type === "STAR" || n.type === "LINE" || n.type === "ELLIPSE" || n.type === "POLYGON") vectors.push(n);
      if ("children" in n) (n as any).children.forEach(collect);
    };
    collect(node);

    // Resolve variable: by ID > by name
    let variable: any = null;
    if (p.fillVariableId) {
      variable = await findVariableById(p.fillVariableId);
    } else if (p.fillVariableName) {
      variable = await findColorVariableByName(p.fillVariableName);
    }

    if (variable) {
      for (const vec of vectors) {
        if ("fills" in vec && (vec as any).fills.length > 0) {
          const paints = (vec as any).fills.slice();
          paints[0] = figma.variables.setBoundVariableForPaint(paints[0], "color", variable);
          (vec as any).fills = paints;
        }
      }
    } else if (p.fillStyleName) {
      const styles = await figma.getLocalPaintStylesAsync();
      const exact = styles.find(s => s.name === p.fillStyleName);
      const match = exact || styles.find(s => s.name.toLowerCase().includes(p.fillStyleName.toLowerCase()));
      if (match) {
        for (const vec of vectors) {
          try { await (vec as any).setFillStyleIdAsync(match.id); } catch {}
        }
      }
    }
  }

  return { id: node.id };
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
  await applyFillWithAutoBind(rect, p, hints);
  await applyStrokeWithAutoBind(rect, p, hints);
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
  await applyFillWithAutoBind(ellipse, p, hints);
  await applyStrokeWithAutoBind(ellipse, p, hints);
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

  // Lines use strokes not fills — default to black if no stroke specified
  const hints: string[] = [];
  if (!p.strokeColor && !p.strokeVariableId && !p.strokeVariableName && !p.strokeStyleName) {
    line.strokes = [solidPaint({ r: 0, g: 0, b: 0 })];
  } else {
    await applyStrokeWithAutoBind(line, p, hints);
  }
  if (p.strokeWeight !== undefined) line.strokeWeight = p.strokeWeight;

  await appendToParent(line, p.parentId);
  const result: any = { id: line.id };
  if (hints.length > 0) result.warning = hints.join(" ");
  return result;
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
