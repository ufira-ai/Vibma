# Vibma Development Workflow

Non-obvious development details for working on the Vibma MCP-to-Figma bridge.

## Architecture Overview

Three processes form the communication chain:

```
Claude Code (MCP client)  ←stdio→  MCP Server (src/mcp.ts)  ←WebSocket→  Relay (packages/tunnel)  ←WebSocket→  Figma Plugin (src/figma-plugin/)
```

The relay runs on `localhost:3055` and bridges the MCP server to the Figma plugin via a named channel (default: `vibma`). Each channel allows exactly one MCP and one plugin connection.

## Build Pipeline

`npm run build` (tsup) produces two outputs:
- `dist/mcp.js` — MCP server (Node.js)
- `plugin/code.js` — Figma plugin (IIFE bundle)
- `plugin/ui.html` — copied from `src/figma-plugin/ui.html` via `tsup.config.ts` `onSuccess` hook

**Figma watches `plugin/` for file changes.** When you run `npm run build`, Figma detects the updated `plugin/code.js` and/or `plugin/ui.html` and **automatically reloads the plugin and reconnects** to the relay — no manual action needed in Figma.

**The MCP server is a stdio process — it does NOT hot-reload.** After every build, the MCP server must be restarted (run `/mcp` in Claude Code). Then call `connection(method: "create")` + `connection(method: "get")` to verify.

## Running the Relay

The relay must be running before either the MCP server or plugin can connect.

```bash
# Start relay (from project root)
cd packages/tunnel && node dist/index.js

# Or use the npm script
npm run socket
```

If port 3055 is already in use (from a previous session):
```bash
lsof -ti :3055 | xargs kill -9
```

After restarting the relay, the plugin auto-reconnects. The MCP server must be restarted:
1. Run `/mcp` in Claude Code to restart the MCP server
2. Call `connection(method: "create")` → `connection(method: "get")` to verify

## MCP Auto-Connect

The plugin has a `clientStorage`-based setting persistence system:
- Port and channel name are saved when the plugin connects (`update-settings` message)
- On next plugin launch, saved settings are restored via `restore-settings`
- `figma.on("run")` triggers `auto-connect`, which programmatically clicks the Connect button

This means: once configured, the plugin auto-connects on launch and after build-induced reloads. No manual action needed in Figma.

## Testing Changes End-to-End

1. Make code changes
2. `npm run build` (plugin auto-reloads and reconnects in Figma)
3. Run `/mcp` to restart the MCP server (stdio process runs stale code until restarted)
4. Call `connection(method: "create")` → `connection(method: "get")` to verify the full chain
5. Test the specific tools you changed

## Key File Locations

- `src/mcp.ts` — MCP server entry point (stdio transport + WebSocket to relay)
- `src/figma-plugin/code.ts` — Figma plugin entry point (command dispatch)
- `src/figma-plugin/ui.html` — Plugin UI (WebSocket client to relay)
- `src/tools/` — Tool definitions (MCP schemas + Figma handlers)
- `src/tools/helpers.ts` — Shared `batchHandler`, `nodeSnapshot`, style suggestion helpers
- `packages/tunnel/src/index.ts` — WebSocket relay server
- `plugin/` — Build output loaded by Figma (do not edit directly)
- `tsup.config.ts` — Build config; `onSuccess` copies `ui.html` and `manifest.json` to `plugin/`

## Tool Development Pattern

Each tool file in `src/tools/` exports two things:
1. `registerMcpTools(server, sendCommand)` — MCP tool registration with Zod schemas
2. `figmaHandlers` — Record of Figma-side handler functions

For batch tools, use the **prep + batchHandler** pattern:
```typescript
async function myToolBatch(params: any) {
  const ctx = await prepMyTool(params);  // batch-level setup (fonts, styles, etc.)
  return batchHandler(params, (item) => myToolSingle(item, ctx));
}
```

`batchHandler` provides: depth enrichment, warning hoisting, `{}` → `"ok"` conversion, and error wrapping.

## Resource Endpoint Pattern

CRUD resources (styles, components, variables) use a single MCP tool with `method` dispatch instead of separate tools per operation. Infrastructure lives in `src/tools/endpoint.ts`.

### Contract

```
resource(method, ...)
  list    → { type?, fields?, offset?, limit? } → { totalCount, returned, offset, limit, items: [...] }
  get     → { id, fields? }                     → resource object (full detail by default)
  create  → { type, items }                     → { results: [{id}, ...] }
  update  → { type?, items }                    → { results: ["ok"|{warning}, ...] }
  delete  → { id } or { items: [{id}, ...] }    → "ok" or { results: ["ok", ...] }
```

