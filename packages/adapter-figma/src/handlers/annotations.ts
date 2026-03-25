// ─── Annotations handler ────────────────────────────────────────────
// CRUD for node annotations + annotation category management.
// Uses the same items/single-item pattern as other node endpoints.

import { batchHandler } from "./helpers";

type AnnotationCategoryColor = "yellow" | "orange" | "red" | "pink" | "violet" | "blue" | "teal" | "green";

// ─── Property validation ────────────────────────────────────────────
// Annotation property types correspond to actual node properties.
// Derived from Figma Plugin API type definitions (AnnotationPropertyType → node mixin fields).

const ALL_ANNOTATION_PROPS = new Set([
  "width", "height", "maxWidth", "minWidth", "maxHeight", "minHeight",
  "fills", "strokes", "effects", "strokeWeight", "cornerRadius",
  "textStyleId", "textAlignHorizontal", "fontFamily", "fontStyle", "fontSize", "fontWeight", "lineHeight", "letterSpacing",
  "itemSpacing", "padding", "layoutMode", "alignItems",
  "opacity", "mainComponent",
  "gridRowGap", "gridColumnGap", "gridRowCount", "gridColumnCount",
  "gridRowAnchorIndex", "gridColumnAnchorIndex", "gridRowSpan", "gridColumnSpan",
]);

/** Maps annotation property type → the node field we check with `"field" in node`. */
const PROP_TO_NODE_FIELD: Record<string, string> = {
  width: "width",
  height: "height",
  maxWidth: "maxWidth",
  minWidth: "minWidth",
  maxHeight: "maxHeight",
  minHeight: "minHeight",
  fills: "fills",
  strokes: "strokes",
  effects: "effects",
  strokeWeight: "strokeWeight",
  cornerRadius: "cornerRadius",
  opacity: "opacity",
  // Text — all map to fontName/fontSize/etc on TextNode
  fontFamily: "fontName",
  fontStyle: "fontName",
  fontSize: "fontSize",
  fontWeight: "fontName",
  lineHeight: "lineHeight",
  letterSpacing: "letterSpacing",
  textAlignHorizontal: "textAlignHorizontal",
  textStyleId: "textStyleId",
  // Layout — AutoLayoutMixin fields
  itemSpacing: "itemSpacing",
  padding: "paddingLeft",
  layoutMode: "layoutMode",
  alignItems: "primaryAxisAlignItems",
  // Instance
  mainComponent: "mainComponent",
  // Grid — GridLayoutMixin
  gridRowGap: "gridColumnSizes",
  gridColumnGap: "gridColumnSizes",
  gridRowCount: "gridColumnSizes",
  gridColumnCount: "gridColumnSizes",
  gridRowAnchorIndex: "gridColumnSizes",
  gridColumnAnchorIndex: "gridColumnSizes",
  gridRowSpan: "gridColumnSizes",
  gridColumnSpan: "gridColumnSizes",
};

/** Human-readable group names for better warning messages. */
const PROP_GROUP: Record<string, string> = {
  fontFamily: "text", fontStyle: "text", fontSize: "text", fontWeight: "text",
  lineHeight: "text", letterSpacing: "text", textAlignHorizontal: "text", textStyleId: "text",
  itemSpacing: "auto-layout", padding: "auto-layout", layoutMode: "auto-layout", alignItems: "auto-layout",
  mainComponent: "instance",
  gridRowGap: "grid", gridColumnGap: "grid", gridRowCount: "grid", gridColumnCount: "grid",
  gridRowAnchorIndex: "grid", gridColumnAnchorIndex: "grid", gridRowSpan: "grid", gridColumnSpan: "grid",
};

/** Properties that require auto-layout to be active (layoutMode !== "NONE"). */
const LAYOUT_PROPS = new Set(["itemSpacing", "padding", "layoutMode", "alignItems"]);
/** Properties that require grid layout. */
const GRID_PROPS = new Set(["gridRowGap", "gridColumnGap", "gridRowCount", "gridColumnCount", "gridRowAnchorIndex", "gridColumnAnchorIndex", "gridRowSpan", "gridColumnSpan"]);

