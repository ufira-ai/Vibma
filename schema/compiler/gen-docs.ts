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
    schema.description = (schema.description ?? "") || "number | boolean | Color | {type:VARIABLE_ALIAS, name}";
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
  params: Record<string, RawParam>
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
    if (variant.example) {
      lines.push("```ts");
      lines.push(variant.example);
      lines.push("```");
      lines.push("");
    }
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

function renderMethodBadges(method: ResolvedMethod, zh = false): string[] {
  const lines: string[] = [];
  const tierClass = `method-badge-tier-${method.tier}`;
  const accessTiersHref = zh ? "/Vibma/zh-cn/#访问层级" : "/Vibma/#access-tiers";

  lines.push('<div class="method-badges">');
  lines.push(`  <a class="method-badge method-badge-tier ${tierClass}" href="${accessTiersHref}">${method.tier}</a>`);
  if (method.inherited) {
    lines.push('  <span class="method-badge method-badge-inherited">inherited</span>');
  }
  lines.push("</div>");

  return lines;
}

function loadGuidelineEntries(repoRoot: string): { name: string; title: string }[] {
  const guidelinesDir = join(repoRoot, "schema", "guidelines");
  try {
    return readdirSync(guidelinesDir)
      .filter(file => file.endsWith(".md"))
      .sort()
      .map((file) => {
        const name = file.replace(/\.md$/, "");
        const raw = readFileSync(join(guidelinesDir, file), "utf-8").trim();
        const titleMatch = raw.match(/^#+\s+(.+)/m);
        const title = titleMatch ? titleMatch[1].trim() : titleCase(name.replace(/-/g, "_"));
        return { name, title };
      });
  } catch {
    return [];
  }
}

function generateStandaloneHelpPage(toolsDir: string, zh = false) {
  const importPath = zh ? "../../../../components/ParameterTable.astro" : "../../../components/ParameterTable.astro";
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: "Help"`);
  lines.push(`description: "${zh ? "查看任意端点或方法的帮助信息。" : "Get help on any endpoint or method."}"`);
  lines.push("---");
  lines.push("");
  lines.push(`import ParameterTable from "${importPath}";`);
  lines.push("");
  lines.push(zh
    ? "查看任意端点或方法的帮助信息。这个工具面向正在配置、调试或部署代理的用户，用来快速了解 Vibma 提供了哪些能力，以及某个端点或方法该怎么调用。"
    : "Get help on any endpoint or method. This tool is for people configuring, debugging, or deploying agents with Vibma who need a quick way to inspect the available endpoints and method-level parameters.");
  lines.push("");
  lines.push("<details>");
  lines.push(`<summary>${zh ? "工作方式" : "How it works"}</summary>`);
  lines.push("");
  lines.push("```ts");
  lines.push(zh ? "// help() 返回所有可用端点与特殊主题的目录。" : "// help() returns the directory of available endpoints and special topics.");
  lines.push(zh ? '// help(topic: "components") 返回该端点的概览。' : '// help(topic: "components") returns the endpoint overview.');
  lines.push(zh ? '// help(topic: "components.create") 返回方法级说明。' : '// help(topic: "components.create") returns method-level details.');
  lines.push(zh ? '// 大多数端点也支持 method:"help" 和 topic:"<method>" 的局部帮助。' : '// Most endpoint tools also support method:"help" with topic:"<method>" for local help.');
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(`## ${zh ? "适用场景" : "When to use it"}`);
  lines.push("");
  lines.push(zh
    ? "- 当你在为代理编写系统提示词、工作流提示词或工具使用说明时，用它确认正确的端点和方法名。"
    : "- Use it while writing system prompts, workflow prompts, or tool instructions for an agent so you can confirm the correct endpoint and method names.");
  lines.push(zh
    ? "- 当某个模型一直调用错工具或传错参数时，用它快速查清 API 结构。"
    : "- Use it when a model keeps calling the wrong tool or passing the wrong parameters and you need to inspect the API shape quickly.");
  lines.push(zh
    ? "- 当你在接入更小或不太熟悉 Vibma 的模型时，可以把 `help()` 的输出作为额外上下文提供给它。"
    : "- Use it when onboarding smaller or less Vibma-aware models; you can feed `help()` output into the prompt as extra context.");
  lines.push("");
  lines.push("1 method available.");
  lines.push("");
  lines.push("## get");
  lines.push("");
  lines.push(...renderMethodBadges({ tier: "read" } as ResolvedMethod, zh));
  lines.push("");
  lines.push(zh ? "读取帮助目录、端点概览或方法参考" : "Read the help directory, an endpoint summary, or a method reference");
  lines.push("");
  lines.push(`<ParameterTable schema={{"type":"object","properties":{"topic":{"description":"${zh ? '端点名或 endpoint.method，例如 \\"components\\" 或 \\"components.create\\"' : 'Endpoint or endpoint.method name, e.g. \\"components\\" or \\"components.create\\"'}","type":"string"}}}} />`);
  lines.push("");
  lines.push("**Response**");
  lines.push("");
  lines.push(`<ParameterTable schema={{"type":"object","properties":{"result":{"type":"string","description":"${zh ? "纯文本帮助内容" : "Plain-text help content"}"}}}} fieldLabel="Field" hideRequired />`);
  lines.push("");
  lines.push("<details>");
  lines.push(`<summary>${zh ? "示例" : "Examples"}</summary>`);
  lines.push("");
  lines.push("```json");
  lines.push("{}");
  lines.push("```");
  lines.push("");
  lines.push("```json");
  lines.push('{ "topic": "frames" }');
  lines.push("```");
  lines.push("");
  lines.push("```json");
  lines.push('{ "topic": "frames.create" }');
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(`## ${zh ? '`help()` 和 `method: "help"` 的区别' : 'When to use `help()` vs `method: "help"`'}`);
  lines.push("");
  lines.push(zh
    ? "- 当你需要查看 Vibma 的全局端点目录、了解系统能做什么，或使用完整的 `endpoint.method` 格式时，使用 `help()`。"
    : '- Use `help()` when you need the global directory of endpoints, want to discover what Vibma can do, or need the full `endpoint.method` reference format.');
  lines.push(zh
    ? '- 当你已经知道目标端点，只想查看这个端点内部某个方法的说明时，使用端点自己的 `method: "help"`，例如 `frames(method: "help", topic: "create")`。'
    : '- Use an endpoint\'s `method: "help"` when you already know the endpoint and only need help for that tool, for example `frames(method: "help", topic: "create")`.');

  writeFileSync(join(toolsDir, "help.mdx"), lines.join("\n"));
}

function generateStandaloneGuidelinesPage(
  toolsDir: string,
  guidelineEntries: { name: string; title: string }[],
  zh = false,
) {
  const importPath = zh ? "../../../../components/ParameterTable.astro" : "../../../components/ParameterTable.astro";
  const lines: string[] = [];

  lines.push("---");
  lines.push(`title: "Guidelines"`);
  lines.push(`description: "${zh
    ? "内置设计指南，覆盖布局、响应式、设计 token、组件、可访问性、命名和工作流。"
    : "Built-in design guidelines for layout, responsiveness, tokens, components, accessibility, naming, and workflow."}"`);
  lines.push("---");
  lines.push("");
  lines.push(`import ParameterTable from "${importPath}";`);
  lines.push("");
  lines.push(zh
    ? "内置设计指南，覆盖布局、响应式、设计 token、组件、可访问性、命名和工作流。这个工具面向正在部署代理的用户，用来把 Vibma 推荐的设计结构和工作方式提供给模型。"
    : "Built-in design guidelines for layout, responsiveness, tokens, components, accessibility, naming, and workflow. This tool is for people deploying agents with Vibma who want to give models Vibma's preferred design structure and workflow guidance.");
  lines.push("");
  lines.push("<details>");
  lines.push(`<summary>${zh ? "可用主题" : "Available topics"}</summary>`);
  lines.push("");
  lines.push("```ts");
  for (const entry of guidelineEntries) {
    lines.push(`${entry.name.padEnd(20)} ${entry.title}`);
  }
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(`## ${zh ? "适用场景" : "When to use it"}`);
  lines.push("");
  lines.push(zh
    ? "- 当你希望代理生成更稳定、更符合设计系统规范的 Figma 结果时，把相关 guideline 主题加入提示词。"
    : "- Use it when you want an agent to produce more consistent, design-system-friendly Figma output by adding the relevant guideline topics to the prompt.");
  lines.push(zh
    ? "- 当你在搭建新的设计系统、组件库或页面模板时，用它给模型补充 token、响应式和组件结构方面的要求。"
    : "- Use it when bootstrapping a new design system, component library, or page template and you want the model to follow Vibma's token, responsive-sizing, and component-structure expectations.");
  lines.push(zh
    ? "- 当模型 API 用对了，但产出的结构仍然不够好时，用 `guidelines()` 提供设计层面的约束。"
    : "- Use it when the model already knows the API but still produces weak structure; `guidelines()` adds design-level constraints rather than API syntax.");
  lines.push("");
  lines.push("1 method available.");
  lines.push("");
  lines.push("## get");
  lines.push("");
  lines.push(...renderMethodBadges({ tier: "read" } as ResolvedMethod, zh));
  lines.push("");
  lines.push(zh ? "读取指南目录或某个完整主题" : "Read the guideline directory or a full guideline topic");
  lines.push("");
  lines.push(`<ParameterTable schema={{"type":"object","properties":{"topic":{"description":"${zh ? '指南主题名，例如 \\"responsive-designs\\" 或 \\"token-discipline\\"' : 'Guideline topic name, e.g. \\"responsive-designs\\" or \\"token-discipline\\"'}","type":"string"}}}} />`);
  lines.push("");
  lines.push("**Response**");
  lines.push("");
  lines.push(`<ParameterTable schema={{"type":"object","properties":{"result":{"type":"string","description":"${zh ? "纯文本指南内容" : "Plain-text guideline content"}"}}}} fieldLabel="Field" hideRequired />`);
  lines.push("");
  lines.push("<details>");
  lines.push(`<summary>${zh ? "示例" : "Examples"}</summary>`);
  lines.push("");
  lines.push("```json");
  lines.push("{}");
  lines.push("```");
  lines.push("");
  lines.push("```json");
  lines.push('{ "topic": "responsive-designs" }');
  lines.push("```");
  lines.push("");
  lines.push("```json");
  lines.push('{ "topic": "token-discipline" }');
  lines.push("```");
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(`## ${zh ? "这个工具适合做什么" : "What it is for"}`);
  lines.push("");
  lines.push(zh
    ? "- `guidelines()` 帮助你把 Vibma 推荐的结构性设计实践传递给代理，尤其是设计 token、响应式尺寸和组件架构。"
    : "- `guidelines()` helps you pass Vibma's preferred structural design practices to an agent, especially around tokens, responsive sizing, and component architecture.");
  lines.push(zh
    ? "- 它和 `help()` 是互补的：`help()` 解释 Vibma 的 API 结构，`guidelines()` 解释如何用这些能力约束代理产出更好的设计。"
    : "- It complements `help()`: `help()` explains Vibma's API surface, while `guidelines()` explains how to steer an agent toward better design outcomes.");

  writeFileSync(join(toolsDir, "guidelines.mdx"), lines.join("\n"));
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
  const repoRoot = join(docsRoot, "..");
  const standaloneSlugs = ["help", "guidelines"];
  const validSlugs = new Set([...endpoints.map(ep => ep.name), ...standaloneSlugs]);
  const guidelineEntries = loadGuidelineEntries(repoRoot);

  // Clean stale MDX files
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

      lines.push(...renderMethodBadges(method));
      lines.push("");

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

  generateStandaloneHelpPage(toolsDir);
  generateStandaloneGuidelinesPage(toolsDir, guidelineEntries);
  sidebarItems.push({ label: "Help", slug: "tools/help" });
  sidebarItems.push({ label: "Guidelines", slug: "tools/guidelines" });

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

      lines.push(...renderMethodBadges(method, true));
      lines.push("");

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

  generateStandaloneHelpPage(zhToolsDir, true);
  generateStandaloneGuidelinesPage(zhToolsDir, guidelineEntries, true);

  console.log(`  Generated ${endpoints.length} endpoint pages + 2 standalone tool pages (en + zh-cn)`);

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
