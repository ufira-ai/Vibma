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

**Figma watches `plugin/` for file changes.** When you run `npm run build`, Figma detects the updated `plugin/code.js` and/or `plugin/ui.html` and **automatically reloads the plugin, dropping the WebSocket connection**. The user must click **Connect** again in the Figma plugin UI after every build.

This means: edit source → build → ask user to reconnect in Figma → `join_channel` + `ping` to verify.

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

After restarting the relay, **both** the plugin and MCP must reconnect:
1. User clicks **Connect** in the Figma plugin
2. MCP calls `join_channel` → `ping`

## MCP Auto-Connect

The plugin has a `clientStorage`-based setting persistence system:
- Port and channel name are saved when the plugin connects (`update-settings` message)
- On next plugin launch, saved settings are restored via `restore-settings`
- `figma.on("run")` triggers `auto-connect`, which programmatically clicks the Connect button

This means: once configured, the plugin auto-connects on launch. But after a relay restart or build-induced reload, the user needs to manually click Connect.

## Testing Changes End-to-End

1. Make code changes
2. `npm run build`
3. Ask the user to click **Connect** in the Figma plugin (the build just dropped the connection)
4. Call `join_channel` (channel: `vibma`) then `ping` to verify the full chain works
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

## Response Schemas & Docs

Tool response shapes are documented in `src/tools/response-types.ts`. This file serves dual purposes:
1. **TypeScript interfaces** — compile-time return type annotations on handlers
2. **`toolResponseSchemas` map** — runtime JSON Schema + examples consumed by `scripts/extract-tools.ts` for docs generation

**When you change a tool's response shape (add/remove/rename fields, change types), you must update `response-types.ts` to match.** The docs site renders directly from this file.

Key patterns in `toolResponseSchemas`:
- `batchSchema(itemProps, opts?)` — batch tools returning typed per-item results + error branch
- `okBatchSchema(opts?)` — mutation-only batch tools returning `"ok"` per item
- `mixedBatchSchema(itemProps, opts?)` — batch tools where per-item can be `"ok"` OR a typed success (e.g. `set_fill_color` returns `"ok"` for raw color, `{ matchedStyle }` for style match)
- `okSchema(opts?)` — non-batch tools returning bare `"ok"` string
- Each entry has an `example` field with realistic sample data

**Important:** `batchHandler` hoists per-item `warning` fields to the batch-level `warnings[]` array and removes them from individual results. Do NOT include `warning` in per-item schema properties — it will never appear there in the actual response.

To regenerate docs after schema changes:
```bash
npm run docs:generate   # extracts schemas → MDX pages + manifest
npm run docs:build      # full build including generate step
```
