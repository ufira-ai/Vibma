# MCP Tool Design Guidelines

Patterns and principles distilled from building the Vibma MCP server (36 tools across 10 domains).

## When to Use an Endpoint vs Standalone Tool

**Endpoint** (single tool with `method` dispatch): Use for **homogeneous resources** — entities that share a consistent shape and support CRUD. Examples: `styles`, `variables`, `variable_collections`, `components`, `instances`.

**Standalone tool**: Use when:
- The operation is **heterogeneous** — different types need wildly different schemas (e.g. `frames(method: "create", type: "frame")` vs `text(method: "create")`)
- The tool operates on a **different resource** than the endpoint
- The operation is a **simple action** that doesn't fit CRUD (e.g. `connection(method: "get")`)

**Don't create a tool that's a subset of another.** If `frames(method: "update")` already applies styles via `fill.styleName`, don't add a separate tool. If the fix for a lint rule can be done with existing primitives (`frames(method: "delete")` + `frames(method: "create")` + reparent), don't add a dedicated auto-fix tool.

## Endpoint Contract

```
create  → {items: [{...}]}                         → {results: [{id}, ...]}
get     → {id, fields?}                            → resource object (field-filtered)
list    → {filters?, fields?, offset?, limit?}      → {totalCount, returned, offset, limit, items}
update  → {items: [{id, ...}]}                     → {results: ["ok", ...]}
delete  → {id} or {items: [{id}]}                  → "ok" or {results: ["ok", ...]}
```

Custom methods (e.g. `add_mode`, `rename_mode`) extend the method enum. Keep return values minimal — `{modeId}` for creates, `"ok"` for mutations. Don't return the full parent state per batch item (it's stale by the next item anyway).

### Key Infrastructure

| Function | Side | Purpose |
|---|---|---|
| `endpointSchema(methods, extra?)` | MCP | Auto-adds `id`, `fields`, `offset`, `limit` based on methods |
| `createDispatcher(handlers)` | Figma | Routes by `method`, auto-applies `pickFields` on get |
| `paginate(items, offset?, limit?)` | Figma | Slices array into `{totalCount, returned, offset, limit, items}` |
| `pickFields(obj, fields)` | Figma | Top-level filter, always preserves `id`, `name`, `type` |
| `batchHandler(params, fn)` | Figma | Per-item try/catch, depth enrichment, warning hoisting, `{}` → `"ok"` |

### Type Discriminant on Create

When a resource has multiple creation modes, use a `type` field:
```
components(method: "create", type: "component", items: [...])
components(method: "create", type: "from_node", items: [...])
components(method: "create", type: "variant_set", items: [...])
```

Each type gets its own Zod schema for validation.

## Response Design

- **Batch creates** return `{id}` per item — the only novel info
- **Batch mutations** (update/delete/rename/remove) return `"ok"` — batchHandler converts `{}` to `"ok"`
- **Don't return parent state per batch item** — it's redundant and stale by the next item. Caller can `get` the parent after if needed.
- **Warnings** are hoisted to batch level and deduplicated by `batchHandler`
- **Errors** are caught per-item: `{error: "message"}` — one failure doesn't abort the batch
- **`depth` param** on create tools: if provided, merges a node snapshot into the `{id}` result

## Tool Description Format

For endpoints, use a compact method reference in the description:
```
"CRUD endpoint for local styles (paint, text, effect).
  list   → {type?, fields?, offset?, limit?} → {totalCount, items: [...]}
  get    → {id, fields?} → style object
  create → {type, items: [...]} → {results: [{id}, ...]}
  update → {type?, items: [{id, ...}]} → {results: ['ok', ...]}
  delete → {id} or {items: [{id}]} → 'ok' or {results: ['ok', ...]}"
```

This gives the agent a quick reference for input/output shapes per method.

## Agent Guidance Patterns

- **Error messages should list available options** — when a style/variable name isn't found, return the available names so the agent can self-correct
- **Warn on misuse, don't block** — if an agent hardcodes a color that matches a style, emit a warning suggesting the style name. Don't fail the operation.
- **Fix instructions in lint results** should reference current tool names — update these when consolidating tools
- **Prompts** (`design_strategy`, `read_design_strategy`, etc.) should reference current tool names — audit after any tool rename/removal

## Checklist: Adding/Removing a Tool

1. **YAML schema** (`schema/tools/*.yaml`): add/remove tool definition with params, methods, notes
2. **Figma handler** (`packages/adapter-figma/src/handlers/`): add/remove handler + register in `registry.ts`
3. **Response types** (`packages/core/src/tools/generated/response-types.ts`): add/remove interface + `toolResponseSchemas` entry
4. **SKIP_FOCUS** (`packages/adapter-figma/src/plugin/code.ts`): add read-only tools (non-node resources), don't add tools that create/modify focusable nodes
5. **String references**: search for old tool names in `helpers.ts`, `lint.ts`, prompts, and docs
6. **Regenerate**: `npx tsx schema/compiler/index.ts` — regenerates defs, docs, prompts from YAML
7. **Build**: `npm run build` — rebuild MCP server + plugin

## File Structure

```
schema/
  tools/*.yaml         — tool definitions (params, methods, notes)
  base/node.yaml       — shared node schema (inherited by frames, text, etc.)
  prompts.yaml         — MCP prompt definitions
  compiler/            — YAML → TypeScript codegen (defs.ts, response-types, docs, prompts)
packages/core/src/
  mcp.ts               — MCP server entry point (stdio transport + WebSocket relay)
  tools/
    mcp-registry.ts    — registers all generated tools + prompts
    generated/defs.ts  — auto-generated Zod schemas + descriptions
    generated/response-types.ts — TypeScript interfaces + JSON Schema map for docs
    prompts.ts         — MCP prompt registration
    types.ts           — McpServer/SendCommandFn types, mcpJson/mcpError helpers
    registry.ts        — tool registration wrapper with validation
packages/adapter-figma/src/
  handlers/            — Figma-side handler functions per tool
  plugin/code.ts       — Figma plugin entry point (command dispatch)
```