**list = batch get.** Both return the same resource shape. `fields` controls which properties appear:
- Omitted on list → stubs only (id, name, type)
- Omitted on get → full detail
- `fields: ["paints"]` → identity fields + requested
- `fields: ["*"]` → everything

**delete** supports both single (`id`) and batch (`items: [{id}, ...]`) via `batchHandler`.

### Shared infrastructure (`endpoint.ts`)

- **`endpointSchema(methods, extra?)`** — builds the Zod schema. Auto-adds: `id` (get/delete), `fields` (get), `offset`/`limit` (list). Merge resource-specific params via `extra`.
- **`createDispatcher(handlers)`** — Figma-side method router. Auto-applies `pickFields` on get responses when `params.fields` is present.
- **`paginate(items, offset?, limit?)`** — slices an array into a `{ totalCount, returned, offset, limit, items }` envelope. Call from list handlers after assembling the full result set.
- **`pickFields(obj, fields)`** — top-level field filter. Always preserves identity fields (`id`, `name`, `type`).

### Type discriminant

The `type` parameter serves as a schema discriminant:
- **create** — required. Selects per-type Zod validation and routes to the correct batch handler.
- **update** — optional. When provided, enables strict per-type validation (e.g. `type: "paint"` rejects text/effect fields). When omitted, falls back to permissive validation with auto-detection in Figma.
- **list** — optional. Filters results to one resource subtype.

### Adding a new endpoint

1. Define per-type Zod schemas for create and update items
2. Define a `ResourceParams` discriminated union type (method + type variants)
3. In `registerMcpTools`: call `endpointSchema()` with methods + extra fields, register via `server.tool()` with per-method item validation
4. In `figmaHandlers`: use `createDispatcher()` with handler per method
5. Update `response-types.ts` — add item type + `toolResponseSchemas` entry
6. See `src/tools/styles.ts` as the reference implementation

## Tool Description Quality

The YAML `notes:` field in each schema is embedded directly in the MCP tool description. This is the **only context** a model has when deciding how to call the tool. Not all models know the Figma Plugin API — lesser models need the description to be self-contained.

Three mechanisms ensure self-contained descriptions:

1. **Shared type auto-injection** (`gen-descriptions.ts`) — Color, Effect, Paint, LayoutGrid, NodeStub definitions are appended automatically when referenced in a description. No need to duplicate in YAML notes.
2. **Domain context in YAML notes** — each `notes:` block explains what the resource is, when to use it, enum values, and cross-tool workflow.
3. **Enhanced validation errors** (`gen-mcp.ts`) — Zod `.parse()` failures include field `.describe()` text as hints, so models know what format was expected.

When editing `schema/*/notes:` or `gen-descriptions.ts`, review against this checklist:
- Can a model that has **never seen the Figma API** understand what this tool does?
- Are all referenced types (Color, Effect, Paint, etc.) defined or explained inline?
- Are enum values listed, not just exampled?
- Is the relationship to other endpoints clear?

## Response Schemas & Docs

Tool response shapes are documented in `packages/core/src/tools/generated/response-types.ts`. This file serves dual purposes:
1. **TypeScript interfaces** — compile-time return type annotations on handlers
2. **`toolResponseSchemas` map** — runtime JSON Schema + examples for docs generation

**When you change a tool's response shape (add/remove/rename fields, change types), you must update `response-types.ts` to match.** The docs site renders directly from this file.

Key patterns in `toolResponseSchemas`:
- `batchSchema(itemProps, opts?)` — batch tools returning typed per-item results + error branch
- `okBatchSchema(opts?)` — mutation-only batch tools returning `"ok"` per item
- `mixedBatchSchema(itemProps, opts?)` — batch tools where per-item can be `"ok"` OR a typed success (e.g. `frames(method: "update")` with fill returns `"ok"` for raw color, `{ matchedStyle }` for style match)
- `okSchema(opts?)` — non-batch tools returning bare `"ok"` string
- Each entry has an `example` field with realistic sample data

**Important:** `batchHandler` hoists per-item `warning` fields to the batch-level `warnings[]` array and removes them from individual results. Do NOT include `warning` in per-item schema properties — it will never appear there in the actual response.

To regenerate after schema changes:
```bash
npx tsx schema/compiler/index.ts   # regenerate defs, docs, prompts from YAML
npm run build                       # rebuild MCP server + plugin
```
