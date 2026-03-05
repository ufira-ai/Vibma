/**
 * Generate tool descriptions: TS interfaces for shapes + compact DSL for methods.
 *
 * - Interfaces define resource shapes once (reusable, detailed)
 * - Method DSL describes operations compactly, referencing type names
 */
import type { ResolvedEndpoint, ResolvedMethod, RawParam, RawResponse } from "./types";

// ─── TypeScript type conversion ───────────────────────────────────

function paramToTs(param: RawParam): string {
  if (param.tsType) return param.tsType;
  if (param.const) return `"${param.const}"`;
  if (param.coerce === "hex_or_rgba") return "Color";
  if (param.values) return param.values.map(v => `"${v}"`).join(" | ");

  const type = param.type ?? "string";
  if (type === "string") return "string";
  if (type === "number") return "number";
  if (type === "boolean") return "boolean";
  if (type === "string[]") return "string[]";
  if (type === "enum") return (param.values ?? []).map(v => `"${v}"`).join(" | ");

  if (type === "array") {
    if (param.items && typeof param.items === "object") {
      if ("properties" in param.items && param.items.properties)
        return `${propsToObj(param.items.properties)}[]`;
      if ("type" in param.items) {
        const t = param.items.type;
        return `${t === "string" ? "string" : t === "number" ? "number" : "any"}[]`;
      }
    }
    return "any[]";
  }

  if (type === "object") {
    if (param.properties) return propsToObj(param.properties);
    return "Record<string, any>";
  }
  return "any";
}

function propsToObj(properties: Record<string, RawParam>): string {
  const parts: string[] = [];
  for (const [name, param] of Object.entries(properties)) {
    parts.push(`${name}${isOpt(param) ? "?" : ""}: ${paramToTs(param)}`);
  }
  return `{ ${parts.join("; ")} }`;
}

function isOpt(param: RawParam): boolean {
  if (param.optional) return true;
  if (param.required === true) return false;
  if (param.required === false) return true;
  if (param.values) return false;
  return true;
}

function pascalCase(s: string): string {
  return s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

// ─── Compact method DSL ───────────────────────────────────────────

/** Compact param for method DSL — just name? with type only when non-obvious */
function dslParam(name: string, param: RawParam): string {
  const opt = isOpt(param) ? "?" : "";

  // Show type for enums (discriminants), typed arrays with tsType, and complex objects
  if (param.values) {
    return `${name}: ${param.values.join("|")}`;
  }
  if (param.tsType) {
    return `${name}${opt}: ${param.tsType}`;
  }
  // Show inline type for items arrays with properties
  if ((param.type === "array") && param.items && typeof param.items === "object" && "properties" in param.items && param.items.properties) {
    return `${name}${opt}: ${propsToObj(param.items.properties)}[]`;
  }
  return `${name}${opt}`;
}

/** Compact response for method DSL */
function dslResponse(response: RawResponse): string {
  if (response.type === "string") return "string";
  if (response.type === "batch") return "{ results: {id}[] }";
  if (response.type === "batch_ok") return '{ results: "ok"[] }';
  if (response.type === "batch_mixed") return '{ results: ("ok" | {error})[] }';
  if (response.type === "paginated") return "{ totalCount, items }";

  if (response.type === "object" && response.properties) {
    const required = new Set(response.required ?? []);
    const parts: string[] = [];
    for (const [name, param] of Object.entries(response.properties)) {
      const opt = !required.has(name);
      // For arrays, show the tsType if available
      if (param.tsType) {
        parts.push(`${name}${opt ? "?" : ""}: ${param.tsType}`);
      } else {
        parts.push(`${name}${opt ? "?" : ""}`);
      }
    }
    return `{ ${parts.join(", ")} }`;
  }
  return "any";
}

/** Generate compact method line */
function methodLine(method: ResolvedMethod): string {
  const name = method.name.padEnd(10);

  let params: string;
  if (method.discriminant && method.types) {
    const typeNames = Object.keys(method.types).join("|");
    const itemNames = Object.keys(method.types).map(t => pascalCase(t) + "Item");
    params = `${method.discriminant}: ${typeNames}, items: (${itemNames.join(" | ")})[]`;
  } else {
    const parts: string[] = [];
    for (const [pName, param] of Object.entries(method.params ?? {})) {
      parts.push(dslParam(pName, param));
    }
    params = parts.join(", ");
  }

  const ret = dslResponse(method.response);
  const desc = method.description ? `  // ${method.description}` : "";
  return `  ${name}(${params}) → ${ret}${desc}`;
}

// ─── Interface generation ─────────────────────────────────────────

function generateInterface(name: string, params: Record<string, RawParam>): string {
  const entries = Object.entries(params ?? {});
  if (entries.length === 0) return `  interface ${name} {}`;

  const lines: string[] = [];
  for (const [pName, param] of entries) {
    const opt = isOpt(param) ? "?" : "";
    const type = paramToTs(param);
    const desc = param.description ? ` // ${param.description}` : "";
    lines.push(`    ${pName}${opt}: ${type};${desc}`);
  }
  return `  interface ${name} {\n${lines.join("\n")}\n  }`;
}

// ─── Main ─────────────────────────────────────────────────────────

export function generateDescription(endpoint: ResolvedEndpoint): string {
  const sections: string[] = [];

  // 1. Summary + method DSL
  sections.push(`/** ${endpoint.description.trim()} */`);
  const methodLines: string[] = [];
  for (const method of endpoint.methods) {
    methodLines.push(methodLine(method));
  }
  sections.push(methodLines.join("\n"));

  // 2. Interfaces for discriminated create types
  for (const method of endpoint.methods) {
    if (method.discriminant && method.types) {
      const ifaces: string[] = [];
      for (const [typeName, variant] of Object.entries(method.types)) {
        ifaces.push(generateInterface(pascalCase(typeName) + "Item", variant.params));
      }
      sections.push(ifaces.join("\n"));
    }
  }

  // 3. Notes from YAML (shared types, usage)
  if (endpoint.notes) {
    sections.push(endpoint.notes.trim());
  }

  return sections.join("\n");
}
