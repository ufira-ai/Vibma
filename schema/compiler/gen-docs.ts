/**
 * Generate one MDX page per endpoint from resolved YAML schemas.
 *
 * Each page lists methods with parameter tables, response info, and notes.
 * Replaces the old domain-based doc generation in extract-tools.ts.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import type { ResolvedEndpoint, ResolvedMethod, RawParam, RawResponse } from "./types";

// ─── JSON Schema conversion (for ParameterTable.astro) ──────────

function paramToJsonSchema(param: RawParam): Record<string, any> {
  const schema: Record<string, any> = {};

  if (param.description) schema.description = param.description;

  const type = param.type ?? "string";

  if (param.values) {
    schema.type = "string";
    schema.enum = param.values;
  } else if (param.const) {
    schema.const = param.const;
  } else if (type === "enum") {
    schema.type = "string";
    schema.enum = param.values ?? [];
  } else if (type === "string") {
    schema.type = "string";
  } else if (type === "number") {
    schema.type = "number";
  } else if (type === "boolean") {
    schema.type = "boolean";
  } else if (type === "string[]") {
    schema.type = "array";
    schema.items = { type: "string" };
  } else if (type === "color" || (type === "object" && param.coerce === "hex_or_rgba")) {
    schema.type = "string";
    schema.description = (schema.description ?? "") || 'Hex "#FF0000" or {r,g,b,a?} 0-1';
  } else if (type === "variable_value") {
    schema.type = "any";
    schema.description = (schema.description ?? "") || "number | boolean | Color | {type:VARIABLE_ALIAS, id}";
  } else if (type === "line_height") {
    schema.type = "any";
    schema.description = (schema.description ?? "") || 'number | {value, unit: "PIXELS"|"PERCENT"|"AUTO"}';
  } else if (type === "letter_spacing") {
    schema.type = "any";
    schema.description = (schema.description ?? "") || 'number | {value, unit: "PIXELS"|"PERCENT"}';
  } else if (type === "string_or_boolean") {
    schema.type = "string | boolean";
  } else if (type === "array") {
    schema.type = "array";
    if (param.items && typeof param.items === "object") {
      if ("properties" in param.items && param.items.properties) {
        schema.items = propsToJsonSchema(param.items.properties, param.items);
      } else if ("type" in param.items) {
        schema.items = paramToJsonSchema(param.items as RawParam);
      }
    }
  } else if (type === "object") {
    schema.type = "object";
    if (param.properties) {
      const sub = propsToJsonSchema(param.properties);
      schema.properties = sub.properties;
      if (sub.required?.length) schema.required = sub.required;
    }
  } else {
    schema.type = type;
  }

  if (param.default !== undefined) {
    schema.description = `${schema.description ?? ""} (default: ${JSON.stringify(param.default)})`.trim();
  }

  return schema;
}

function propsToJsonSchema(
  params: Record<string, RawParam>,
  parent?: RawParam,
): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [name, param] of Object.entries(params)) {
    properties[name] = paramToJsonSchema(param);
    if (param.required === true) required.push(name);
  }

  const schema: Record<string, any> = { type: "object", properties };
  if (required.length) schema.required = required;
  return schema;
}

// ─── Method schema builder ──────────────────────────────────────

function buildMethodSchema(method: ResolvedMethod): Record<string, any> {
  if (!method.params || Object.keys(method.params).length === 0) {
    return { type: "object", properties: {} };
  }
  return propsToJsonSchema(method.params);
}

// ─── Response schema builder ────────────────────────────────────

function responseToJsonSchema(response: RawResponse): Record<string, any> | null {
  if (response.type === "string") {
    return { type: "object", properties: { result: { type: "string", description: response.description ?? "String result" } } };
  }
  if (response.type === "batch") {
    const itemProps: Record<string, any> = {};
    if (response.item && typeof response.item === "object") {
      for (const [k, v] of Object.entries(response.item)) {
        itemProps[k] = paramToJsonSchema(v as RawParam);
      }
    }
    return {
      type: "object",
      properties: {
        results: { type: "array", description: "One entry per input item", items: { type: "object", properties: itemProps } },
      },
    };
  }
  if (response.type === "batch_ok") {
    return {
      type: "object",
      properties: {
        results: { type: "array", description: 'Array of "ok" per item', items: { type: "string" } },
      },
    };
  }
  if (response.type === "batch_mixed") {
    return {
      type: "object",
      properties: {
        results: { type: "array", description: 'Array of "ok" or {error} per item', items: { type: "any" } },
      },
    };
  }
  if (response.type === "paginated") {
    const itemProps: Record<string, any> = {};
    if (response.item && typeof response.item === "object" && "properties" in (response.item as any)) {
      const item = response.item as RawParam;
      if (item.properties) {
        for (const [k, v] of Object.entries(item.properties)) {
          itemProps[k] = paramToJsonSchema(v);
        }
      }
    }
    return {
      type: "object",
      properties: {
        totalCount: { type: "number", description: "Total matching items" },
        returned: { type: "number", description: "Items in this page" },
        offset: { type: "number" },
        limit: { type: "number" },
        items: { type: "array", items: { type: "object", properties: itemProps } },
      },
      required: ["totalCount", "items"],
    };
  }
  if (response.type === "object" && response.properties) {
    return propsToJsonSchema(response.properties, { type: "object", properties: response.properties } as RawParam);
  }
  return null;
}

// ─── Discriminated type docs ────────────────────────────────────

function renderDiscriminatedTypes(method: ResolvedMethod): string[] {
  if (!method.discriminant || !method.types) return [];
  const lines: string[] = [];
  lines.push("");
  lines.push(`Discriminated by \`${method.discriminant}\`. Available types:`);
  lines.push("");
  for (const [typeName, variant] of Object.entries(method.types)) {
    lines.push(`#### ${typeName}`);
    lines.push("");
    if (variant.description) lines.push(variant.description);
    lines.push("");
    const schema = propsToJsonSchema(variant.params);
    lines.push(`<ParameterTable schema={${JSON.stringify(schema)}} />`);
    lines.push("");
  }
  return lines;
}

// ─── Notes formatter ────────────────────────────────────────────

function formatNotes(notes: string): string {
  // Wrap in a code block if it looks like TypeScript interfaces
  const trimmed = notes.trim();
  if (trimmed.includes("interface ") || trimmed.startsWith("//")) {
    return "```ts\n" + trimmed + "\n```";
  }
  return trimmed;
}

// ─── Title helpers ──────────────────────────────────────────────

function titleCase(s: string): string {
  return s.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// ─── Main generator ─────────────────────────────────────────────

export interface DocsOutput {
  /** Sidebar items for astro.config.mjs */
  sidebarItems: { label: string; slug: string }[];
}

