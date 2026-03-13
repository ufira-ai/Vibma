/**
 * YAML loader — reads all schema files and resolves $ref references.
 */
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parse as parseYaml } from "yaml";
import type { RawDef, RawBaseDef, RawEndpointDef, RawParam } from "./types";
import { isBaseDef, isEndpointDef } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(__dirname, "..");

/** Load shared $ref definitions from refs/ */
function loadRefs(): Record<string, RawParam> {
  const refs: Record<string, RawParam> = {};
  const refsDir = join(SCHEMA_DIR, "refs");
  for (const file of readdirSync(refsDir).filter(f => f.endsWith(".yaml"))) {
    const data = parseYaml(readFileSync(join(refsDir, file), "utf-8"));
    for (const [key, value] of Object.entries(data)) {
      refs[key] = value as RawParam;
    }
  }
  return refs;
}

/** Load param group mixins from mixins/ */
function loadMixins(): Record<string, Record<string, RawParam>> {
  const mixins: Record<string, Record<string, RawParam>> = {};
  const mixinsDir = join(SCHEMA_DIR, "mixins");
  try {
    for (const file of readdirSync(mixinsDir).filter(f => f.endsWith(".yaml"))) {
      const data = parseYaml(readFileSync(join(mixinsDir, file), "utf-8"));
      for (const [key, value] of Object.entries(data)) {
        mixins[key] = value as Record<string, RawParam>;
      }
    }
  } catch { /* mixins dir may not exist */ }
  return mixins;
}

/**
 * Apply $mixin to a params block: merge mixin params, then overlay explicit params.
 * Supports single name or array: $mixin: frame_params | $mixin: [geometry_params, blend_params]
 * Explicit params with the same name override mixin params.
 */
function applyMixins(params: Record<string, any>, mixins: Record<string, Record<string, RawParam>>): Record<string, RawParam> {
  const mixinRef = params.$mixin;
  if (!mixinRef) return params;
  const { $mixin, ...explicit } = params;
  const names = Array.isArray(mixinRef) ? mixinRef : [mixinRef];
  let merged: Record<string, RawParam> = {};
  for (const name of names) {
    const mixin = mixins[name];
    if (!mixin) throw new Error(`Unknown $mixin: ${name}`);
    merged = { ...merged, ...structuredClone(mixin) };
  }
  return { ...merged, ...explicit };
}

/** Recursively resolve $ref and $mixin in a param tree */
function resolveParam(param: RawParam, refs: Record<string, RawParam>, mixins: Record<string, Record<string, RawParam>>): RawParam {
  if (param.$ref) {
    const ref = refs[param.$ref];
    if (!ref) throw new Error(`Unknown $ref: ${param.$ref}`);
    // Merge: explicit fields override the ref
    const { $ref, ...rest } = param;
    const resolved = { ...structuredClone(ref), ...rest };
    return resolveParam(resolved, refs, mixins);
  }
  // Resolve nested properties (with $mixin support)
  if (param.properties) {
    let props = param.properties as Record<string, any>;
    if (props.$mixin) {
      props = applyMixins(props, mixins);
    }
    const resolved: Record<string, RawParam> = {};
    for (const [k, v] of Object.entries(props)) {
      resolved[k] = resolveParam(v, refs, mixins);
    }
    param = { ...param, properties: resolved };
  }
  // Resolve array items (recurse to handle $ref, $mixin, and nested properties)
  if (param.items && typeof param.items === "object") {
    param = { ...param, items: resolveParam(param.items as RawParam, refs, mixins) };
  }
  return param;
}

/** Resolve all $ref and $mixin in an endpoint's methods */
function resolveEndpoint(def: RawEndpointDef, refs: Record<string, RawParam>, mixins: Record<string, Record<string, RawParam>>): RawEndpointDef {
  const resolved = structuredClone(def);
  for (const method of Object.values(resolved.methods)) {
    if (method.params && typeof method.params === "object") {
      const resolvedParams: Record<string, RawParam> = {};
      for (const [k, v] of Object.entries(method.params)) {
        resolvedParams[k] = resolveParam(v as RawParam, refs, mixins);
      }
      method.params = resolvedParams;
    }
    // Resolve discriminated types params (apply $mixin first, then $ref)
    if (method.types) {
      for (const variant of Object.values(method.types)) {
        variant.params = applyMixins(variant.params, mixins);
        const resolvedParams: Record<string, RawParam> = {};
        for (const [k, v] of Object.entries(variant.params)) {
          resolvedParams[k] = resolveParam(v as RawParam, refs, mixins);
        }
        variant.params = resolvedParams;
      }
    }
  }
  return resolved;
}

/** Resolve all $ref in a base definition */
function resolveBase(def: RawBaseDef, refs: Record<string, RawParam>, mixins: Record<string, Record<string, RawParam>>): RawBaseDef {
  const resolved = structuredClone(def);
  for (const method of Object.values(resolved.methods)) {
    if (method.params && typeof method.params === "object") {
      const resolvedParams: Record<string, RawParam> = {};
      for (const [k, v] of Object.entries(method.params)) {
        resolvedParams[k] = resolveParam(v as RawParam, refs, mixins);
      }
      method.params = resolvedParams;
    }
  }
  return resolved;
}

export interface ParseResult {
  bases: Map<string, RawBaseDef>;
  endpoints: RawEndpointDef[];
  mixins: Record<string, Record<string, RawParam>>;
}

/** Load and parse all YAML schema files */
export function parseAll(): ParseResult {
  const refs = loadRefs();
  const mixins = loadMixins();
  const bases = new Map<string, RawBaseDef>();
  const endpoints: RawEndpointDef[] = [];

  // Load base definitions
  const baseDir = join(SCHEMA_DIR, "base");
  for (const file of readdirSync(baseDir).filter(f => f.endsWith(".yaml"))) {
    const raw = parseYaml(readFileSync(join(baseDir, file), "utf-8")) as RawDef;
    if (isBaseDef(raw)) {
      bases.set(raw.base, resolveBase(raw, refs, mixins));
    }
  }

  // Load endpoint definitions
  const toolsDir = join(SCHEMA_DIR, "tools");
  for (const file of readdirSync(toolsDir).filter(f => f.endsWith(".yaml"))) {
    const raw = parseYaml(readFileSync(join(toolsDir, file), "utf-8")) as RawDef;
    if (isEndpointDef(raw)) {
      endpoints.push(resolveEndpoint(raw, refs, mixins));
    }
  }

  return { bases, endpoints, mixins };
}
