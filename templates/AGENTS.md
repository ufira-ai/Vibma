# Agent Instructions (Figma via Vibma MCP)

Use **Vibma** as the *only* integration for interacting with Figma (read/search/export/create/edit/delete). Do not attempt to “guess” Figma geometry or reimplement Figma APIs. If a task involves a Figma URL, node id, screenshots, tokens/variables, or design-to-code, route it through **Vibma MCP tools**.

## Required workflow

1. **Ensure the local WebSocket relay is running**
   - From the Vibma repo root: `npm run socket`
   - Default port: `3055` (alternatives: `3056–3058` via `VIBMA_PORT`)
   - Security: relay binds to `127.0.0.1` by default. To expose to LAN explicitly: `VIBMA_HOST=0.0.0.0 npm run socket`

2. **Ensure the Figma plugin is running and connected**
   - In Figma: Plugins → Development → run “Vibma”
   - In the plugin UI: select the matching port and channel, then click **Connect**
   - Normal `npm run build` updates hot-reload the plugin from `plugin/`. Do not assume the user needs to reopen the plugin or click **Connect** again after a build.

3. **Connect from MCP to the same channel**
   - Call `join_channel` with the channel name (default: `vibma`)
   - Call `ping` and confirm a `pong` with a document name/page

Only proceed with Figma actions after `ping` succeeds.

## MCP server configuration

Prefer running the Vibma MCP server from the built artifact:

- `node /absolute/path/to/vibma/dist/mcp.js --edit`

If developing Vibma itself, source mode is acceptable:

- `npx tsx /absolute/path/to/vibma/packages/core/src/mcp.ts --edit`

Access tiers:
- Omit flags for read-only
- Use `--create` for create-only
- Use `--edit` for full edit/delete

## Operational rules

- Re-run `join_channel` + `ping` when the relay/MCP session changed or the connection actually dropped. Do not treat a normal plugin hot-reload after `npm run build` as requiring manual plugin reopen/reconnect.
- Prefer Vibma inspection tools for ground truth (node properties, variables/tokens, rendered screenshots).
- When asked to “match Figma”, always fetch design context/screenshot via Vibma first, then implement.
- If a request would require Figma UI interaction the agent cannot perform, ask the user to (a) open the plugin, (b) click **Connect**, or (c) provide the relevant node id/URL, then retry via Vibma.
