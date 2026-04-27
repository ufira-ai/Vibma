import { batchHandler } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

export async function moveSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("x" in node)) throw new Error(`Node does not support position: ${p.nodeId}`);
  (node as any).x = p.x;
  (node as any).y = p.y;
  return {};
}

export async function resizeSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  const savedH = "layoutSizingHorizontal" in node ? (node as any).layoutSizingHorizontal : undefined;
  const savedV = "layoutSizingVertical" in node ? (node as any).layoutSizingVertical : undefined;
  if ("resize" in node) (node as any).resize(p.width, p.height);
  else if ("resizeWithoutConstraints" in node) (node as any).resizeWithoutConstraints(p.width, p.height);
  else throw new Error(`Node does not support resize: ${p.nodeId}`);
  if (savedH === "HUG") (node as any).layoutSizingHorizontal = "HUG";
  if (savedV === "HUG") (node as any).layoutSizingVertical = "HUG";
  return {};
}

const MIN_SCALE_FACTOR = 0.01;
const SCALE_EPSILON = 0.000001;

function readScaleFactor(value: unknown, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_SCALE_FACTOR) {
    throw new Error(`${name} must be a number >= ${MIN_SCALE_FACTOR}`);
  }
  return n;
}

function resolveScaleAxes(p: any): { scaleX: number; scaleY: number; uniform: boolean } {
  const factor = readScaleFactor(p.factor, "factor");
  const scaleX = readScaleFactor(p.scaleX, "scaleX");
  const scaleY = readScaleFactor(p.scaleY, "scaleY");

  if (factor !== undefined && (scaleX !== undefined || scaleY !== undefined)) {
    throw new Error("scale accepts either factor or scaleX/scaleY, not both");
  }
  if (factor !== undefined) return { scaleX: factor, scaleY: factor, uniform: true };
  if (scaleX === undefined && scaleY === undefined) {
    throw new Error("scale requires factor or scaleX/scaleY");
  }

  if (p.lockAspectRatio === true) {
    const locked = scaleX ?? scaleY!;
    if (scaleX !== undefined && scaleY !== undefined && Math.abs(scaleX - scaleY) > SCALE_EPSILON) {
      throw new Error("lockAspectRatio requires matching scaleX and scaleY. Pass factor for uniform scaling or set lockAspectRatio:false for independent axes.");
    }
    return { scaleX: locked, scaleY: locked, uniform: true };
  }

  const x = scaleX ?? 1;
  const y = scaleY ?? 1;
  return { scaleX: x, scaleY: y, uniform: Math.abs(x - y) <= SCALE_EPSILON };
}

async function loadTextFontsInSubtree(node: any) {
  const fonts = new Map<string, FontName>();

  function collect(n: any) {
    if (n?.type === "TEXT") {
      const text = n as TextNode;
      const nodeFonts = typeof text.getRangeAllFontNames === "function"
        ? text.getRangeAllFontNames(0, text.characters.length)
        : text.fontName !== figma.mixed ? [text.fontName as FontName] : [];
      for (const font of nodeFonts) fonts.set(`${font.family}::${font.style}`, font);
    }
    if (Array.isArray(n?.children)) {
      for (const child of n.children) collect(child);
    }
  }

  collect(node);
  await Promise.all([...fonts.values()].map(font => figma.loadFontAsync(font)));
}

const SCALAR_PROPERTIES = [
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "cornerRadius",
  "topLeftRadius",
  "topRightRadius",
  "bottomRightRadius",
  "bottomLeftRadius",
  "fontSize",
];

interface ScalarSnapshot {
  values: Record<string, number>;
  lineHeight?: any;
  letterSpacing?: any;
  effects?: any[];
}

function scaleNumberProperty(target: any, property: string, scale: number) {
  const value = target[property];
  if (typeof value === "number" && value !== figma.mixed) target[property] = value * scale;
}

function snapshotScalarProperties(node: any): ScalarSnapshot {
  const values: Record<string, number> = {};
  for (const property of SCALAR_PROPERTIES) {
    const value = node[property];
    if (typeof value === "number" && value !== figma.mixed) values[property] = value;
  }
  return {
    values,
    lineHeight: node.lineHeight && node.lineHeight !== figma.mixed ? { ...node.lineHeight } : undefined,
    letterSpacing: node.letterSpacing && node.letterSpacing !== figma.mixed ? { ...node.letterSpacing } : undefined,
    effects: Array.isArray(node.effects) ? node.effects.map((effect: any) => ({
      ...effect,
      offset: effect.offset ? { ...effect.offset } : effect.offset,
    })) : undefined,
  };
}

