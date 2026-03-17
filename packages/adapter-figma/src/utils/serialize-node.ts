import { rgbaToHex } from "@ufira/vibma/utils/color";

/** Strip Figma's internal hash suffix from property keys: "Label#1:0" → "Label" */
function cleanPropKey(key: string): string {
  const idx = key.indexOf("#");
  return idx > 0 ? key.slice(0, idx) : key;
}

/** Compact componentProperties: strip hash keys, drop empties, flatten to value where possible */
export function serializeComponentProperties(cp: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, prop] of Object.entries(cp)) {
    const clean = cleanPropKey(key);
    if (prop.type === "VARIANT" || prop.type === "TEXT" || prop.type === "BOOLEAN") {
      out[clean] = prop.value;
    } else if (prop.type === "INSTANCE_SWAP") {
      out[clean] = { type: "INSTANCE_SWAP", value: prop.value };
    }
  }
  return out;
}

/**
 * Return a variable name that's safe to pass back to findVariableByName.
 * Prefixes with "CollectionName/" when the name exists in multiple collections.
 */
async function disambiguatedVarName(v: Variable): Promise<string> {
  const all = await figma.variables.getLocalVariablesAsync(v.resolvedType);
  const dupes = all.filter(other => other.name === v.name && other.id !== v.id);
  if (dupes.length === 0) return v.name;
  const col = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
  return col ? `${col.name}/${v.name}` : v.name;
}

/**
 * Serialize a Figma plugin node to a plain object using only the plugin API.
 * This replaces the exportAsync({ format: "JSON_REST_V1" }) + filterFigmaNode
 * approach, which returned REST API IDs that could differ from plugin node.id.
 *
 * @param node      - A Figma plugin BaseNode
 * @param depth     - Child recursion depth. -1 = unlimited, 0 = stubs only.
 * @param budget    - Shared counter: { remaining: N }. Stops recursing when 0.
 */
export const DEFAULT_NODE_BUDGET = 200;

