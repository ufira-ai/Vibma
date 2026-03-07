#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import { readFileSync } from "fs";
import { join, basename } from "path";
import { fileURLToPath } from "url";
import { registerAllTools } from "./tools/mcp-registry";

// Read version — works with both tsx (source) and node (compiled dist/)
let VIBMA_VERSION = "0.0.0";
try {
  // Walk up from current file's dir to find package.json
  // Use import.meta.url (works in ESM), __dirname (works in CJS), process.cwd() as last resort
  const start = typeof import.meta?.url !== "undefined"
    ? join(fileURLToPath(import.meta.url), "..")
    : typeof __dirname !== "undefined" ? __dirname : process.cwd();
  for (let dir = start; dir !== "/"; dir = join(dir, "..")) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.name === "@ufira/vibma") { VIBMA_VERSION = pkg.version; break; }
      // Workspace root — dist/ is at root level, read core package version
      if (pkg.workspaces) {
        try { VIBMA_VERSION = JSON.parse(readFileSync(join(dir, "packages/core/package.json"), "utf8")).version; } catch {}
        break;
      }
    } catch { continue; }
  }
} catch { /* fallback */ }

// ─── Logger (stderr so it doesn't pollute MCP stdio) ────────────
const logger = {
  info: (msg: string) => process.stderr.write(`[INFO] ${msg}\n`),
  debug: (msg: string) => process.stderr.write(`[DEBUG] ${msg}\n`),
  warn: (msg: string) => process.stderr.write(`[WARN] ${msg}\n`),
  error: (msg: string) => process.stderr.write(`[ERROR] ${msg}\n`),
  log: (msg: string) => process.stderr.write(`[LOG] ${msg}\n`),
};

// ─── Types ───────────────────────────────────────────────────────

interface FigmaResponse {
  id: string;
  result?: any;
  error?: string;
}

interface CommandProgressUpdate {
  type: "command_progress";
  commandId: string;
  commandType: string;
  status: "started" | "in_progress" | "completed" | "error";
  progress: number;
  totalItems: number;
  processedItems: number;
  currentChunk?: number;
  totalChunks?: number;
  chunkSize?: number;
  message: string;
  payload?: any;
  timestamp: number;
}

// ─── WebSocket state ─────────────────────────────────────────────

let ws: WebSocket | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
    lastActivity: number;
  }
>();
let currentChannel: string | null = null;
let activePort: number = parseInt(process.env.VIBMA_PORT || "3055");
let rejected = false; // Suppress auto-reconnect after ROLE_OCCUPIED rejection
let versionWarning: string | null = null;

// CLI args
const args = process.argv.slice(2);
const serverArg = args.find((a) => a.startsWith("--server="));
const portArg = args.find((a) => a.startsWith("--port="));
const serverUrl = serverArg ? serverArg.split("=")[1] : "localhost";
if (portArg) activePort = parseInt(portArg.split("=")[1]);
const WS_URL = serverUrl === "localhost" ? `ws://${serverUrl}` : `wss://${serverUrl}`;

// Access-tier flags: read is always on, --create / --edit opt-in
const caps = {
  create: args.includes("--create") || args.includes("--edit"),
  edit: args.includes("--edit"),
};

// ─── WebSocket connection ────────────────────────────────────────

