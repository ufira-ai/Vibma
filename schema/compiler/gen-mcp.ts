/**
 * Generate MCP ToolDef TypeScript code from resolved endpoints.
 *
 * For each endpoint, generates:
 * - A Zod schema with method enum + all params (union of all methods)
 * - A ToolDef export
 */
import type { ResolvedEndpoint, ResolvedMethod, RawParam } from "./types";
import { generateCompactDescription } from "./gen-descriptions";

/** Convert a YAML param type to Zod code */
function paramToZod(name: string, param: RawParam, indent = 2): string {
  const pad = " ".repeat(indent);
  let zod: string;

  const type = param.type ?? "string";

  if (param.values) {
    // enum
    const vals = param.values.map(v => `"${v}"`).join(", ");
    zod = `z.enum([${vals}])`;
  } else if (type === "string") {
    zod = "z.string()";
  } else if (type === "number") {
    zod = param.coerce ? "z.coerce.number()" : "z.number()";
    if (param.min !== undefined) zod += `.min(${param.min})`;
    if (param.max !== undefined) zod += `.max(${param.max})`;
  } else if (type === "boolean") {
    zod = param.coerce ? "flexBool(z.boolean())" : "z.boolean()";
  } else if (type === "string[]") {
    const inner = "z.array(z.string())";
    zod = param.coerce === "json" ? `flexJson(${inner})` : inner;
  } else if (type === "array") {
    const inner = "z.array(z.record(z.string(), z.unknown()))";
    zod = param.coerce === "json" ? `flexJson(${inner})` : inner;
  } else if (type === "color") {
    zod = "S.colorRgba";
  } else if (type === "variable_value") {
    zod = "S.variableValue";
  } else if (type === "line_height") {
    zod = "S.lineHeight";
  } else if (type === "letter_spacing") {
    zod = "S.letterSpacing";
  } else if (type === "string_or_boolean") {
    zod = "S.stringOrBoolean";
  } else if (type === "object") {
    if (param.coerce === "hex_or_rgba") {
      zod = "S.colorRgba";
    } else if (param.properties) {
      const props: string[] = [];
      for (const [k, v] of Object.entries(param.properties)) {
        props.push(`${pad}  ${k}: ${paramToZod(k, v, indent + 2).trim()},`);
      }
      zod = `z.object({\n${props.join("\n")}\n${pad}})`;
    } else {
      zod = "z.record(z.string(), z.unknown())";
    }
  } else if (type === "enum") {
    const vals = (param.values ?? []).map(v => `"${v}"`).join(", ");
    zod = `z.enum([${vals}])`;
  } else {
    zod = "z.unknown()";
  }

  if (param.optional || (!param.required && param.required !== undefined)) {
    zod += ".optional()";
  } else if (param.required === undefined && !param.values) {
    // Default: optional unless explicitly required
    zod += ".optional()";
  }

  if (param.default !== undefined) {
    zod += `.default(${JSON.stringify(param.default)})`;
  }

  if (param.description) {
    zod += `.describe(${JSON.stringify(param.description)})`;
  }

  return `${pad}${zod}`;
}

/** Generate the Zod schema fields for an endpoint */
function generateSchema(endpoint: ResolvedEndpoint): string {
  const lines: string[] = [];
  const methodNames = [...endpoint.methods.map(m => `"${m.name}"`), `"help"`].join(", ");

  lines.push(`    method: z.enum([${methodNames}]),`);

  // Collect all params across all methods (union)
  const allParams = new Map<string, { param: RawParam; methods: string[] }>();

  for (const method of endpoint.methods) {
    for (const [name, param] of Object.entries(method.params ?? {})) {
      const existing = allParams.get(name);
      if (existing) {
        existing.methods.push(method.name);
      } else {
        allParams.set(name, { param, methods: [method.name] });
      }
    }

    // For discriminated creates, add the discriminant and items
    if (method.discriminant && method.types) {
      if (!allParams.has(method.discriminant)) {
        const typeNames = Object.keys(method.types);
        allParams.set(method.discriminant, {
          param: {
            type: "enum",
            values: typeNames,
            optional: true,
            description: `Discriminant for ${method.name} method`,
          },
          methods: [method.name],
        });
      }
      if (!allParams.has("items")) {
        allParams.set("items", {
          param: {
            type: "array",
            coerce: "json",
            optional: true,
            description: "Batch items array",
          },
          methods: [method.name],
        });
      }
    }
  }

  // Emit all params (all optional since they vary by method)
  for (const [name, { param }] of allParams) {
    // Make all params optional in the union schema
    const optionalParam = { ...param, optional: true, required: undefined };
    const zodLine = paramToZod(name, optionalParam).trim();
    lines.push(`    ${name}: ${zodLine},`);
  }

  // Inject topic param for the help method
  if (!allParams.has("topic")) {
    lines.push(`    topic: z.string().optional().describe("Help topic — method name for endpoint help, e.g. \\"create\\""),`);
  }

  return lines.join("\n");
}

