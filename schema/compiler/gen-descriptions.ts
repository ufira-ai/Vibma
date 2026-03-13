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
        return `${t === "string" ? "string" : t === "number" ? "number" : "unknown"}[]`;
      }
    }
    return "unknown[]";
  }

  if (type === "color") return "Color";
  if (type === "variable_value") return 'number | boolean | string | Color | {type: "VARIABLE_ALIAS", name: string}';
  if (type === "line_height") return 'number | {value: number, unit: "PIXELS" | "PERCENT" | "AUTO"}';
  if (type === "letter_spacing") return 'number | {value: number, unit: "PIXELS" | "PERCENT"}';
  if (type === "string_or_boolean") return "string | boolean";
  if (type === "token") return "string";

  if (type === "object") {
    if (param.properties) return propsToObj(param.properties);
    return "Record<string, unknown>";
  }
  return "unknown";
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
    return `${name}${opt}: ${param.values.join("|")}`;
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
  if (response.type === "batch") {
    // Use explicit item keys if provided, otherwise fall back to {id}
    if (response.item && typeof response.item === "object" && !("type" in response.item)) {
      const keys = Object.keys(response.item as Record<string, RawParam>).join(", ");
      return `{ results: {${keys}}[] }`;
    }
    return "{ results: {id}[] }";
  }
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
  return "unknown";
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

// ─── Interface stripping ──────────────────────────────────────────

/** Remove hand-written interface blocks from notes when they've been auto-generated. */
function stripInterfaces(text: string, names: Set<string>): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const match = line.match(/^\s*interface\s+(\w+)/);
    if (match && names.has(match[1])) {
      skipping = true;
      continue;
    }
    if (skipping) {
      // End of interface block: closing brace at same or lesser indent
      if (line.match(/^\s*}/)) {
        skipping = false;
        continue;
      }
      continue;
    }
    result.push(line);
  }
  // Clean up trailing blank lines
  while (result.length > 0 && result[result.length - 1].trim() === "") result.pop();
  return result.join("\n");
}

// ─── Shared type definitions ──────────────────────────────────────

const SHARED_TYPES: Record<string, string> = {
  Color: 'Color: hex "#FF0000" or {r: 0-1, g: 0-1, b: 0-1, a?: 0-1}',
  Effect: 'Effect: {type: "DROP_SHADOW"|"INNER_SHADOW"|"LAYER_BLUR"|"BACKGROUND_BLUR", radius: number, color?: {r,g,b,a} (0-1), offset?: {x, y}, spread?: number, visible?: boolean}',
  Paint: 'Paint: {type: "SOLID", color: Color, opacity?: number}',
  LayoutGrid: 'LayoutGrid: {pattern: "COLUMNS"|"ROWS"|"GRID", alignment: "MIN"|"MAX"|"CENTER"|"STRETCH", sectionSize: number, count?: number, offset?: number, gutterSize?: number}',
  NodeStub: 'NodeStub: {id: string, name: string, type: string}',
};

/** Scan text for shared type references and append definitions */
function appendSharedTypes(text: string): string {
  const needed: string[] = [];
  for (const [typeName, definition] of Object.entries(SHARED_TYPES)) {
    // Match type name as a word boundary (not inside a longer word)
    const re = new RegExp(`\\b${typeName}\\b`);
    if (re.test(text)) {
      needed.push(definition);
    }
  }
  if (needed.length === 0) return text;

  // Ensure Color is appended if Effect references it
  if (needed.some(d => d.startsWith("Effect:")) && !needed.some(d => d.startsWith("Color:"))) {
    needed.unshift(SHARED_TYPES.Color);
  }

  return text + "\n// Shared types:\n// " + needed.join("\n// ");
}

// ─── Notes filtering ──────────────────────────────────────────────

/** Extract brief // comment lines from notes for the compact description.
 *  Stops at `// ---` separator if present — lines after it are help-only detail. */
function extractNoteComments(notes: string): string {
  const lines: string[] = [];
  for (const l of notes.split("\n")) {
    if (l.trimStart() === "// ---") break;
    if (l.trimStart().startsWith("//")) lines.push(l);
  }
  return lines.join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────

/**
 * Generate the full description with all detail (interfaces, notes, shared types).
 * Used by help system for detailed method-level docs.
 */
export function generateDescription(endpoint: ResolvedEndpoint): string {
  const sections: string[] = [];

  // 1. Summary + method DSL
  sections.push(`/** ${endpoint.description.trim()} */`);
  const methodLines: string[] = [];
  for (const method of endpoint.methods) {
    methodLines.push(methodLine(method));
  }
  sections.push(methodLines.join("\n"));

  // 2. Generate interfaces and collect names for dedup
  const generatedIfaceNames = new Set<string>();

  // 2a. Interfaces for discriminated create types
  for (const method of endpoint.methods) {
    if (method.discriminant && method.types) {
      const ifaces: string[] = [];
      for (const [typeName, variant] of Object.entries(method.types)) {
        const name = pascalCase(typeName) + "Item";
        generatedIfaceNames.add(name);
        ifaces.push(generateInterface(name, variant.params));
      }
      sections.push(ifaces.join("\n"));
    }
  }

  // 2b. Interfaces for items with tsType + inline properties
  for (const method of endpoint.methods) {
    if (method.params == null) continue;
    const items = method.params.items;
    if (items?.tsType && items.items && typeof items.items === "object" && "properties" in items.items && items.items.properties) {
      const ifaceName = items.tsType.replace("[]", "");
      if (generatedIfaceNames.has(ifaceName)) continue;
      generatedIfaceNames.add(ifaceName);
      sections.push(generateInterface(ifaceName, items.items.properties as Record<string, RawParam>));
    }
  }

  // 2c. Interfaces for named response types
  for (const method of endpoint.methods) {
    const resp = method.response;
    if (resp.tsType && resp.properties) {
      if (generatedIfaceNames.has(resp.tsType)) continue;
      generatedIfaceNames.add(resp.tsType);
      sections.push(generateInterface(resp.tsType, resp.properties));
    }
  }

  // 3. Notes from YAML (shared types, usage) — strip hand-written interfaces that are now generated
  if (endpoint.notes) {
    let notes = endpoint.notes.trim();
    if (generatedIfaceNames.size > 0) {
      notes = stripInterfaces(notes, generatedIfaceNames);
    }
    if (notes) sections.push(notes);
  }

  // 4. Auto-append shared type definitions referenced in the description
  return appendSharedTypes(sections.join("\n"));
}

/**
 * Generate a compact description for the MCP tool listing.
 * Keeps summary + method DSL + essential notes (// comments only).
 * Full interfaces and detailed notes are available via help(method: "help").
 */
export function generateCompactDescription(endpoint: ResolvedEndpoint): string {
  const sections: string[] = [];

  // 1. Summary + method DSL
  sections.push(`/** ${endpoint.description.trim()} Use method "help" for detailed parameter docs. */`);
  const methodLines: string[] = [];
  for (const method of endpoint.methods) {
    methodLines.push(methodLine(method));
  }
  sections.push(methodLines.join("\n"));

  // 2. Essential notes only (// comments, no interfaces)
  if (endpoint.notes) {
    const comments = extractNoteComments(endpoint.notes);
    if (comments) sections.push(comments);
  }

  // 3. Auto-append shared type definitions referenced in the description
  return appendSharedTypes(sections.join("\n"));
}
