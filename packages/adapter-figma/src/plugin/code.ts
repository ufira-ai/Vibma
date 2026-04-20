// Figma Plugin entry point
// Built by tsup into code.js (IIFE bundle) for the Figma plugin sandbox

import { allFigmaHandlers } from "../handlers/registry";

// ─── Plugin State ────────────────────────────────────────────────

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 260;
const MAX_WIDTH = 400;

const state = {
  serverPort: 3055,
  channelName: "",
  locale: "",
  uiWidth: DEFAULT_WIDTH,
};

// ─── UI Setup ────────────────────────────────────────────────────

figma.showUI(__html__, { width: DEFAULT_WIDTH, height: 480 });

// Send saved settings to UI on startup
figma.clientStorage.getAsync("settings").then((saved: any) => {
  if (saved) {
    if (saved.serverPort) state.serverPort = saved.serverPort;
    if (saved.channelName) state.channelName = saved.channelName;
    if (saved.locale) state.locale = saved.locale;
    if (saved.uiWidth) {
      state.uiWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, saved.uiWidth));
      figma.ui.resize(state.uiWidth, 480);
    }
  }
  figma.ui.postMessage({ type: "restore-settings", serverPort: state.serverPort, channelName: state.channelName, locale: state.locale || "en", uiWidth: state.uiWidth });
});

// ─── Auto-Focus ─────────────────────────────────────────────────
// After every create/modify command, select affected nodes and scroll
// viewport to show them. Fire-and-forget — never blocks the response.

const SKIP_FOCUS = new Set([
  "join", "set_selection", "set_viewport", "zoom_into_view", "set_focus",
  "set_current_page", "create_page", "rename_page", "delete_node",
  "get_document_info", "get_current_page", "get_selection",
  "get_node_info", "get_available_fonts",
  "variable_collections", "variables",
  "search_nodes", "scan_text_nodes", "export_node_as_image",
  "lint_node", "get_node_variables", "ping",
]);

function extractNodeIds(result: any, params: any): string[] {
  const ids: string[] = [];
  // From result (create commands return {id} or {results: [{id}, ...]})
  if (result?.id && typeof result.id === "string") ids.push(result.id);
  if (Array.isArray(result?.results)) {
    for (const r of result.results) {
      if (r?.id && typeof r.id === "string") ids.push(r.id);
    }
  }
  // Fallback: from params (modify commands use items[].nodeId)
  if (ids.length === 0 && Array.isArray(params?.items)) {
    for (const item of params.items) {
      if (item?.nodeId && typeof item.nodeId === "string") ids.push(item.nodeId);
    }
  }
  return ids;
}

async function autoFocus(nodeIds: string[]) {
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (node && "x" in node) nodes.push(node as SceneNode);
  }
  if (nodes.length > 0) {
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
  }
}

// ─── Message Handling ────────────────────────────────────────────

// Serialized autoFocus: tracked so the next command waits for it to finish.
// This prevents race conditions where viewport/selection changes from autoFocus
// interfere with getNodeByIdAsync in the next command.
let pendingAutoFocus: Promise<void> | null = null;

figma.ui.onmessage = async (msg: any) => {
  switch (msg.type) {
    case "update-settings":
      updateSettings(msg);
      break;
    case "notify":
      figma.notify(msg.message);
      break;
    case "close-plugin":
      figma.closePlugin();
      break;
    case "resize":
      if (msg.width) {
        state.uiWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, msg.width));
      }
      figma.ui.resize(state.uiWidth, msg.height);
      break;
    case "save-width":
      state.uiWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, msg.width));
      figma.clientStorage.setAsync("settings", {
        serverPort: state.serverPort,
        channelName: state.channelName,
        locale: state.locale,
        uiWidth: state.uiWidth,
      });
      break;
    case "execute-command":
      try {
        // Wait for any pending autoFocus from the previous command
        if (pendingAutoFocus) {
          await pendingAutoFocus;
          pendingAutoFocus = null;
        }
        const result = await handleCommand(msg.command, msg.params);
        figma.ui.postMessage({
          type: "command-result",
          id: msg.id,
          result,
        });
        // Start autoFocus after response is sent (non-blocking for current command,
        // but the next command will await it before running)
        if (!SKIP_FOCUS.has(msg.command)) {
          const ids = extractNodeIds(result, msg.params);
          if (ids.length > 0) {
            pendingAutoFocus = autoFocus(ids).catch(() => {});
          }
        }
      } catch (error: any) {
        const errorMsg = error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error) || "Error executing command";
        figma.ui.postMessage({
          type: "command-error",
          id: msg.id,
          error: errorMsg || `Unknown error (${typeof error})`,
        });
      }
      break;
  }
};

// Listen for plugin commands from menu
figma.on("run", () => {
  figma.ui.postMessage({ type: "auto-connect" });
});

// ─── Settings ────────────────────────────────────────────────────

function updateSettings(settings: any) {
  if (settings.serverPort) {
    state.serverPort = settings.serverPort;
  }
  if (settings.channelName !== undefined) {
    state.channelName = settings.channelName;
  }
  if (settings.locale) {
    state.locale = settings.locale;
  }
  figma.clientStorage.setAsync("settings", {
    serverPort: state.serverPort,
    channelName: state.channelName,
    locale: state.locale,
    uiWidth: state.uiWidth,
  });
}

// ─── Command Dispatch ────────────────────────────────────────────

async function handleCommand(command: string, params: any): Promise<any> {
  const handler = allFigmaHandlers[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);

  // Ensure the current page is fully loaded before any handler runs.
  // Without this, getNodeByIdAsync can return null for nodes that exist,
  // appendChild can throw on pages that aren't synced, and node IDs can
  // shift between pre-sync (temporary) and post-sync (stable) formats.
  await figma.currentPage.loadAsync();

  return await handler(params);
}