export async function serializeNode(
  node: BaseNode,
  depth: number = -1,
  currentDepth: number = 0,
  budget: { remaining: number } = { remaining: DEFAULT_NODE_BUDGET },
  verbose: boolean = false,
): Promise<any> {
  if (budget.remaining <= 0) {
    return { id: node.id, name: node.name, type: node.type, _truncated: true };
  }
  budget.remaining--;
  // VECTORs: always a stub — no useful extractable properties
  if (node.type === "VECTOR") {
    return { id: node.id, name: node.name, type: node.type };
  }

  const out: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Parent info at root level
  if (currentDepth === 0 && node.parent) {
    out.parentId = node.parent.id;
    out.parentName = node.parent.name;
    out.parentType = node.parent.type;
  }

  // ── Fills ──────────────────────────────────────────────────────
  if ("fills" in node) {
    const fills = (node as any).fills;
    if (fills !== figma.mixed && Array.isArray(fills) && fills.length > 0) {
      out.fills = fills.map(serializePaint);
    }
  }

  // ── Strokes ────────────────────────────────────────────────────
  if ("strokes" in node) {
    const strokes = (node as any).strokes;
    if (Array.isArray(strokes) && strokes.length > 0) {
      out.strokes = strokes.map(serializePaint);
    }
  }

  // ── Corner radius ─────────────────────────────────────────────
  if ("cornerRadius" in node) {
    const cr = (node as any).cornerRadius;
    if (cr !== undefined && cr !== figma.mixed && cr > 0) {
      out.cornerRadius = cr;
    } else if (cr === figma.mixed && "topLeftRadius" in node) {
      out.topLeftRadius = (node as any).topLeftRadius;
      out.topRightRadius = (node as any).topRightRadius;
      out.bottomRightRadius = (node as any).bottomRightRadius;
      out.bottomLeftRadius = (node as any).bottomLeftRadius;
    }
  }

  // ── Stroke weight ────────────────────────────────────────────
  if ("strokeWeight" in node) {
    const sw = (node as any).strokeWeight;
    if (sw !== undefined && sw !== figma.mixed && sw > 0 && (verbose || out.strokes)) out.strokeWeight = sw;
  }

  // ── Bounding box ──────────────────────────────────────────────
  if (verbose) {
    if ("absoluteBoundingBox" in node && (node as any).absoluteBoundingBox) {
      out.absoluteBoundingBox = (node as any).absoluteBoundingBox;
    } else if ("absoluteTransform" in node && "width" in node) {
      const t = (node as any).absoluteTransform;
      if (t) {
        out.absoluteBoundingBox = {
          x: t[0][2], y: t[1][2],
          width: (node as any).width,
          height: (node as any).height,
        };
      }
    }
  }

  // ── Clips content ────────────────────────────────────────────
  if (verbose && "clipsContent" in node) {
    out.clipsContent = (node as any).clipsContent;
  }

  // ── Text content ──────────────────────────────────────────────
  if ("characters" in node) {
    out.characters = (node as any).characters;
  }

  // ── Instance → source component ───────────────────────────────
  if (node.type === "INSTANCE") {
    const inst = node as InstanceNode;
    try {
      const main = await inst.getMainComponentAsync();
      if (main && !main.remote) out.componentId = main.id;
    } catch {
      // mainComponent unavailable (e.g. remote library not loaded)
    }
    const cp = (inst as any).componentProperties;
    if (cp && typeof cp === "object" && Object.keys(cp).length > 0) {
      out.componentProperties = serializeComponentProperties(cp);
    }
    const overrides = (inst as any).overrides || [];
    if (overrides.length > 0) {
      out.overrides = overrides.map((o: any) => ({ id: o.id, fields: o.overriddenFields }));
    }
  }

  // ── Component / Component Set ──────────────────────────────────
  if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
    const comp = node as any;
    const isVariant = node.type === "COMPONENT" && node.parent?.type === "COMPONENT_SET";
    if (comp.description) out.description = comp.description;
    // componentPropertyDefinitions throws on variant components — defs live on the parent set
    if (!isVariant && comp.componentPropertyDefinitions) {
      out.propertyDefinitions = comp.componentPropertyDefinitions;
    }
    if (node.type === "COMPONENT_SET") {
      if (comp.variantGroupProperties) out.variantGroupProperties = comp.variantGroupProperties;
      if ("children" in comp) out.variantCount = comp.children.length;
    }
    if (isVariant && comp.variantProperties) {
      out.variantProperties = comp.variantProperties;
    }
  }

  // ── Component property references ──────────────────────────────
  if ("componentPropertyReferences" in node) {
    const refs = (node as any).componentPropertyReferences;
    if (refs && typeof refs === "object" && Object.keys(refs).length > 0) out.componentPropertyReferences = refs;
  }

  // ── Text style ────────────────────────────────────────────────
  if (node.type === "TEXT") {
    const t = node as TextNode;
    if (verbose) {
      const style: any = {};
      if (t.fontName !== figma.mixed) {
        style.fontFamily = (t.fontName as FontName).family;
        style.fontStyle = (t.fontName as FontName).style;
      }
      if (t.fontSize !== figma.mixed) style.fontSize = t.fontSize;
      if (t.textAlignHorizontal) style.textAlignHorizontal = t.textAlignHorizontal;
      if (t.letterSpacing !== figma.mixed) {
        const ls = t.letterSpacing as LetterSpacing;
        style.letterSpacing = ls.unit === "PIXELS" ? ls.value : ls;
      }
      if (t.lineHeight !== figma.mixed) {
        const lh = t.lineHeight as LineHeight;
        if (lh.unit === "PIXELS") style.lineHeightPx = lh.value;
        else if (lh.unit !== "AUTO") style.lineHeight = lh;
      }
      if (Object.keys(style).length > 0) out.style = style;
    }
    if (t.textAutoResize) out.textAutoResize = t.textAutoResize;
  }

  // ── Effects ───────────────────────────────────────────────────
  if ("effects" in node) {
    const effects = (node as any).effects;
    if (Array.isArray(effects) && effects.length > 0) {
      out.effects = effects.map((e: any) => {
        const eff: any = { type: e.type, visible: e.visible };
        if (e.radius !== undefined) eff.radius = e.radius;
        if (e.color) eff.color = rgbaToHex(e.color);
        if (e.offset) eff.offset = e.offset;
        if (e.spread !== undefined) eff.spread = e.spread;
        if (e.blendMode) eff.blendMode = e.blendMode;
        return eff;
      });
    }
  }

  // ── Layout ────────────────────────────────────────────────────
  if ("layoutMode" in node) {
    const lm = (node as any).layoutMode;
    if (lm && lm !== "NONE") {
      out.layoutMode = lm;
      // These only matter when auto-layout is active
      const n = node as any;
      if (n.layoutWrap && n.layoutWrap !== "NO_WRAP") out.layoutWrap = n.layoutWrap;
      if (n.primaryAxisAlignItems && n.primaryAxisAlignItems !== "MIN") out.primaryAxisAlignItems = n.primaryAxisAlignItems;
      if (n.counterAxisAlignItems && n.counterAxisAlignItems !== "MIN") out.counterAxisAlignItems = n.counterAxisAlignItems;
      if (n.counterAxisSpacing !== undefined && n.counterAxisSpacing > 0) out.counterAxisSpacing = n.counterAxisSpacing;
    }
  }
  if ("itemSpacing" in node) {
    const is = (node as any).itemSpacing;
    if (is !== undefined && is > 0) out.itemSpacing = is;
  }
  if ("paddingLeft" in node) {
    const n = node as any;
    if (n.paddingLeft || n.paddingRight || n.paddingTop || n.paddingBottom) {
      out.padding = {
        left: n.paddingLeft, right: n.paddingRight,
        top: n.paddingTop, bottom: n.paddingBottom,
      };
    }
  }

  // ── Opacity / visibility / locked ────────────────────────────
  if ("opacity" in node) {
    const op = (node as any).opacity;
    if (op !== undefined && op !== 1) out.opacity = op;
  }
  if ("visible" in node && !(node as any).visible) {
    out.visible = false;
  }
  if ("locked" in node && (node as any).locked) {
    out.locked = true;
  }

  // ── Rotation ───────────────────────────────────────────────────
  if ("rotation" in node) {
    const rot = (node as any).rotation;
    if (rot !== undefined && rot !== 0) out.rotation = rot;
  }

  // ── Blend mode ─────────────────────────────────────────────────
  if ("blendMode" in node) {
    const bm = (node as any).blendMode;
    if (bm && bm !== "PASS_THROUGH") out.blendMode = bm;
  }

  // ── Layout positioning ─────────────────────────────────────────
  if ("layoutPositioning" in node) {
    const lp = (node as any).layoutPositioning;
    if (lp === "ABSOLUTE") out.layoutPositioning = lp;
  }

  // ── Layout sizing ──────────────────────────────────────────────
  if ("layoutSizingHorizontal" in node) {
    out.layoutSizingHorizontal = (node as any).layoutSizingHorizontal;
  }
  if ("layoutSizingVertical" in node) {
    out.layoutSizingVertical = (node as any).layoutSizingVertical;
  }

  // ── Overflow & scroll ────────────────────────────────────────────
  if ("overflowDirection" in node) {
    const od = (node as any).overflowDirection;
    if (od && od !== "NONE") out.overflowDirection = od;
  }
  // ── Overlay settings (verbose only, read-only in Figma API) ────
  if (verbose && "overlayPositionType" in node) {
    const n = node as any;
    if (n.overlayPositionType && n.overlayPositionType !== "CENTER") out.overlayPositionType = n.overlayPositionType;
    if (n.overlayBackground) out.overlayBackground = n.overlayBackground;
    if (n.overlayBackgroundInteraction && n.overlayBackgroundInteraction !== "NONE") out.overlayBackgroundInteraction = n.overlayBackgroundInteraction;
  }

  // ── Reactions (verbose only) ───────────────────────────────────
  if (verbose && "reactions" in node) {
    const reactions = (node as any).reactions;
    if (Array.isArray(reactions) && reactions.length > 0) {
      out.reactions = reactions.map(serializeReaction);
    }
  }

  // ── Min/max dimensions ─────────────────────────────────────────
  if ("minWidth" in node) {
    const n = node as any;
    if (n.minWidth != null && n.minWidth > 0) out.minWidth = n.minWidth;
    if (n.maxWidth != null && n.maxWidth < Infinity) out.maxWidth = n.maxWidth;
    if (n.minHeight != null && n.minHeight > 0) out.minHeight = n.minHeight;
    if (n.maxHeight != null && n.maxHeight < Infinity) out.maxHeight = n.maxHeight;
  }

  // ── Applied styles ──────────────────────────────────────────
  if ("fillStyleId" in node) {
    const id = (node as any).fillStyleId;
    if (id && id !== "" && id !== figma.mixed) {
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && !s.remote) out.fillStyleName = s.name;
      } catch {}
    }
  }
  if ("strokeStyleId" in node) {
    const id = (node as any).strokeStyleId;
    if (id && id !== "") {
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && !s.remote) out.strokeStyleName = s.name;
      } catch {}
    }
  }
  if ("effectStyleId" in node) {
    const id = (node as any).effectStyleId;
    if (id && id !== "") {
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && !s.remote) out.effectStyleName = s.name;
      } catch {}
    }
  }
  if ("textStyleId" in node) {
    const id = (node as any).textStyleId;
    if (id && id !== "" && id !== figma.mixed) {
      try {
        const s = await figma.getStyleByIdAsync(id);
        if (s && !s.remote) out.textStyleName = s.name;
      } catch {}
    }
  }

  // ── Variable bindings ────────────────────────────────────────
  if ("boundVariables" in node) {
    const bv = (node as any).boundVariables;
    if (bv && typeof bv === "object") {
      const bindings: Record<string, any> = {};
      for (const [field, val] of Object.entries(bv)) {
        if (Array.isArray(val)) {
          for (const v of val) {
            if (!v?.id) continue;
            const resolved = await figma.variables.getVariableByIdAsync(v.id);
            if (resolved && !resolved.remote) bindings[field] = await disambiguatedVarName(resolved);
          }
        } else if (val && typeof val === "object" && (val as any).id) {
          const resolved = await figma.variables.getVariableByIdAsync((val as any).id);
          if (resolved && !resolved.remote) bindings[field] = await disambiguatedVarName(resolved);
        }
      }
      if (Object.keys(bindings).length > 0) out.boundVariables = bindings;
    }
  }

  // ── Explicit variable modes ──────────────────────────────────
  if ("explicitVariableModes" in node) {
    const modes = (node as any).explicitVariableModes;
    if (modes && typeof modes === "object" && Object.keys(modes).length > 0) {
      out.explicitVariableModes = modes;
    }
  }

  // ── Constraints ───────────────────────────────────────────────
  if (verbose && "constraints" in node) {
    out.constraints = (node as any).constraints;
  }

  // ── Children ──────────────────────────────────────────────────
  if ("children" in node) {
    const children = (node as any).children as readonly BaseNode[];
    if ((depth >= 0 && currentDepth >= depth) || budget.remaining <= 0) {
      // Stubs only (depth limit reached or budget exhausted)
      const stubs: any[] = [];
      for (const c of children) {
        const stub: any = { id: c.id, name: c.name, type: c.type };
        if (budget.remaining <= 0) stub._truncated = true;
        if (c.type === "INSTANCE") {
          const inst = c as InstanceNode;
          try {
            const main = await inst.getMainComponentAsync();
            if (main && !main.remote) stub.componentId = main.id;
          } catch {}
          const cp = inst.componentProperties;
          if (cp && Object.keys(cp).length > 0) {
            stub.componentProperties = serializeComponentProperties(cp);
          }
        }
        stubs.push(stub);
      }
      out.children = stubs;
    } else {
      // Sequential to keep budget counter deterministic (shared mutable ref)
      const serialized: any[] = [];
      for (const c of children) {
        serialized.push(await serializeNode(c, depth, currentDepth + 1, budget, verbose));
      }
      out.children = serialized;
    }
  }

  return out;
}

