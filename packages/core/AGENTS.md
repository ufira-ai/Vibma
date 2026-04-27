# MCP Server (packages/core)

## Endpoint Contract

```
create  → {items: [{...}]}                         → {results: [{id}, ...]}
get     → {id, fields?}                            → resource object (field-filtered)
list    → {filters?, fields?, offset?, limit?}      → {totalCount, returned, offset, limit, items}
update  → {items: [{id, ...}]}                     → {results: ["ok", ...]}
delete  → {id} or {items: [{id}]}                  → "ok" or {results: ["ok", ...]}
```

Custom methods (e.g. `add_mode`, `rename_mode`) extend the method enum. Keep return values minimal — `{id}` for creates, `"ok"` for mutations.

Shared infrastructure in `src/tools/endpoint.ts`:

| Function | Purpose |
|---|---|
| `endpointSchema(methods, extra?)` | Auto-adds `id`, `fields`, `offset`, `limit` based on methods |
| `createDispatcher(handlers)` | Routes by `method`, auto-applies `pickFields` on get |
| `paginate(items, offset?, limit?)` | Slices array into `{totalCount, returned, offset, limit, items}` |
| `pickFields(obj, fields)` | Top-level filter, always preserves `id`, `name`, `type` |

## Generated Validation

Endpoint input validation that can be inferred from YAML belongs in `schema/compiler/gen-mcp.ts` and the generated `src/tools/generated/defs.ts`, not in hand-written endpoint registrations.

- Batch methods with `items` must reject explicit `items: []` before sending to Figma, with a pointer to `endpoint(method:"help", topic:"<method>")`.
- Discriminated methods (`discriminant: type`) must require the discriminant at the method/root level and reject item-level discriminants with a corrective message.
- If one endpoint exposes a batch/discriminant shape bug, audit other generated endpoints such as frames, components, styles, variables, and variable_collections before patching.
- Do not edit `src/tools/generated/*` by hand. Change YAML/compiler code and regenerate.

## Access Tiers (Capabilities)

MCP server supports three tiers via CLI flags:
- **read** — always enabled (get, list, help)
- **create** — opt-in via `--create` or `--edit` (create methods)
- **edit** — opt-in via `--edit` (update, delete methods)

Schema compiler generates `filterMethodsByTier()` so endpoints only expose methods matching the session's capabilities.

## Response Types & Docs

`src/tools/generated/response-types.ts` serves dual purposes:
1. TypeScript interfaces — compile-time return types
2. `toolResponseSchemas` map — runtime JSON Schema + examples for docs

**When you change a tool's response shape, update `response-types.ts` to match.**

Key schema helpers: `batchSchema()`, `okBatchSchema()`, `mixedBatchSchema()`, `okSchema()`.

Warning: `batchHandler` hoists warnings to batch level — do NOT include `warning` in per-item schema properties.