export function generateDocs(
  endpoints: ResolvedEndpoint[],
  docsRoot: string,
): DocsOutput {
  const toolsDir = join(docsRoot, "src", "content", "docs", "tools");
  mkdirSync(toolsDir, { recursive: true });

  // Clean stale MDX files
  const validSlugs = new Set(endpoints.map(ep => ep.name));
  for (const file of readdirSync(toolsDir)) {
    if (file.endsWith(".mdx") && !validSlugs.has(file.replace(".mdx", ""))) {
      unlinkSync(join(toolsDir, file));
      console.log(`  Removed stale ${file}`);
    }
  }

  const sidebarItems: { label: string; slug: string }[] = [];

  for (const ep of endpoints) {
    const lines: string[] = [];

    // Frontmatter
    lines.push("---");
    lines.push(`title: "${titleCase(ep.name)}"`);
    lines.push(`description: "${ep.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    lines.push("---");
    lines.push("");
    lines.push(`import ParameterTable from "../../../components/ParameterTable.astro";`);
    lines.push("");

    // Endpoint description
    lines.push(ep.description);
    lines.push("");

    // Notes (type shapes, usage hints)
    if (ep.notes) {
      lines.push("<details>");
      lines.push("<summary>Type reference</summary>");
      lines.push("");
      lines.push(formatNotes(ep.notes));
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    // Method count
    lines.push(`${ep.methods.length} method${ep.methods.length !== 1 ? "s" : ""} available.`);
    lines.push("");

    // Methods
    for (const method of ep.methods) {
      lines.push(`## ${method.name}`);
      lines.push("");

      // Tier + inherited badges
      const badges: string[] = [];
      if (method.tier !== "read") badges.push(`**${method.tier}**`);
      if (method.inherited) badges.push("*inherited*");
      if (badges.length) {
        lines.push(badges.join(" | "));
        lines.push("");
      }

      lines.push(method.description);
      lines.push("");

      // Parameters
      const schema = buildMethodSchema(method);
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        lines.push(`<ParameterTable schema={${JSON.stringify(schema)}} />`);
        lines.push("");
      } else {
        lines.push("No parameters.");
        lines.push("");
      }

      // Discriminated type details
      const typeLines = renderDiscriminatedTypes(method);
      if (typeLines.length) {
        lines.push(...typeLines);
      }

      // Response
      const responseSchema = responseToJsonSchema(method.response);
      if (responseSchema) {
        lines.push("**Response**");
        lines.push("");
        if (method.response.description) {
          lines.push(method.response.description);
          lines.push("");
        }
        lines.push(`<ParameterTable schema={${JSON.stringify(responseSchema)}} fieldLabel="Field" hideRequired />`);
        lines.push("");
      }

      // Example
      if (method.response.example) {
        lines.push("<details>");
        lines.push("<summary>Example response</summary>");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(method.response.example, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
    }

    const mdxPath = join(toolsDir, `${ep.name}.mdx`);
    writeFileSync(mdxPath, lines.join("\n"));
    sidebarItems.push({ label: titleCase(ep.name), slug: `tools/${ep.name}` });
  }

  // ─── zh-cn pages ────────────────────────────────────────────────
  const zhToolsDir = join(docsRoot, "src", "content", "docs", "zh-cn", "tools");
  mkdirSync(zhToolsDir, { recursive: true });

  // Clean stale zh-cn MDX files
  for (const file of readdirSync(zhToolsDir)) {
    if (file.endsWith(".mdx") && !validSlugs.has(file.replace(".mdx", ""))) {
      unlinkSync(join(zhToolsDir, file));
      console.log(`  Removed stale zh-cn/${file}`);
    }
  }

  for (const ep of endpoints) {
    const lines: string[] = [];

    lines.push("---");
    lines.push(`title: "${titleCase(ep.name)}"`);
    lines.push(`description: "${(ep.descriptionZh ?? ep.description).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
    lines.push("---");
    lines.push("");
    lines.push(`import ParameterTable from "../../../../components/ParameterTable.astro";`);
    lines.push("");

    lines.push(ep.descriptionZh ?? ep.description);
    lines.push("");

    if (ep.notes) {
      lines.push("<details>");
      lines.push("<summary>Type reference</summary>");
      lines.push("");
      lines.push(formatNotes(ep.notes));
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    lines.push(`${ep.methods.length} method${ep.methods.length !== 1 ? "s" : ""} available.`);
    lines.push("");

    for (const method of ep.methods) {
      lines.push(`## ${method.name}`);
      lines.push("");

      const badges: string[] = [];
      if (method.tier !== "read") badges.push(`**${method.tier}**`);
      if (method.inherited) badges.push("*inherited*");
      if (badges.length) {
        lines.push(badges.join(" | "));
        lines.push("");
      }

      lines.push(method.description);
      lines.push("");

      const schema = buildMethodSchema(method);
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        lines.push(`<ParameterTable schema={${JSON.stringify(schema)}} />`);
        lines.push("");
      } else {
        lines.push("No parameters.");
        lines.push("");
      }

      const typeLines = renderDiscriminatedTypes(method);
      if (typeLines.length) lines.push(...typeLines);

      const responseSchema = responseToJsonSchema(method.response);
      if (responseSchema) {
        lines.push("**Response**");
        lines.push("");
        if (method.response.description) {
          lines.push(method.response.description);
          lines.push("");
        }
        lines.push(`<ParameterTable schema={${JSON.stringify(responseSchema)}} fieldLabel="Field" hideRequired />`);
        lines.push("");
      }

      if (method.response.example) {
        lines.push("<details>");
        lines.push("<summary>Example response</summary>");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(method.response.example, null, 2));
        lines.push("```");
        lines.push("");
        lines.push("</details>");
        lines.push("");
      }
    }

    writeFileSync(join(zhToolsDir, `${ep.name}.mdx`), lines.join("\n"));
  }

  console.log(`  Generated ${endpoints.length} endpoint pages (en + zh-cn)`);

  // ─── Getting started from CARRYME.md ────────────────────────────
  generateGettingStarted(docsRoot);

  return { sidebarItems };
}