function scaleScalarProperties(node: any, scaleX: number, scaleY: number, snapshot: ScalarSnapshot) {
  // Figma exposes native non-uniform geometry resize, but scalar properties need
  // one axis. Text, strokes, corners, and blur radii follow the vertical axis.
  const scalar = scaleY;
  for (const [property, value] of Object.entries(snapshot.values)) {
    node[property] = value * scalar;
  }

  if (snapshot.lineHeight?.unit === "PIXELS") {
    node.lineHeight = { ...snapshot.lineHeight, value: snapshot.lineHeight.value * scalar };
  }
  if (snapshot.letterSpacing?.unit === "PIXELS") {
    node.letterSpacing = { ...snapshot.letterSpacing, value: snapshot.letterSpacing.value * scaleX };
  }
  if (snapshot.effects && snapshot.effects.length > 0) {
    node.effects = snapshot.effects.map((effect: any) => ({
      ...effect,
      radius: typeof effect.radius === "number" ? effect.radius * scalar : effect.radius,
      spread: typeof effect.spread === "number" ? effect.spread * scalar : effect.spread,
      offset: effect.offset
        ? { x: effect.offset.x * scaleX, y: effect.offset.y * scaleY }
        : effect.offset,
    }));
  }
}

function scaleAutoLayoutProperties(node: any, scaleX: number, scaleY: number) {
  scaleNumberProperty(node, "paddingLeft", scaleX);
  scaleNumberProperty(node, "paddingRight", scaleX);
  scaleNumberProperty(node, "paddingTop", scaleY);
  scaleNumberProperty(node, "paddingBottom", scaleY);
  if (node.layoutMode === "HORIZONTAL") scaleNumberProperty(node, "itemSpacing", scaleX);
  else if (node.layoutMode === "VERTICAL") scaleNumberProperty(node, "itemSpacing", scaleY);
  scaleNumberProperty(node, "counterAxisSpacing", node.layoutMode === "HORIZONTAL" ? scaleY : scaleX);
}

function resizeWithoutConstraints(node: any, scaleX: number, scaleY: number): boolean {
  if (!("resizeWithoutConstraints" in node) || typeof node.width !== "number" || typeof node.height !== "number") {
    return false;
  }
  const width = Math.max(node.width * scaleX, MIN_SCALE_FACTOR);
  const height = node.type === "LINE" ? 0 : Math.max(node.height * scaleY, MIN_SCALE_FACTOR);
  node.resizeWithoutConstraints(width, height);
  return true;
}

function scaleNodeAxes(node: any, scaleX: number, scaleY: number, includePosition: boolean) {
  const children = Array.isArray(node.children) ? [...node.children] : [];
  const scalarSnapshot = snapshotScalarProperties(node);
  if (includePosition) {
    if ("x" in node && typeof node.x === "number") node.x *= scaleX;
    if ("y" in node && typeof node.y === "number") node.y *= scaleY;
  }
  for (const child of children) scaleNodeAxes(child, scaleX, scaleY, true);
  const resized = resizeWithoutConstraints(node, scaleX, scaleY);
  scaleAutoLayoutProperties(node, scaleX, scaleY);
  scaleScalarProperties(node, scaleX, scaleY, scalarSnapshot);
  if (!resized && children.length === 0) throw new Error(`Node does not support axis scaling: ${node.id}`);
}

export async function rescaleSingle(p: any) {
  if (!p.nodeId) throw new Error("scale requires id");
  const { scaleX, scaleY, uniform } = resolveScaleAxes(p);
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (uniform) {
    if (!("rescale" in node)) throw new Error(`Node does not support proportional scaling: ${p.nodeId}`);
    (node as any).rescale(scaleX);
  } else {
    await loadTextFontsInSubtree(node);
    scaleNodeAxes(node, scaleX, scaleY, false);
  }
  return {};
}

async function deleteSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  node.remove();
  return {};
}