/** Determine the minimum tier needed for this endpoint */
function endpointTier(endpoint: ResolvedEndpoint): string {
  // If any method is read-only, the endpoint itself is read (tier gate is per-method via caps)
  return "read";
}

// ─── Validate generation ──────────────────────────────────────────

/** Check if a method has items that can be validated from YAML schemas */
function methodNeedsValidation(method: ResolvedMethod): boolean {
  // Skip inherited methods — they may have param translations in handler aliases
  if (method.inherited) return false;

  // Discriminated methods have per-type item schemas
  if (method.discriminant && method.types) return true;

  // Methods with items param that has inline properties
  const items = method.params?.items;
  if (items?.type === "array" && items.items &&
      typeof items.items === "object" && "properties" in items.items &&
      items.items.properties && Object.keys(items.items.properties).length > 0) {
    return true;
  }

  return false;
}

/** Generate z.object({...}) code from a properties map */
function generateItemZodObject(properties: Record<string, RawParam>, indent: number): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const [name, param] of Object.entries(properties)) {
    const zodCode = paramToZod(name, param, indent + 2).trim();
    lines.push(`${pad}  ${name}: ${zodCode},`);
  }
  return `z.object({\n${lines.join("\n")}\n${pad}})`;
}

/** Collect top-level required params for a method (excluding items/method). */
function getRequiredParams(method: ResolvedMethod): string[] {
  if (method.inherited || !method.params) return [];
  const required: string[] = [];
  for (const [name, param] of Object.entries(method.params)) {
    if (name === "items" || name === "method") continue;
    if (param.required === true) required.push(name);
  }
  return required;
}

/** Generate a validate function for an endpoint. Returns null if no validation needed. */
function generateValidate(endpoint: ResolvedEndpoint): string | null {
  const itemBranches: string[] = [];
  const requiredBranches: string[] = [];

  for (const method of endpoint.methods) {
    // Required param checks (e.g. get needs id)
    const required = getRequiredParams(method);
    if (required.length > 0) {
      const checks = required.map(p =>
        `        if (params.${p} === undefined) throw new Error(${JSON.stringify(`${method.name} requires "${p}"`)});`
      );
      requiredBranches.push(
        `      if (m === ${JSON.stringify(method.name)}) {\n${checks.join("\n")}\n      }`
      );
    }

    // Item validation
    if (!methodNeedsValidation(method)) continue;

    if (method.discriminant && method.types) {
      // Discriminated: per-type item schemas
      const schemaLines: string[] = [];
      for (const [typeName, variant] of Object.entries(method.types)) {
        const zodObj = generateItemZodObject(variant.params, 10);
        schemaLines.push(`          ${JSON.stringify(typeName)}: ${zodObj},`);
      }
      itemBranches.push(
        `      if (m === ${JSON.stringify(method.name)}) {\n` +
        `        const schemas: Record<string, z.ZodTypeAny> = {\n${schemaLines.join("\n")}\n        };\n` +
        `        const s = params.${method.discriminant} && schemas[params.${method.discriminant}];\n` +
        `        if (s) {\n` +
        `          try { params.items = z.array(s).parse(params.items); }\n` +
        `          catch (e) { if (e instanceof z.ZodError) { throw new Error(e.issues.map(i => { const path = i.path.join("."); const shape = s instanceof z.ZodObject ? (s as any).shape : null; const desc = shape?.[i.path[1]]?.description; return path + ": " + i.message + (desc ? " (expected: " + desc + ")" : ""); }).join("; ")); } throw e; }\n` +
        `        }\n` +
        `      }`
      );
    } else {
      // Simple: single item schema from items.items.properties
      const items = method.params?.items;
      if (items?.items && typeof items.items === "object" && "properties" in items.items && items.items.properties) {
        const zodObj = generateItemZodObject(items.items.properties, 8);
        itemBranches.push(
          `      if (m === ${JSON.stringify(method.name)}) {\n` +
          `        const itemSchema = ${zodObj};\n` +
          `        try { params.items = z.array(itemSchema).parse(params.items); }\n` +
          `        catch (e) { if (e instanceof z.ZodError) { throw new Error(e.issues.map(i => { const path = i.path.join("."); const shape = itemSchema instanceof z.ZodObject ? (itemSchema as any).shape : null; const desc = shape?.[i.path[1]]?.description; return path + ": " + i.message + (desc ? " (expected: " + desc + ")" : ""); }).join("; ")); } throw e; }\n` +
          `      }`
        );
      }
    }
  }

  if (itemBranches.length === 0 && requiredBranches.length === 0) return null;

  const lines: string[] = [`(params: any) => {`, `      const m = params.method;`];
  if (requiredBranches.length > 0) {
    lines.push(...requiredBranches);
  }
  if (itemBranches.length > 0) {
    lines.push(`      if (!params.items) return;`);
    lines.push(...itemBranches);
  }
  lines.push(`    }`);
  return lines.join("\n");
}

