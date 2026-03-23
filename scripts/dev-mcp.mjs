#!/usr/bin/env node

/**
 * Dev wrapper for the Vibma MCP server.
 *
 * Sits between Claude Code (stdio) and the real MCP server (child process).
 * Injects a virtual `dev_reload` tool that rebuilds and restarts the server
 * without breaking the stdio connection to Claude Code.
 *
 * Usage:  node scripts/dev-mcp.mjs [--edit] [--create] [--server=...] [--port=...]
 */

import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Dev always gets full access; extra CLI args are passed through
const passthrough = ["--edit", ...process.argv.slice(2)];

// ─── State ───────────────────────────────────────────────────────

let child = null;
let childBuffer = "";          // partial-line buffer from child stdout
let initRequest = null;        // captured `initialize` request
let initNotification = null;   // captured `notifications/initialized`

const DEV_RELOAD_TOOL = {
  name: "dev_reload",
  description:
    "Rebuild and restart the MCP server to pick up code and schema changes. No need to restart Claude Code.",
  inputSchema: { type: "object", properties: {}, required: [] },
};

// ─── Helpers ─────────────────────────────────────────────────────

const log = (msg) => process.stderr.write(`[dev-wrapper] ${msg}\n`);

/** Write a JSON-RPC message to Claude Code's stdout */
function sendToClient(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

/** Write a JSON-RPC message to the child's stdin */
function sendToChild(obj) {
  if (child?.stdin?.writable) {
    child.stdin.write(JSON.stringify(obj) + "\n");
  }
}

/** Write a raw line to the child's stdin */
function sendRawToChild(line) {
  if (child?.stdin?.writable) {
    child.stdin.write(line + "\n");
  }
}

// ─── Child process management ────────────────────────────────────

function spawnChild() {
  child = spawn("npx", ["tsx", "packages/core/src/mcp.ts", ...passthrough], {
    cwd: ROOT,
    stdio: ["pipe", "pipe", "inherit"],
  });

  child.stdout.on("data", (chunk) => {
    childBuffer += chunk.toString();
    let nl;
    while ((nl = childBuffer.indexOf("\n")) !== -1) {
      const line = childBuffer.slice(0, nl);
      childBuffer = childBuffer.slice(nl + 1);
      handleChildLine(line);
    }
  });

  child.on("exit", (code) => {
    // If not reloading, propagate exit
    if (!reloading) process.exit(code ?? 0);
  });
}

function handleChildLine(line) {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);

    // Suppress replayed init response (has our synthetic id)
    if (msg.id === "__dev_init_replay__") return;

    // Inject dev_reload into tools/list responses (only case we re-serialize)
    if (msg.result?.tools && Array.isArray(msg.result.tools)) {
      msg.result.tools.push(DEV_RELOAD_TOOL);
      process.stdout.write(JSON.stringify(msg) + "\n");
      return;
    }

    // Pass raw line through — avoids re-serializing large payloads (e.g. base64 images)
    process.stdout.write(line + "\n");
  } catch {
    // Not JSON — forward raw
    process.stdout.write(line + "\n");
  }
}

// ─── Stdin from Claude Code ──────────────────────────────────────

let stdinBuffer = "";

process.stdin.on("data", (chunk) => {
  stdinBuffer += chunk.toString();
  let nl;
  while ((nl = stdinBuffer.indexOf("\n")) !== -1) {
    const line = stdinBuffer.slice(0, nl);
    stdinBuffer = stdinBuffer.slice(nl + 1);
    handleClientLine(line);
  }
});

function handleClientLine(line) {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);

    // Capture init sequence for replay on restart
    if (msg.method === "initialize") initRequest = line;
    if (msg.method === "notifications/initialized") initNotification = line;

    // Intercept dev_reload
    if (msg.method === "tools/call" && msg.params?.name === "dev_reload") {
      handleReload(msg.id);
      return;
    }

    sendRawToChild(line);
  } catch {
    sendRawToChild(line);
  }
}

// ─── Reload ──────────────────────────────────────────────────────

let reloading = false;

async function handleReload(requestId) {
  reloading = true;
  log("Reload requested — killing child...");

  try {
    // 1. Kill current child
    if (child) {
      child.kill("SIGTERM");
      await new Promise((resolve) => {
        child.once("exit", resolve);
        setTimeout(resolve, 3000);
      });
      child = null;
      childBuffer = "";
    }

    // 2. Codegen + build core
    log("Running codegen...");
    execSync("npm run codegen", { cwd: ROOT, stdio: "pipe", timeout: 30_000 });
    log("Codegen done.");

    // 3. Spawn new child
    spawnChild();

    // 4. Replay init handshake
    if (initRequest) {
      // Rewrite the id so we can suppress the response
      const req = JSON.parse(initRequest);
      req.id = "__dev_init_replay__";
      sendToChild(req);
      // Give it a moment to process initialize
      await new Promise((r) => setTimeout(r, 300));
      if (initNotification) sendRawToChild(initNotification);
    }

    // 5. Notify Claude Code that tools changed
    sendToClient({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    });

    // 6. Respond to the tool call
    sendToClient({
      jsonrpc: "2.0",
      id: requestId,
      result: {
        content: [{ type: "text", text: "MCP server reloaded successfully." }],
      },
    });

    log("Reload complete.");
  } catch (e) {
    log(`Reload failed: ${e.message}`);
    sendToClient({
      jsonrpc: "2.0",
      id: requestId,
      result: {
        content: [
          { type: "text", text: `Reload failed: ${e.message}` },
        ],
        isError: true,
      },
    });
    // Try to respawn so we're not dead
    if (!child) spawnChild();
  } finally {
    reloading = false;
  }
}

// ─── Start ───────────────────────────────────────────────────────

process.stdin.on("end", () => {
  if (child) child.kill("SIGTERM");
  process.exit(0);
});

spawnChild();
