import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const port = parseInt(process.env.VIBMA_PORT || "3055");

// ─── Types ──────────────────────────────────────────────────────

type Role = "mcp" | "plugin";

interface ChannelMember {
  ws: WebSocket;
  role: Role;
  version: string | null;
  joinedAt: number;
}

interface Channel {
  mcp: ChannelMember | null;
  plugin: ChannelMember | null;
}

// ─── State ──────────────────────────────────────────────────────

const channels = new Map<string, Channel>();
// Reverse lookup: ws → { channel, role } for O(1) cleanup on disconnect
const clientInfo = new WeakMap<WebSocket, { channel: string; role: Role }>();

// ─── HTTP server (CORS + debug endpoint) ────────────────────────

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Debug endpoint: GET /channels
  if (req.method === "GET" && req.url === "/channels") {
    const snapshot: Record<string, any> = {};
    channels.forEach((ch, name) => {
      snapshot[name] = {
        mcp: ch.mcp
          ? { connected: true, version: ch.mcp.version, joinedAt: new Date(ch.mcp.joinedAt).toISOString() }
          : null,
        plugin: ch.plugin
          ? { connected: true, version: ch.plugin.version, joinedAt: new Date(ch.plugin.joinedAt).toISOString() }
          : null,
      };
    });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(snapshot, null, 2));
    return;
  }

  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket server running");
});

// ─── WebSocket server ───────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

const HEARTBEAT_INTERVAL = 15_000;
const aliveClients = new WeakSet<WebSocket>();

const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!aliveClients.has(ws)) return ws.terminate();
    aliveClients.delete(ws);
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on("close", () => clearInterval(heartbeat));

// ─── Connection handler ─────────────────────────────────────────

wss.on("connection", (ws: WebSocket) => {
  console.log("New client connected");
  aliveClients.add(ws);
  ws.on("pong", () => aliveClients.add(ws));

  ws.send(JSON.stringify({
    type: "system",
    message: "Please join a channel to start chatting",
  }));

  ws.on("message", (raw: Buffer | string) => {
    try {
      const message = raw.toString();
      const data = JSON.parse(message);

      // ── Join ────────────────────────────────────────────────
      if (data.type === "join") {
        const channelName = data.channel;
        if (!channelName || typeof channelName !== "string") {
          ws.send(JSON.stringify({ type: "error", id: data.id, message: "Channel name is required" }));
          return;
        }

        const role: string | undefined = data.role;
        if (role !== "mcp" && role !== "plugin") {
          ws.send(JSON.stringify({
            type: "error",
            id: data.id,
            code: "INVALID_ROLE",
            message: `Invalid or missing role "${role ?? ""}". Must be "mcp" or "plugin". Please update your Vibma plugin and MCP server.`,
          }));
          return;
        }

        // Create channel if needed
        if (!channels.has(channelName)) {
          channels.set(channelName, { mcp: null, plugin: null });
        }

        const channel = channels.get(channelName)!;

        // Enforce one-per-role
        if (channel[role] !== null) {
          const occupant = role === "mcp" ? "MCP server" : "Figma plugin";
          ws.send(JSON.stringify({
            type: "error",
            id: data.id,
            code: "ROLE_OCCUPIED",
            message: `A ${occupant} is already connected to channel "${channelName}". Disconnect it first or use a different channel name.`,
            channel: channelName,
          }));
          return;
        }

        // Assign the slot
        const version: string | null = data.version ?? null;
        channel[role] = { ws, role: role as Role, version, joinedAt: Date.now() };
        clientInfo.set(ws, { channel: channelName, role: role as Role });

        // Send join-success
        ws.send(JSON.stringify({
          type: "system",
          message: `Joined channel: ${channelName}`,
          channel: channelName,
        }));
        ws.send(JSON.stringify({
          type: "system",
          message: { id: data.id, result: `Connected to channel: ${channelName}` },
          channel: channelName,
        }));

        // Notify counterpart + version mismatch check
        const otherRole: Role = role === "mcp" ? "plugin" : "mcp";
        const other = channel[otherRole];
        if (other && other.ws.readyState === WebSocket.OPEN) {
          other.ws.send(JSON.stringify({
            type: "system",
            message: `A ${role} has joined the channel`,
            channel: channelName,
          }));

          // Version mismatch warning
          if (version && other.version && version !== other.version) {
            const warning = `Version mismatch: ${role}=${version}, ${otherRole}=${other.version}. Update both for best results.`;
            const msg = JSON.stringify({ type: "system", code: "VERSION_MISMATCH", message: warning, channel: channelName });
            ws.send(msg);
            other.ws.send(msg);
            console.log(`[WARN] ${warning}`);
          }
        }

        console.log(`[${role}] joined channel "${channelName}"${version ? ` (v${version})` : ""}`);
        return;
      }

      // ── Message / Progress ──────────────────────────────────
      if (data.type === "message" || data.type === "progress_update") {
        const channelName = data.channel;
        if (!channelName || typeof channelName !== "string") {
          ws.send(JSON.stringify({ type: "error", message: "Channel name is required" }));
          return;
        }

        const info = clientInfo.get(ws);
        if (!info || info.channel !== channelName) {
          ws.send(JSON.stringify({ type: "error", message: "You must join the channel first" }));
          return;
        }

        const channel = channels.get(channelName);
        if (!channel) return;

        // Send directly to the counterpart (not broadcast to all)
        const targetRole: Role = info.role === "mcp" ? "plugin" : "mcp";
        const target = channel[targetRole];
        if (target && target.ws.readyState === WebSocket.OPEN) {
          target.ws.send(JSON.stringify({
            type: "broadcast",
            message: data.message,
            sender: info.role,
            channel: channelName,
          }));
        }
      }
    } catch (err) {
      console.error("Error handling message:", err);
    }
  });

  // ── Disconnect ────────────────────────────────────────────────
  ws.on("close", () => {
    const info = clientInfo.get(ws);
    if (!info) {
      console.log("Unknown client disconnected");
      return;
    }

    const { channel: channelName, role } = info;
    console.log(`[${role}] disconnected from channel "${channelName}"`);

    const channel = channels.get(channelName);
    if (channel) {
      channel[role] = null;

      // Notify remaining occupant
      const otherRole: Role = role === "mcp" ? "plugin" : "mcp";
      const other = channel[otherRole];
      if (other && other.ws.readyState === WebSocket.OPEN) {
        other.ws.send(JSON.stringify({
          type: "system",
          message: `The ${role} has left the channel`,
          channel: channelName,
        }));
      }

      // Delete empty channels
      if (!channel.mcp && !channel.plugin) {
        channels.delete(channelName);
      }
    }

    clientInfo.delete(ws);
  });
});

// uncomment this to allow connections in windows wsl
// httpServer.listen(port, "0.0.0.0", () => {
httpServer.listen(port, () => {
  console.log(`WebSocket server running on port ${port}`);
});