// ─── CARRYME.md → getting-started.mdx ───────────────────────────

function stripCarryMeFrontmatter(content: string): string {
  const agentIdx = content.indexOf("\n---\n\n## Instructions for AI Agents");
  const userContent = agentIdx !== -1 ? content.slice(0, agentIdx) : content;
  const lines = userContent.split("\n");
  let i = 0;
  // Skip language-switcher blockquote
  while (i < lines.length && lines[i]?.startsWith(">")) i++;
  if (lines[i]?.trim() === "") i++;
  // Skip H1
  if (lines[i]?.startsWith("# ")) i++;
  if (lines[i]?.trim() === "") i++;
  return lines.slice(i).join("\n").trim();
}

function generateGettingStarted(docsRoot: string) {
  const root = join(docsRoot, "..");

  // English
  try {
    const body = stripCarryMeFrontmatter(readFileSync(join(root, "CARRYME.md"), "utf-8"));
    const mdx = [
      "---",
      "title: Getting Started",
      "description: Set up Vibma and connect your AI agent to Figma",
      "slug: index",
      "---",
      "",
      "{/* Auto-generated from CARRYME.md by schema compiler — do not edit manually */}",
      "",
      body,
      "",
    ].join("\n");
    writeFileSync(join(docsRoot, "src", "content", "docs", "getting-started.mdx"), mdx);
    console.log("  Generated getting-started.mdx");
  } catch {
    console.log("  CARRYME.md not found — skipping getting-started");
  }

  // Chinese
  try {
    const body = stripCarryMeFrontmatter(readFileSync(join(root, "CARRYME.zh-CN.md"), "utf-8"));
    const zhDir = join(docsRoot, "src", "content", "docs", "zh-cn");
    mkdirSync(zhDir, { recursive: true });
    const mdx = [
      "---",
      "title: 快速开始",
      "description: 设置 Vibma 并将 AI 代理连接到 Figma",
      "slug: zh-cn",
      "---",
      "",
      "{/* Auto-generated from CARRYME.zh-CN.md by schema compiler — do not edit manually */}",
      "",
      body,
      "",
    ].join("\n");
    writeFileSync(join(zhDir, "getting-started.mdx"), mdx);
    console.log("  Generated zh-cn/getting-started.mdx");
  } catch {
    console.log("  CARRYME.zh-CN.md not found — skipping zh-cn getting-started");
  }
}