// ── Paint serialization ───────────────────────────────────────────

function serializeReactionAction(a: any): any {
  const act: any = { type: a.type };
  if (a.destinationId) act.destinationId = a.destinationId;
  if (a.navigation) act.navigation = a.navigation;
  if (a.transition) {
    const t: any = { type: a.transition.type };
    if (a.transition.duration !== undefined) t.duration = a.transition.duration;
    if (a.transition.easing) t.easing = a.transition.easing.type || a.transition.easing;
    if (a.transition.direction) t.direction = a.transition.direction;
    if (a.transition.matchLayers) t.matchLayers = true;
    act.transition = t;
  }
  if (a.url) act.url = a.url;
  if (a.variableCollectionId) act.variableCollectionId = a.variableCollectionId;
  if (a.variableModeId) act.variableModeId = a.variableModeId;
  if (a.variableId) act.variableId = a.variableId;
  if (a.variableValue !== undefined) act.variableValue = a.variableValue;
  if (a.resetScrollPosition === false) act.resetScrollPosition = false;
  if (a.overlayPositionType) act.overlayPositionType = a.overlayPositionType;
  if (a.overlayRelativePosition) act.overlayRelativePosition = a.overlayRelativePosition;
  return act;
}

function serializeReaction(r: any): any {
  const out: any = {};
  if (r.trigger) out.trigger = r.trigger;
  if (r.actions && Array.isArray(r.actions)) {
    out.actions = r.actions.map(serializeReactionAction);
  }
  return out;
}

function serializePaint(paint: any): any {
  const p: any = { type: paint.type };
  if (paint.visible === false) p.visible = false;
  if (paint.opacity !== undefined && paint.opacity !== 1) p.opacity = paint.opacity;
  if (paint.blendMode && paint.blendMode !== "NORMAL") p.blendMode = paint.blendMode;
  if (paint.color) {
    // Plugin API: color = {r,g,b}, opacity separate. Merge for hex.
    p.color = rgbaToHex({ ...paint.color, a: paint.opacity ?? 1 });
  }
  if (paint.gradientStops) {
    p.gradientStops = paint.gradientStops.map((stop: any) => ({
      position: stop.position,
      color: rgbaToHex(stop.color),
    }));
  }
  if (paint.gradientTransform) p.gradientTransform = paint.gradientTransform;
  if (paint.scaleMode) p.scaleMode = paint.scaleMode;
  return p;
}
