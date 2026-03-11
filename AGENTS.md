# Vibma Development Workflow

Non-obvious development details for working on the Vibma MCP-to-Figma bridge.

## Architecture Overview

Three processes form the communication chain:

```
MCP Client (e.g. Claude Code)  ←stdio→  MCP Server (packages/core)  ←WebSocket→  Relay (packages/tunnel)  ←WebSocket→  Figma Plugin (packages/adapter-figma)
```

The relay runs on `localhost:3055` and bridges the MCP server to the Figma plugin via a named channel (default: `vibma`). Each channel allows exactly one MCP and one plugin connection.

## Architecture Rules

Package-specific rules live alongside the code they govern:

- **`schema/AGENTS.md`** — compiler pipeline, YAML authoring, tool description quality
- **`packages/core/AGENTS.md`** — endpoint contract, access tiers, response types & docs
- **`packages/adapter-figma/AGENTS.md`** — batch handler, response design, agent guidance, command dispatch

### Endpoint vs Standalone Tool

**Endpoint** (single tool with `method` dispatch): for **homogeneous resources** that share a consistent shape and support CRUD. Examples: `styles`, `variables`, `variable_collections`, `components`, `instances`.

**Standalone tool**: when operations are **heterogeneous** (different types need wildly different schemas), operate on a different resource than the endpoint, or are simple actions that don't fit CRUD.

**Don't create a tool that's a subset of another.** If `frames(method: "update")` already applies styles via `fill.styleName`, don't add a separate tool. If a fix can be done with existing primitives, don't add a dedicated tool.

## Build Pipeline

`npm run build` (tsup) produces:
- `dist/mcp.js` — MCP server (Node.js)
- `plugin/code.js` — Figma plugin (IIFE bundle)
- `plugin/ui.html` — copied from plugin UI source via `tsup.config.ts` `onSuccess` hook

**Figma watches `plugin/` for file changes** — build auto-reloads the plugin and reconnects. No manual action needed in Figma.

**The MCP server is a stdio process — it does NOT hot-reload.** After every build, the user must restart the MCP connection in their client (e.g. `/mcp` in Claude Code), then `connection(method: "create")` + `connection(method: "get")` to verify.

## Running the Relay

```bash
npm run socket          # or: cd packages/tunnel && node dist/index.js
lsof -ti :3055 | xargs kill -9   # kill stuck relay from previous session
```

After relay restart: plugin auto-reconnects, but the user must restart the MCP server connection in their client.

## Testing Changes End-to-End

1. Make code changes
2. `npm run build` (plugin auto-reloads in Figma)
3. **Ask the user** to restart the MCP server connection in their MCP client (e.g. `/mcp` in Claude Code) — you cannot do this yourself, it requires user action
4. `connection(method: "create")` → `connection(method: "get")` to verify chain
5. Test the tools you changed

## Checklist: Adding/Modifying/Removing a Tool

1. **YAML schema** (`schema/tools/*.yaml`): add/update/remove tool definition with params, methods, notes
2. **Figma handler** (`packages/adapter-figma/src/handlers/`): add/update/remove handler + register in `registry.ts`
3. **Response types** (`packages/core/src/tools/generated/response-types.ts`): add/update/remove interface + `toolResponseSchemas` entry
4. **SKIP_FOCUS** (`packages/adapter-figma/src/plugin/code.ts`): add read-only tools (non-node resources)
5. **String references**: search for old tool names in `helpers.ts`, `lint.ts`, prompts, and docs
6. **AGENTS.md files**: update if the change affects architecture rules or conventions — these files are a source of truth that agents and other docs reference
7. **Regenerate**: `npx tsx schema/compiler/index.ts` — updates `defs.ts`, `help.ts`, `prompts.ts`, and static docs site MDX pages. All are derived from the YAML and will go stale without this step.
8. **Build**: `npm run build`
