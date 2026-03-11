# Schema Compiler & Tool Descriptions

## Compiler Pipeline

YAML schemas in `tools/` define tool params, methods, notes. The compiler (`compiler/`) generates multiple outputs:

1. **`defs.ts`** — Zod schemas, tool descriptions, `commandMap` (MCP-side)
2. **`help.ts`** — runtime help text for the `help` tool and per-endpoint `method: "help"` (MCP-side)
3. **`prompts.ts`** — MCP prompt definitions
4. **`docs/` MDX pages** — static docs site (Astro) with parameter tables, response schemas, type references (`gen-docs.ts`)

Key YAML features:
- `notes:` — prose context only (workflow, enum docs, cross-tool guidance). `// ---` separator: lines before go to compact description, all lines go to help. **Do not put interfaces in notes** — they are auto-generated (see below).
- `$mixin: name` — merges shared param groups from `mixins/`
- `$expand: preset` — generates sibling params (corners, padding, stroke)
- `$ref: name` — resolves single param references from `refs/`
- `example:` — flows through to help output
- `discriminant: type` on create — enables per-type Zod validation
- `tsType:` on `items` — names the generated interface (e.g., `tsType: "TextItem[]"`)
- `tsType:` on `response` — names a generated response interface (e.g., `tsType: LintResult`)

**When you change a YAML schema, you must regenerate all outputs.** The help endpoint and static docs are both derived from the same YAML — they will go stale if you only rebuild the MCP server.

Regenerate: `npx tsx schema/compiler/index.ts` then `npm run build`.

## Single Source of Truth

YAML is the source of truth for all type information. Interfaces in tool descriptions and help output are **auto-generated** from the schema — never hand-written in notes.

Three paths for interface generation (`gen-descriptions.ts`):
1. **Discriminant types** — `discriminant: type` + `types:` block → generates `ComponentItem`, `FrameItem`, etc.
2. **Named items** — `items` with `tsType` + `items.properties` → generates `InstanceCreateItem`, `PatchStyleItem`, etc.
3. **Named responses** — `response` with `tsType` + `properties` → generates `LintResult`, `Variable`, `Collection`, etc.

For complex `items` arrays (>3 props), always add `tsType` to get a named interface. Without it, the schema renders as inline `{ ... }[]` in the method DSL.

**Remaining exception**: `SHARED_TYPES` in `gen-descriptions.ts` (Color, Effect, Paint, LayoutGrid, NodeStub) are still hardcoded. Their shapes exist in `refs/common.yaml` but the auto-append mechanism hasn't been migrated yet.

## Tool Description Quality

The `notes:` field is the **only context** a model has when deciding how to call a tool. Descriptions must be self-contained.

Three mechanisms:
1. **Shared type auto-injection** — Color, Effect, Paint, LayoutGrid, NodeStub definitions are appended automatically when referenced
2. **Domain context in YAML notes** — explains what the resource is, enum values, cross-tool workflow
3. **Enhanced validation errors** — Zod failures include `.describe()` text as hints

Checklist when editing descriptions:
- Can a model that has **never seen the Figma API** understand what this tool does?
- Are all referenced types defined or explained inline?
- Are enum values listed, not just exampled?
- Is the relationship to other endpoints clear?