/** Generate a single ToolDef */
function generateToolDef(endpoint: ResolvedEndpoint): string {
  const desc = generateCompactDescription(endpoint);
  const schema = generateSchema(endpoint);
  const tier = endpointTier(endpoint);

  // Check for custom timeouts
  const timeouts = endpoint.methods.filter(m => m.timeout);
  const timeoutLine = timeouts.length > 0
    ? `\n    timeout: ${Math.max(...timeouts.map(m => m.timeout!))},`
    : "";

  const dispatchMap = buildDispatchMap(endpoint);
  const validate = generateValidate(endpoint);
  const validateLine = validate ? `\n    validate: ${validate},` : "";

  return `  {
    name: "${endpoint.name}",
    description: ${JSON.stringify(desc)},
    schema: (caps) => filterMethodsByTier({${schema}
    }, caps, ${JSON.stringify({ ...Object.fromEntries(endpoint.methods.map(m => [m.name, m.tier])), help: "read" })}),
    tier: "${tier}" as const,${timeoutLine}${validateLine}
    commandMap: ${JSON.stringify(dispatchMap)},
  }`;
}

/** Build command dispatch map for an endpoint.
 *  Convention: command = "{endpoint}.{method}" always. */
function buildDispatchMap(endpoint: ResolvedEndpoint): Record<string, string> {
  const map: Record<string, string> = {};
  for (const method of endpoint.methods) {
    map[method.name] = `${endpoint.name}.${method.name}`;
  }
  return map;
}

/** Generate full TypeScript file for all endpoints */
export function generateMcpDefs(endpoints: ResolvedEndpoint[]): string {
  const lines: string[] = [
    `// AUTO-GENERATED by schema compiler — do not edit`,
    `import { z } from "zod";`,
    `import { flexJson, flexBool } from "../../utils/coercion";`,
    `import * as S from "../schemas";`,
    `import type { ToolDef, Capabilities } from "../types";`,
    ``,
    `/** Filter method enum values by capability tier */`,
    `function filterMethodsByTier(`,
    `  schema: Record<string, z.ZodTypeAny>,`,
    `  caps: Capabilities,`,
    `  methodTiers: Record<string, string>,`,
    `): Record<string, z.ZodTypeAny> {`,
    `  const methods = Object.keys(methodTiers).filter(m => {`,
    `    const tier = methodTiers[m];`,
    `    if (tier === "read") return true;`,
    `    if (tier === "create") return caps.create;`,
    `    if (tier === "edit") return caps.edit;`,
    `    return false;`,
    `  });`,
    `  return { ...schema, method: z.enum(methods as [string, ...string[]]) };`,
    `}`,
    ``,
    `/**`,
    ` * Command dispatch map: endpoint → method → Figma command name.`,
    ` * For discriminated methods (create with type), the value is a sub-map: type → command.`,
    ` */`,
    `export const commandMap: Record<string, Record<string, string>> = {`,
  ];

  for (const ep of endpoints) {
    lines.push(`  "${ep.name}": ${JSON.stringify(buildDispatchMap(ep))},`);
  }

  lines.push(`};`);
  lines.push(``);

  // Inline method flags
  const inlineEntries: string[] = [];
  for (const ep of endpoints) {
    const inlines: Record<string, boolean> = {};
    for (const m of ep.methods) {
      if (m.inline) inlines[m.name] = true;
    }
    if (Object.keys(inlines).length > 0) {
      inlineEntries.push(`  "${ep.name}": ${JSON.stringify(inlines)},`);
    }
  }
  lines.push(`/** Methods handled inline (local WS state, not sent to Figma) */`);
  lines.push(`export const inlineMethods: Record<string, Record<string, boolean>> = {`);
  lines.push(...inlineEntries);
  lines.push(`};`);
  lines.push(``);

  lines.push(`export const tools: ToolDef[] = [`);

  for (let i = 0; i < endpoints.length; i++) {
    lines.push(generateToolDef(endpoints[i]) + (i < endpoints.length - 1 ? "," : ""));
  }

  lines.push(`];`);
  return lines.join("\n") + "\n";
}
