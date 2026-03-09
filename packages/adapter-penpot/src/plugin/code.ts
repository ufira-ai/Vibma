/**
 * Penpot Plugin entry point.
 *
 * Key differences from adapter-figma/src/plugin/code.ts:
 *
 * 1. Global API: `penpot` instead of `figma`
 *    - `penpot.ui.open()` instead of `figma.showUI()`
 *    - `penpot.on("message", ...)` instead of `figma.ui.onmessage`
 *    - No `figma.getNodeByIdAsync()` — use `penpot.currentPage.findById(id)`
 *
 * 2. Layout model: CSS Flex/Grid instead of Figma layout modes
 *    - `layoutFlexDir: "row" | "column"` instead of `layoutMode: "HORIZONTAL" | "VERTICAL"`
 *    - `layoutAlignItems` / `layoutJustifyContent` instead of `primaryAxisAlignItems`
 *    - See handlers/helpers.ts for mapping utilities
 *
 * 3. Plugin loading: loaded via host URL dev server (see manifest.json `host` field)
 *    rather than a bundled `code.js` file in Figma's plugin sandbox.
 *
 * 4. No `__html__` template literal — the UI is served by the dev server at `host`.
 */

import { allPenpotHandlers } from "../handlers/registry";

// Keep in sync with package.json version
const VIBMA_VERSION = "0.1.0";

// ─── Plugin bootstrap ────────────────────────────────────────────
// Penpot opens a UI iframe via penpot.ui.open().
// The width/height options mirror what adapter-figma uses for visual consistency.
penpot.ui.open("Vibma", `?version=${VIBMA_VERSION}`, { width: 380, height: 300 });

// ─── Message dispatch ────────────────────────────────────────────
// Messages from the UI iframe arrive via penpot.ui.onMessage<T>(callback).
// This is the Penpot equivalent of figma.ui.onmessage in adapter-figma.
// The UI sends commands received from the WebSocket relay; we dispatch them
// to handler functions and post results back via penpot.ui.sendMessage().

penpot.ui.onMessage<any>((msg) => {
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case "execute-command":
      handleCommand(msg.command, msg.params)
        .then((result) => {
          penpot.ui.sendMessage({ type: "command-result", id: msg.id, result });
        })
        .catch((err: any) => {
          penpot.ui.sendMessage({
            type: "command-error",
            id: msg.id,
            error: err?.message ?? String(err),
          });
        });
      break;

    case "notify":
      // Penpot does not expose a figma.notify() equivalent in the plugin API;
      // acknowledgement is sent back to the UI which can display a toast.
      penpot.ui.sendMessage({ type: "ack" });
      break;

    default:
      break;
  }
});

// ─── Command router ──────────────────────────────────────────────

async function handleCommand(command: string, params: any): Promise<any> {
  const handler = allPenpotHandlers[command];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  return handler(params);
}