function connectToFigma(port: number = activePort) {
  activePort = port;
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info("Already connected to Figma");
    return;
  }

  const wsUrl = serverUrl === "localhost" ? `${WS_URL}:${port}` : WS_URL;
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`);
  ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    logger.info("Connected to Figma socket server");
    currentChannel = null;
  });

  ws.on("message", (data: any) => {
    try {
      const json = JSON.parse(data) as any;

      // Handle same-client rejoin (already in channel)
      if (json.type === "join-success") {
        logger.info(json.message);
        if (json.id && pendingRequests.has(json.id)) {
          const req = pendingRequests.get(json.id)!;
          clearTimeout(req.timeout);
          req.resolve({ status: "already_joined", channel: json.channel });
          pendingRequests.delete(json.id);
        }
        return;
      }

      // Handle system messages with a code (version mismatch, peer join/leave)
      // Note: join-success also uses type=system but carries message.id + message.result — let those fall through
      if (json.type === "system" && json.code) {
        if (json.code === "VERSION_MISMATCH") {
          versionWarning = json.message;
          logger.warn(`Version mismatch: ${json.message}`);
        }
        return;
      }

      // Handle relay errors (e.g., ROLE_OCCUPIED rejection)
      if (json.type === "error") {
        logger.error(`Relay error: ${json.message}`);
        if (json.code === "ROLE_OCCUPIED") rejected = true;
        if (json.id && pendingRequests.has(json.id)) {
          const req = pendingRequests.get(json.id)!;
          clearTimeout(req.timeout);
          req.reject(new Error(json.message));
          pendingRequests.delete(json.id);
        }
        return;
      }

      // Handle progress updates
      if (json.type === "progress_update") {
        const progressData = json.message.data as CommandProgressUpdate;
        const requestId = json.id || "";

        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId)!;
          request.lastActivity = Date.now();
          clearTimeout(request.timeout);
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`);
              pendingRequests.delete(requestId);
              request.reject(new Error("Request to Figma timed out"));
            }
          }, 60000);
          logger.info(`Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`);
          if (progressData.status === "completed" && progressData.progress === 100) {
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`);
          }
        }
        return;
      }

      // Handle regular responses
      const myResponse = json.message;
      logger.debug(`Received message: ${JSON.stringify(myResponse)}`);

      if (myResponse.id && pendingRequests.has(myResponse.id) && myResponse.result) {
        const request = pendingRequests.get(myResponse.id)!;
        clearTimeout(request.timeout);
        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`);
          request.reject(new Error(myResponse.error));
        } else {
          request.resolve(myResponse.result);
        }
        pendingRequests.delete(myResponse.id);
      } else {
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`);
      }
    } catch (error) {
      logger.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ws.on("error", (error) => {
    logger.error(`Socket error: ${error}`);
  });

  ws.on("close", () => {
    logger.info("Disconnected from Figma socket server");
    ws = null;
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Connection closed"));
      pendingRequests.delete(id);
    }
    if (rejected) {
      logger.info('Not reconnecting — channel role was rejected. Call connection(method: "create") to retry.');
    } else {
      logger.info("Attempting to reconnect in 2 seconds...");
      setTimeout(() => connectToFigma(port), 2000);
    }
  });
}

// ─── Channel management ──────────────────────────────────────────

async function joinChannel(channelName: string): Promise<void> {
  rejected = false; // Reset rejection state on explicit join attempt
  versionWarning = null;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectToFigma();
    // Wait briefly for connection
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("Not connected to relay. Check that the relay server is running.");
    }
  }
  try {
    await sendCommandToFigma("join", { channel: channelName });
    currentChannel = channelName;
    logger.info(`Joined channel: ${channelName}`);
  } catch (error) {
    logger.error(`Failed to join channel: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ─── Send command to Figma ───────────────────────────────────────

function sendCommandToFigma(
  command: string,
  params: unknown = {},
  timeoutMs: number = 30000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma();
      reject(new Error("Not connected to Figma. Attempting to connect..."));
      return;
    }

    const requiresChannel = command !== "join";
    if (requiresChannel && !currentChannel) {
      reject(new Error('No channel joined. Call connection(method: "create") first with the channel name shown in the Figma plugin panel.'));
      return;
    }

    const id = uuidv4();
    const request = {
      id,
      type: command === "join" ? "join" : "message",
      ...(command === "join"
        ? { channel: (params as any).channel, role: "mcp", version: VIBMA_VERSION, name: basename(process.cwd()) }
        : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
          commandId: id,
        },
      },
    };

    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`);
        reject(new Error(
          `Request to Figma timed out. This usually means the Figma plugin is not connected to the relay. ` +
          `MCP is using port ${activePort}, channel "${currentChannel}". ` +
          `Check the Figma plugin window: the port and channel name must match.`
        ));
      }
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout, lastActivity: Date.now() });
    logger.info(`Sending command to Figma: ${command}`);
    logger.debug(`Request details: ${JSON.stringify(request)}`);
    ws.send(JSON.stringify(request));
  });
}

// ─── MCP Server bootstrap ────────────────────────────────────────

const server = new McpServer({
  name: "VibmaMCP",
  version: "1.0.0",
});

// ─── Connection endpoint (inline methods + Figma ping) ──────────

import { tools as generatedTools } from "./tools/generated/defs";
const connectionDef = generatedTools.find(t => t.name === "connection")!;
const connectionSchema = typeof connectionDef.schema === "function" ? connectionDef.schema(caps) : connectionDef.schema;

server.registerTool(
  "connection",
  { description: connectionDef.description, inputSchema: connectionSchema },
  async (params: any) => {
    const method = params.method;
    try {
      if (method === "create") {
        const channel = params.channel || "vibma";
        await joinChannel(channel);
        await new Promise((r) => setTimeout(r, 200));
        let msg = `Joined channel "${channel}" on port ${activePort}. Call connection(method: "get") to verify the Figma plugin is connected.`;
        if (versionWarning) msg += `\n\n⚠️ ${versionWarning}\nSee "Version mismatch" in CARRYME.md or DRAGME.md for update steps.`;
        return { content: [{ type: "text", text: msg }] };
      }

      if (method === "list") {
        const url = serverUrl === "localhost"
          ? `http://localhost:${activePort}/channels`
          : `https://${serverUrl}/channels`;
        const response = await fetch(url);
        if (!response.ok) return { content: [{ type: "text", text: `Relay returned ${response.status}: ${await response.text()}` }] };
        const data = await response.json();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      if (method === "delete") {
        const targetChannel = params.channel || currentChannel || "vibma";
        const url = serverUrl === "localhost"
          ? `http://localhost:${activePort}/channels/${encodeURIComponent(targetChannel)}`
          : `https://${serverUrl}/channels/${encodeURIComponent(targetChannel)}`;
        const res = await fetch(url, { method: "DELETE" });
        const body = await res.json() as { ok: boolean; message: string };
        for (const [reqId, request] of pendingRequests.entries()) {
          clearTimeout(request.timeout);
          request.reject(new Error("Tunnel reset by user"));
          pendingRequests.delete(reqId);
        }
        if (ws) { const old = ws; ws = null; old.removeAllListeners(); old.close(1000, "Tunnel reset"); }
        currentChannel = null;
        rejected = false;
        connectToFigma();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const connected = ws && ws.readyState === WebSocket.OPEN;
        return {
          content: [{
            type: "text",
            text: connected
              ? `Tunnel reset: ${body.message}. Reconnected on port ${activePort}.\n\nIMPORTANT: The Figma plugin was also disconnected. Ask the user to reopen the Vibma plugin, then call connection(method: "create") followed by connection(method: "get").`
              : `Tunnel reset: ${body.message}. Reconnection in progress.\n\nIMPORTANT: The Figma plugin was also disconnected. Ask the user to reopen the Vibma plugin, then call connection(method: "create") to retry.`,
          }],
        };
      }

      // method === "get" — send ping to Figma
      const result = await sendCommandToFigma("connection.get", params, 5000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `connection.${method} error: ${error instanceof Error ? error.message : String(error)}` }] };
    }
  }
);

// Register all per-tool-file tools and prompts
registerAllTools(server, sendCommandToFigma, caps);

// ─── Start ───────────────────────────────────────────────────────

function cleanup() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.close(1000, "MCP server shutting down");
  }
}

process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("exit", cleanup);
process.stdin.on("end", () => { cleanup(); process.exit(0); });

async function main() {
  try {
    connectToFigma();
  } catch (error) {
    logger.warn(`Could not connect to Figma initially: ${error instanceof Error ? error.message : String(error)}`);
    logger.warn("Will try to connect when the first command is sent");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("FigmaMCP server running on stdio");
}

main().catch((error) => {
  logger.error(`Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