/** Compute which annotation property types are valid for a given node. */
function availablePropertiesForNode(node: BaseNode): string[] {
  const n = node as any;
  const available: string[] = [];
  for (const prop of ALL_ANNOTATION_PROPS) {
    if (LAYOUT_PROPS.has(prop) && (!("layoutMode" in n) || n.layoutMode === "NONE")) continue;
    if (GRID_PROPS.has(prop) && (!("gridColumnSizes" in n) || !n.gridColumnSizes?.length)) continue;
    if (prop === "mainComponent" && node.type !== "INSTANCE") continue;
    const field = PROP_TO_NODE_FIELD[prop];
    if (field && !(field in n)) continue;
    available.push(prop);
  }
  return available;
}

/**
 * Validate annotation property types against a node.
 * Rejects on first invalid property with the full available list.
 */
function validateProperties(node: BaseNode, properties: string[]): void {
  const n = node as any;
  const available = availablePropertiesForNode(node);

  for (const prop of properties) {
    let reason: string | undefined;

    if (!ALL_ANNOTATION_PROPS.has(prop)) {
      reason = `Unknown annotation property "${prop}".`;
    } else if (LAYOUT_PROPS.has(prop) && (!("layoutMode" in n) || n.layoutMode === "NONE")) {
      reason = `"${prop}" requires auto-layout — this ${node.type} has layoutMode NONE.`;
    } else if (GRID_PROPS.has(prop) && (!("gridColumnSizes" in n) || !n.gridColumnSizes?.length)) {
      reason = `"${prop}" requires grid layout — not active on this ${node.type}.`;
    } else if (prop === "mainComponent" && node.type !== "INSTANCE") {
      reason = `"mainComponent" is only valid on INSTANCE nodes, not ${node.type}.`;
    } else {
      const field = PROP_TO_NODE_FIELD[prop];
      if (field && !(field in n)) {
        const group = PROP_GROUP[prop];
        reason = group
          ? `"${prop}" is a ${group} property — not available on ${node.type} nodes.`
          : `"${prop}" is not available on ${node.type} nodes.`;
      }
    }

    if (reason) {
      throw new Error(`${reason} Available for this ${node.type}: ${available.join(", ")}`);
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

async function resolveCategory(categoryId: string | undefined): Promise<{ id: string; label: string; color: string } | undefined> {
  if (!categoryId) return undefined;
  const cat = await figma.annotations.getAnnotationCategoryByIdAsync(categoryId);
  if (!cat) return undefined;
  return { id: cat.id, label: cat.label, color: cat.color };
}

/** Deep-copy a Figma readonly annotation proxy to a plain object.
 *  Figma auto-populates both label and labelMarkdown on read, but rejects both on write.
 *  Prefer labelMarkdown (richer) when both exist. */
function cloneAnnotation(a: any): any {
  const out: any = {};
  if (a.labelMarkdown) out.labelMarkdown = a.labelMarkdown;
  else if (a.label) out.label = a.label;
  if (a.properties && a.properties.length > 0) {
    out.properties = Array.from(a.properties).map((p: any) => ({ type: p.type }));
  }
  if (a.categoryId) out.categoryId = a.categoryId;
  return out;
}

/** Build an annotation object from user params. Only one of label/labelMarkdown allowed.
 *  Validates properties against the node — throws on invalid. */
function buildAnnotation(p: any, node?: BaseNode): any {
  const ann: any = {};

  if (p.labelMarkdown) ann.labelMarkdown = p.labelMarkdown;
  else if (p.label) ann.label = p.label;

  if (p.properties && Array.isArray(p.properties) && p.properties.length > 0) {
    if (node) validateProperties(node, p.properties);
    ann.properties = p.properties.map((t: string) => ({ type: t }));
  }

  if (p.categoryId) ann.categoryId = p.categoryId;
  return ann;
}

/**
 * Apply annotations from a create/update params object onto a node.
 * Reads `p.annotations` (array of {label?, labelMarkdown?, properties?, categoryId?}).
 * Partial failure: invalid properties are stripped with warnings, valid annotations still applied.
 * Returns warnings for the hints array. No-op if p.annotations is absent.
 */
export function applyAnnotations(node: BaseNode, p: any, hints: { type: string; message: string }[]): void {
  if (!p.annotations || !Array.isArray(p.annotations) || p.annotations.length === 0) return;
  if (!("annotations" in node)) return;

  const built: any[] = [];
  for (let i = 0; i < p.annotations.length; i++) {
    const a = p.annotations[i];
    const ann: any = {};
    if (a.labelMarkdown) ann.labelMarkdown = a.labelMarkdown;
    else if (a.label) ann.label = a.label;
    if (!ann.label && !ann.labelMarkdown) {
      hints.push({ type: "warn", message: `annotations[${i}]: missing label or labelMarkdown — skipped.` });
      continue;
    }
    if (a.properties && Array.isArray(a.properties) && a.properties.length > 0) {
      const available = availablePropertiesForNode(node);
      const validProps: string[] = [];
      for (const prop of a.properties) {
        if (!available.includes(prop)) {
          hints.push({ type: "warn", message: `annotations[${i}]: "${prop}" not valid for ${node.type} — stripped. Fix: annotations(method:"set", id:"${node.id}", annotations:[{...properties:["${available.slice(0, 5).join('","')}"]}])` });
        } else {
          validProps.push(prop);
        }
      }
      if (validProps.length > 0) ann.properties = validProps.map(t => ({ type: t }));
    }
    if (a.categoryId) ann.categoryId = a.categoryId;
    built.push(ann);
  }

  if (built.length > 0) {
    try {
      (node as any).annotations = built;
    } catch (e: any) {
      hints.push({ type: "warn", message: `annotations: failed to apply — ${e.message}. Fix: annotations(method:"set", id:"${node.id}", annotations:[...])` });
    }
  }
}

async function resolveNode(id: string): Promise<BaseNode> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error(`Node "${id}" not found.`);
  if (!("annotations" in node)) throw new Error(`Node "${id}" (${node.type}) does not support annotations.`);
  return node;
}

// ─── Get (batch) ─────────────────────────────────────────────────

function serializeAnnotation(a: any, index: number): any {
  const entry: any = { index };
  if (a.label) entry.label = a.label;
  if (a.labelMarkdown) entry.labelMarkdown = a.labelMarkdown;
  if (a.properties && a.properties.length > 0) {
    entry.properties = a.properties.map((ap: any) => ap.type);
  }
  if (a.categoryId) entry.categoryId = a.categoryId;
  return entry;
}

async function getSingle(p: any) {
  const node = await resolveNode(p.id);
  const anns = (node as any).annotations as ReadonlyArray<any>;
  const filterCat = p.categoryId;
  const results = [];
  for (let i = 0; i < anns.length; i++) {
    const a = anns[i];
    if (filterCat && a.categoryId !== filterCat) continue;
    const entry = serializeAnnotation(a, i);
    const cat = await resolveCategory(a.categoryId);
    if (cat) entry.category = cat;
    results.push(entry);
  }
  return { id: node.id, name: node.name, annotations: results };
}

async function getAnnotations(params: any) {
  return batchHandler(params, getSingle);
}

// ─── Set (batch) — replace all annotations on a node ────────────

async function setSingle(p: any) {
  const node = await resolveNode(p.id);
  if (!p.annotations) throw new Error("set requires annotations array.");
  const annotations = (p.annotations || []).map((a: any) => buildAnnotation(a, node));
  (node as any).annotations = annotations;
  return { id: node.id, count: annotations.length };
}

async function setAnnotations(params: any) {
  return batchHandler(params, setSingle);
}

// ─── Add (batch) — append annotation to a node ──────────────────

async function addSingle(p: any) {
  const node = await resolveNode(p.id);
  if (!p.label && !p.labelMarkdown) throw new Error("add requires label or labelMarkdown.");
  const existing = Array.from((node as any).annotations).map(cloneAnnotation);
  existing.push(buildAnnotation(p, node));
  (node as any).annotations = existing;
  return { id: node.id, index: existing.length - 1, count: existing.length };
}

async function addAnnotation(params: any) {
  return batchHandler(params, addSingle);
}

// ─── Remove (batch) — remove annotation by index ────────────────

async function removeSingle(p: any) {
  const node = await resolveNode(p.id);
  const existing = Array.from((node as any).annotations).map(cloneAnnotation);
  const idx = Number(p.index);
  if (idx < 0 || idx >= existing.length) {
    throw new Error(`Annotation index ${idx} out of range (node has ${existing.length} annotations).`);
  }
  existing.splice(idx, 1);
  (node as any).annotations = existing;
  return { id: node.id, removed: true, count: existing.length };
}

async function removeAnnotation(params: any) {
  return batchHandler(params, removeSingle);
}

// ─── List — search annotations across a subtree ─────────────────

const DEFAULT_LIST_LIMIT = 100;

async function listAnnotations(params: any) {
  const parentId = params.parentId;
  const root = parentId
    ? await figma.getNodeByIdAsync(parentId)
    : figma.currentPage;
  if (!root) throw new Error(`Node "${parentId}" not found.`);

  const filterCat = params.categoryId;
  const limit = Number(params.limit) || DEFAULT_LIST_LIMIT;
  const results: any[] = [];

  async function walk(node: BaseNode): Promise<boolean> {
    if (results.length >= limit) return true;
    if ("annotations" in node) {
      const anns = (node as any).annotations as ReadonlyArray<any>;
      for (let i = 0; i < anns.length; i++) {
        if (results.length >= limit) return true;
        const a = anns[i];
        if (filterCat && a.categoryId !== filterCat) continue;
        const entry = serializeAnnotation(a, i);
        entry.nodeId = node.id;
        entry.nodeName = node.name;
        entry.nodeType = node.type;
        const cat = await resolveCategory(a.categoryId);
        if (cat) entry.category = cat;
        results.push(entry);
      }
    }
    if ("children" in node) {
      for (const child of (node as any).children) {
        if (await walk(child)) return true;
      }
    }
    return false;
  }

  await walk(root);
  return { results, count: results.length, ...(results.length >= limit ? { _truncated: true } : {}) };
}

// ─── Categories ──────────────────────────────────────────────────

async function listCategories() {
  const cats = await figma.annotations.getAnnotationCategoriesAsync();
  return {
    categories: cats.map(c => ({
      id: c.id,
      label: c.label,
      color: c.color,
      isPreset: c.isPreset,
    })),
  };
}

async function createCategory(params: any) {
  if (!params.label) throw new Error("create_category requires label.");
  if (!params.color) throw new Error("create_category requires color.");
  const cat = await figma.annotations.addAnnotationCategoryAsync({
    label: params.label,
    color: params.color as AnnotationCategoryColor,
  });
  return { id: cat.id, label: cat.label, color: cat.color };
}

async function updateCategory(params: any) {
  if (!params.id) throw new Error("update_category requires id.");
  const cat = await figma.annotations.getAnnotationCategoryByIdAsync(params.id);
  if (!cat) throw new Error(`Annotation category "${params.id}" not found.`);
  if (params.label) cat.setLabel(params.label);
  if (params.color) cat.setColor(params.color as AnnotationCategoryColor);
  return { id: cat.id, label: cat.label, color: cat.color };
}

async function deleteCategory(params: any) {
  if (!params.id) throw new Error("delete_category requires id.");
  const cat = await figma.annotations.getAnnotationCategoryByIdAsync(params.id);
  if (!cat) throw new Error(`Annotation category "${params.id}" not found.`);
  cat.remove();
  return { deleted: true };
}

// ─── Dispatch ────────────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  "annotations.get": getAnnotations,
  "annotations.list": listAnnotations,
  "annotations.set": setAnnotations,
  "annotations.add": addAnnotation,
  "annotations.remove": removeAnnotation,
  "annotations.categories": listCategories,
  "annotations.create_category": createCategory,
  "annotations.update_category": updateCategory,
  "annotations.delete_category": deleteCategory,
};