async function cloneSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  // Clone the node as-is. InstanceNode.clone() produces a new INSTANCE referencing
  // the same component — no need to resolve to the main component first.
  const clone = (node as any).clone();
  if (p.name) clone.name = p.name;
  if (p.x !== undefined && "x" in clone) { clone.x = p.x; clone.y = p.y; }
  if (p.parentId) {
    const parent = await figma.getNodeByIdAsync(p.parentId);
    if (!parent || !("appendChild" in parent)) throw new Error(`Invalid parent: ${p.parentId}`);

    // Cross-page clone: Figma requires the target page to be loaded before appendChild.
    // Without loadAsync, the clone silently stays on the source page.
    if (parent.type === "PAGE") {
      await (parent as PageNode).loadAsync();
    } else {
      let targetPage: BaseNode | null = parent;
      while (targetPage && targetPage.type !== "PAGE") targetPage = targetPage.parent;
      if (targetPage?.type === "PAGE") await (targetPage as PageNode).loadAsync();
    }

    // Pre-validate: cloning a component into a component set with a duplicate name silently
    // corrupts the set (Figma accepts the append but properties become unreadable).
    if (parent.type === "COMPONENT_SET" && clone.type === "COMPONENT") {
      const siblings = (parent as any).children as any[] || [];
      const duplicate = siblings.find((c: any) => c.type === "COMPONENT" && c.name === clone.name);
      if (duplicate) {
        clone.remove();
        throw new Error(`Variant "${clone.name}" already exists in "${(parent as any).name}". Pass name to rename the clone before appending. Example: components(method:"clone", id:"${node.id}", name:"State=Hover", parentId:"${p.parentId}")`);
      }
    }

    try {
      (parent as any).appendChild(clone);
    } catch (e: any) {
      clone.remove();
      const isComponent = node.type === "COMPONENT" || node.type === "COMPONENT_SET";
      const parentIsComponent = parent.type === "COMPONENT" || parent.type === "COMPONENT_SET";
      if (isComponent && parentIsComponent) {
        throw new Error(`Cannot nest component "${(node as any).name}" inside component "${(parent as any).name}". Use instances(method: "create", items: [{componentId: "${node.id}", parentId: "${p.parentId}"}]) to create an instance instead.`);
      }
      throw new Error(`Cannot append "${(node as any).name}" to "${(parent as any).name}": ${e.message}`);
    }

    // Re-bind component property references on cloned variant children.
    // Figma drops componentPropertyReferences when cloning a COMPONENT into a COMPONENT_SET.
    // Walk the source and clone trees in parallel, copying bindings.
    if (parent.type === "COMPONENT_SET" && clone.type === "COMPONENT") {
      const copyRefs = (src: any, dst: any) => {
        if (src.componentPropertyReferences) {
          dst.componentPropertyReferences = { ...src.componentPropertyReferences };
        }
        if ("children" in src && "children" in dst) {
          const srcKids = src.children as any[];
          const dstKids = dst.children as any[];
          for (let i = 0; i < Math.min(srcKids.length, dstKids.length); i++) {
            copyRefs(srcKids[i], dstKids[i]);
          }
        }
      };
      copyRefs(node, clone);
    }

  } else {
    // No parentId: place on current page (not source's page).
    // clone() attaches to source's parent — reparent to current page.
    figma.currentPage.appendChild(clone);
  }
  return { id: clone.id };
}

async function insertSingle(p: any) {
  const parent = await figma.getNodeByIdAsync(p.parentId);
  if (!parent) throw new Error(`Parent not found: ${p.parentId}`);
  if (!("insertChild" in parent)) throw new Error(`Parent does not support children: ${p.parentId}. Only FRAME, COMPONENT, GROUP, SECTION, SLOT, and PAGE nodes can have children.`);
  const child = await figma.getNodeByIdAsync(p.childId);
  if (!child) throw new Error(`Child not found: ${p.childId}`);
  if (p.index !== undefined) (parent as any).insertChild(p.index, child);
  else (parent as any).appendChild(child);
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  move_node: (p) => batchHandler(p, moveSingle),
  resize_node: (p) => batchHandler(p, resizeSingle),
  rescale_node: (p) => batchHandler(p, rescaleSingle),
  delete_node: (p) => batchHandler(p, deleteSingle),
  // Legacy alias
  delete_multiple_nodes: async (p) => batchHandler({ items: (p.nodeIds || []).map((id: string) => ({ nodeId: id })) }, deleteSingle),
  clone_node: (p) => batchHandler(p, cloneSingle),
  insert_child: (p) => batchHandler(p, insertSingle),
};
