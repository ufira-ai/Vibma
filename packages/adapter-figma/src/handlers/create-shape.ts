import { batchHandler, appendToParent, checkOverlappingSiblings, solidPaint, applyFillWithAutoBind, applyStrokeWithAutoBind, applyCornerRadius, applyTokens, findVariableById, findColorVariableByName, type Hint } from "./helpers";
import {
  framesCreateSection, framesCreateSvg, framesCreateRectangle,
  framesCreateEllipse, framesCreateLine, framesCreateGroup,
  framesCreateBooleanOperation,
} from "@ufira/vibma/guards";

/**
 * Apply auto-layout sizing to a shape node after appending to parent.
 * Uses the same deferred FILL + warning pattern as setupFrameNode.
 */
function applyLayoutSizing(
  node: SceneNode,
  parent: BaseNode | null,
  p: { layoutSizingHorizontal?: string; layoutSizingVertical?: string },
  hints: Hint[],
  defaults?: { h?: string; v?: string },
): void {
  const parentIsAL = parent && "layoutMode" in parent && (parent as any).layoutMode !== "NONE";
  const h = p.layoutSizingHorizontal || defaults?.h;
  const v = p.layoutSizingVertical || defaults?.v;
  if (h) {
    if (h === "FILL" && !parentIsAL) {
      hints.push({ type: "warn", message: "layoutSizingHorizontal 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first." });
    } else if ("layoutSizingHorizontal" in node) {
      (node as any).layoutSizingHorizontal = h;
    }
  }
  if (v) {
    if (v === "FILL" && !parentIsAL) {
      hints.push({ type: "warn", message: "layoutSizingVertical 'FILL' ignored — parent is not an auto-layout frame. Add layoutMode to parent first." });
    } else if ("layoutSizingVertical" in node) {
      (node as any).layoutSizingVertical = v;
    }
  }
}

// Handler-level extensions: params accepted by handler but not in YAML schema
const SVG_KEYS = new Set([...framesCreateSvg, "fillVariableId"]) as ReadonlySet<string>;
const LINE_KEYS = new Set([...framesCreateLine, "strokeVariableId", "strokeStyleName"]) as ReadonlySet<string>;

// ─── Figma Handlers ──────────────────────────────────────────────

async function createSingleSection(p: any) {
  const section = figma.createSection();
  try {
    section.x = p.x ?? 0;
    section.y = p.y ?? 0;
    section.resizeWithoutConstraints(p.width ?? 500, p.height ?? 500);
    section.name = p.name || "Section";
    section.fills = [];

    const hints: Hint[] = [];
    await applyFillWithAutoBind(section, p, hints);

    await appendToParent(section, p.parentId);
    const result: any = { id: section.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    section.remove();
    throw e;
  }
}

async function createSingleSvg(p: any) {
  const node = figma.createNodeFromSvg(p.svg);
  try {
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
  } catch (e) {
    node.remove();
    throw e;
  }
}

// ─── Rectangle ──────────────────────────────────────────────────

async function createSingleRectangle(p: any) {
  const rect = figma.createRectangle();
  try {
    rect.x = p.x ?? 0;
    rect.y = p.y ?? 0;
    rect.resize(p.width ?? 100, p.height ?? 100);
    rect.name = p.name || "Rectangle";

    const hints: Hint[] = [];
    await applyTokens(rect, { opacity: p.opacity }, hints);
    await applyCornerRadius(rect, p, hints);
    await applyFillWithAutoBind(rect, p, hints);
    await applyStrokeWithAutoBind(rect, p, hints);
    const parent = await appendToParent(rect, p.parentId);
    checkOverlappingSiblings(rect, parent, hints);
    await applyLayoutSizing(rect, parent, p, hints);

    const result: any = { id: rect.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    rect.remove();
    throw e;
  }
}

// ─── Ellipse ────────────────────────────────────────────────────

async function createSingleEllipse(p: any) {
  const ellipse = figma.createEllipse();
  try {
    ellipse.x = p.x ?? 0;
    ellipse.y = p.y ?? 0;
    ellipse.resize(p.width ?? 100, p.height ?? p.width ?? 100);
    ellipse.name = p.name || "Ellipse";

    const hints: Hint[] = [];
    await applyTokens(ellipse, { opacity: p.opacity }, hints);
    await applyFillWithAutoBind(ellipse, p, hints);
    await applyStrokeWithAutoBind(ellipse, p, hints);
    const parent = await appendToParent(ellipse, p.parentId);
    checkOverlappingSiblings(ellipse, parent, hints);
    await applyLayoutSizing(ellipse, parent, p, hints);

    const result: any = { id: ellipse.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    ellipse.remove();
    throw e;
  }
}

// ─── Line ───────────────────────────────────────────────────────

async function createSingleLine(p: any) {
  const line = figma.createLine();
  try {
    line.x = p.x ?? 0;
    line.y = p.y ?? 0;
    line.resize(p.length ?? 100, 0);
    line.name = p.name || "Line";
    if (p.rotation !== undefined) line.rotation = p.rotation;

    // Lines use strokes not fills — default to black if no stroke specified
    const hints: Hint[] = [];
    await applyTokens(line, { opacity: p.opacity }, hints);
    if (!p.strokes && !p.strokeColor && !p.strokeVariableId && !p.strokeVariableName && !p.strokeStyleName) {
      line.strokes = [solidPaint({ r: 0, g: 0, b: 0 })];
    }
    // applyStrokeWithAutoBind handles both stroke color and strokeWeight tokens
    await applyStrokeWithAutoBind(line, p, hints);

    const parent = await appendToParent(line, p.parentId);
    checkOverlappingSiblings(line, parent, hints);
    // Lines in vertical auto-layout default to FILL width (divider pattern)
    const parentMode = parent && "layoutMode" in parent ? (parent as any).layoutMode : null;
    const defaultH = parentMode === "VERTICAL" ? "FILL" : undefined;
    await applyLayoutSizing(line, parent, p, hints, { h: defaultH });

    const result: any = { id: line.id };
    if (hints.length > 0) result.hints = hints;
    return result;
  } catch (e) {
    line.remove();
    throw e;
  }
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
  create_section: (p) => batchHandler(p, createSingleSection, { keys: framesCreateSection, help: 'frames(method: "help", topic: "create")' }),
  create_node_from_svg: (p) => batchHandler(p, createSingleSvg, { keys: SVG_KEYS, help: 'frames(method: "help", topic: "create")' }),
  create_rectangle: (p) => batchHandler(p, createSingleRectangle, { keys: framesCreateRectangle, help: 'frames(method: "help", topic: "create")' }),
  create_ellipse: (p) => batchHandler(p, createSingleEllipse, { keys: framesCreateEllipse, help: 'frames(method: "help", topic: "create")' }),
  create_line: (p) => batchHandler(p, createSingleLine, { keys: LINE_KEYS, help: 'frames(method: "help", topic: "create")' }),
  create_group: (p) => batchHandler(p, createSingleGroup, { keys: framesCreateGroup, help: 'frames(method: "help", topic: "create")' }),
  create_boolean_operation: (p) => batchHandler(p, createSingleBooleanOperation, { keys: framesCreateBooleanOperation, help: 'frames(method: "help", topic: "create")' }),
};
