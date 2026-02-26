import { rgbaToHex } from "./color";

/**
 * Filter a Figma node's JSON export to include only relevant properties.
 * Used on the Figma plugin side to reduce payload before sending to MCP.
 *
 * @param node - Raw node data (from exportAsync JSON_REST_V1 or similar)
 * @param depth - How many levels of children to include. -1 = unlimited, 0 = stubs only.
 * @param currentDepth - Internal recursion counter.
 */
export function filterFigmaNode(
  node: any,
  depth: number = -1,
  currentDepth: number = 0
): any {
  // VECTORs: always a stub (id/name/type only) — no properties worth extracting
  if (node.type === "VECTOR") {
    return { id: node.id, name: node.name, type: node.type };
  }

  const filtered: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Parent info at root level
  if (currentDepth === 0) {
    if (node.parentId) filtered.parentId = node.parentId;
    if (node.parentName) filtered.parentName = node.parentName;
    if (node.parentType) filtered.parentType = node.parentType;
  }

  // Fills
  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill: any) => {
      const f = { ...fill };
      delete f.boundVariables;
      delete f.imageRef;
      if (f.gradientStops) {
        f.gradientStops = f.gradientStops.map((stop: any) => {
          const s = { ...stop };
          if (s.color) s.color = rgbaToHex(s.color);
          delete s.boundVariables;
          return s;
        });
      }
      if (f.color) f.color = rgbaToHex(f.color);
      return f;
    });
  }

  // Strokes
  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke: any) => {
      const s = { ...stroke };
      delete s.boundVariables;
      if (s.color) s.color = rgbaToHex(s.color);
      return s;
    });
  }

  if (node.cornerRadius !== undefined) filtered.cornerRadius = node.cornerRadius;
  if (node.absoluteBoundingBox) filtered.absoluteBoundingBox = node.absoluteBoundingBox;
  if (node.characters !== undefined) filtered.characters = node.characters;

  // Instance → source component
  if (node.componentId) filtered.componentId = node.componentId;

  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx,
    };
  }

  if (node.effects && node.effects.length > 0) filtered.effects = node.effects;

  // Layout
  if (node.layoutMode !== undefined) filtered.layoutMode = node.layoutMode;
  if (node.itemSpacing !== undefined) filtered.itemSpacing = node.itemSpacing;
  if (node.paddingLeft !== undefined) {
    filtered.padding = {
      left: node.paddingLeft,
      right: node.paddingRight,
      top: node.paddingTop,
      bottom: node.paddingBottom,
    };
  }

  // Opacity / visibility
  if (node.opacity !== undefined && node.opacity !== 1) filtered.opacity = node.opacity;
  if (node.visible !== undefined) filtered.visible = node.visible;

  // Constraints
  if (node.constraints) filtered.constraints = node.constraints;

  // Children
  if (node.children) {
    if (depth >= 0 && currentDepth >= depth) {
      filtered.children = node.children.map((child: any) => ({
        id: child.id,
        name: child.name,
        type: child.type,
      }));
    } else {
      filtered.children = node.children
        .map((child: any) => filterFigmaNode(child, depth, currentDepth + 1));
    }
  }

  return filtered;
}
