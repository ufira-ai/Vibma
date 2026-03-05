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

/** Recursively resolve $ref in a param tree */
function resolveParam(param: RawParam, refs: Record<string, RawParam>): RawParam {
  if (param.$ref) {
    const ref = refs[param.$ref];
    if (!ref) throw new Error(`Unknown $ref: ${param.$ref}`);
    // Merge: explicit fields override the ref
    const { $ref, ...rest } = param;
    const resolved = { ...structuredClone(ref), ...rest };
    return resolveParam(resolved, refs);
  }
  // Resolve nested properties
  if (param.properties) {
    const resolved: Record<string, RawParam> = {};
    for (const [k, v] of Object.entries(param.properties)) {
      resolved[k] = resolveParam(v, refs);
    }
    param = { ...param, properties: resolved };
  }
  // Resolve array items (recurse to handle $ref and nested properties)
  if (param.items && typeof param.items === "object") {
    param = { ...param, items: resolveParam(param.items as RawParam, refs) };
  }
  return param;
}

/** Resolve all $ref in an endpoint's methods */
function resolveEndpoint(def: RawEndpointDef, refs: Record<string, RawParam>): RawEndpointDef {
  const resolved = structuredClone(def);
  for (const method of Object.values(resolved.methods)) {
    if (method.params && typeof method.params === "object") {
      const resolvedParams: Record<string, RawParam> = {};
      for (const [k, v] of Object.entries(method.params)) {
        resolvedParams[k] = resolveParam(v as RawParam, refs);
      }
      method.params = resolvedParams;
    }
    // Resolve discriminated types params
    if (method.types) {
      for (const variant of Object.values(method.types)) {
        const resolvedParams: Record<string, RawParam> = {};
        for (const [k, v] of Object.entries(variant.params)) {
          resolvedParams[k] = resolveParam(v as RawParam, refs);
        }
        variant.params = resolvedParams;
      }
    }
  }
  return resolved;
}

/** Resolve all $ref in a base definition */
function resolveBase(def: RawBaseDef, refs: Record<string, RawParam>): RawBaseDef {
  const resolved = structuredClone(def);
  for (const method of Object.values(resolved.methods)) {
    if (method.params && typeof method.params === "object") {
      const resolvedParams: Record<string, RawParam> = {};
      for (const [k, v] of Object.entries(method.params)) {
        resolvedParams[k] = resolveParam(v as RawParam, refs);
      }
      method.params = resolvedParams;
    }
  }
  return resolved;
}

export interface ParseResult {
  bases: Map<string, RawBaseDef>;
  endpoints: RawEndpointDef[];
}

/** Load and parse all YAML schema files */
export function parseAll(): ParseResult {
  const refs = loadRefs();
  const bases = new Map<string, RawBaseDef>();
  const endpoints: RawEndpointDef[] = [];

  // Load base definitions
  const baseDir = join(SCHEMA_DIR, "base");
  for (const file of readdirSync(baseDir).filter(f => f.endsWith(".yaml"))) {
    const raw = parseYaml(readFileSync(join(baseDir, file), "utf-8")) as RawDef;
    if (isBaseDef(raw)) {
      bases.set(raw.base, resolveBase(raw, refs));
    }
  }

  // Load endpoint definitions
  const toolsDir = join(SCHEMA_DIR, "tools");
  for (const file of readdirSync(toolsDir).filter(f => f.endsWith(".yaml"))) {
    const raw = parseYaml(readFileSync(join(toolsDir, file), "utf-8")) as RawDef;
    if (isEndpointDef(raw)) {
      endpoints.push(resolveEndpoint(raw, refs));
    }
  }

  return { bases, endpoints };
}
