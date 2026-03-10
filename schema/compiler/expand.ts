/**
 * $expand processor — generates sibling params from shorthand definitions.
 *
 * Supported presets:
 *   corners  → cornerRadius + topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius
 *   padding  → padding + paddingTop, paddingRight, paddingBottom, paddingLeft
 *   stroke   → strokeWeight + strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight
 *
 * All expanded fields use the `token` type: accepts a number (hardcoded value)
 * or a string (variable name/ID for binding). This eliminates the need for
 * separate *VariableName fields.
 *
 * Usage in YAML:
 *   cornerRadius:
 *     $expand: corners
 *     type: token
 *
 * The processor replaces the single param with the full set.
 */
import type { RawParam, RawMethodDef, RawEndpointDef, RawBaseDef, RawDef } from "./types";
import { isBaseDef, isEndpointDef } from "./types";

interface ExpandPreset {
  /** Generated per-part field names */
  parts: string[];
  /** Description for the shorthand field */
  shorthandDesc: string;
}

const PRESETS: Record<string, ExpandPreset> = {
  corners: {
    parts: ["topLeftRadius", "topRightRadius", "bottomRightRadius", "bottomLeftRadius"],
    shorthandDesc: "All corners (number) or variable name (string). Per-corner: topLeftRadius, topRightRadius, bottomRightRadius, bottomLeftRadius.",
  },
  padding: {
    parts: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
    shorthandDesc: "All edges (number) or variable name (string). Per-edge: paddingTop, paddingRight, paddingBottom, paddingLeft.",
  },
  stroke: {
    parts: ["strokeTopWeight", "strokeBottomWeight", "strokeLeftWeight", "strokeRightWeight"],
    shorthandDesc: "All sides (number) or variable name (string). Per-side: strokeTopWeight, strokeBottomWeight, strokeLeftWeight, strokeRightWeight.",
  },
};

/** Expand a single param with $expand into multiple params */
function expandParam(name: string, param: RawParam): Record<string, RawParam> | null {
  const presetName = (param as any).$expand;
  if (!presetName) return null;

  const preset = PRESETS[presetName];
  if (!preset) throw new Error(`Unknown $expand preset: "${presetName}" on param "${name}"`);

  // Base properties inherited by all expanded fields
  const { $expand, description, coerce, ...base } = param as any;
  const result: Record<string, RawParam> = {};

  // All expanded fields use the token type (number | variable name)
  const tokenBase = { ...base, type: "token" };

  // 1. The shorthand field itself
  result[name] = { ...tokenBase, optional: true, description: description || preset.shorthandDesc };

  // 2. Per-part fields
  for (const part of preset.parts) {
    result[part] = { ...tokenBase, optional: true };
  }

  return result;
}

/** Process all params in a method, expanding $expand directives */
function expandMethodParams(params: Record<string, RawParam>): Record<string, RawParam> {
  const result: Record<string, RawParam> = {};
  for (const [name, param] of Object.entries(params)) {
    const expanded = expandParam(name, param);
    if (expanded) {
      Object.assign(result, expanded);
    } else {
      result[name] = param;
    }
  }
  return result;
}

/** Process all methods in a definition, expanding $expand in params and discriminated types */
function expandMethods(methods: Record<string, RawMethodDef>): Record<string, RawMethodDef> {
  const result: Record<string, RawMethodDef> = {};
  for (const [name, method] of Object.entries(methods)) {
    const expanded = { ...method };
    if (expanded.params && typeof expanded.params === "object" && Object.keys(expanded.params).length > 0) {
      expanded.params = expandMethodParams(expanded.params as Record<string, RawParam>);
    }
    // Also expand inside discriminated type variants
    if (expanded.types) {
      const expandedTypes: Record<string, { description?: string; params: Record<string, RawParam> }> = {};
      for (const [typeName, variant] of Object.entries(expanded.types)) {
        expandedTypes[typeName] = {
          ...variant,
          params: expandMethodParams(variant.params),
        };
      }
      expanded.types = expandedTypes;
    }
    result[name] = expanded;
  }
  return result;
}

/** Run $expand processing on all definitions */
export function expandAll(defs: RawDef[]): void {
  for (const def of defs) {
    if (isEndpointDef(def)) {
      (def as RawEndpointDef).methods = expandMethods(def.methods);
    } else if (isBaseDef(def)) {
      (def as RawBaseDef).methods = expandMethods(def.methods);
    }
  }
}
