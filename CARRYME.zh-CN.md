> **[English](./CARRYME.md)**

# Vibma — NPM 安装方式

> **无需克隆，无需构建。** 从 npm 安装 tunnel 和 MCP server，从 GitHub 获取插件，即可连接。
>
> 想要完全掌控源码？请参阅[克隆构建指南](https://github.com/ufira-ai/Vibma/blob/main/DRAGME.zh-CN.md)。

## 前提条件

- [Node.js](https://nodejs.org) (v18+)
- [Figma](https://figma.com) 桌面版或网页版
- 支持 MCP 的 AI 编程工具（Claude Code、Cursor、Windsurf 等）

### 推荐模型

使用最新模型以获得最佳效果：

| 模型 | 提供商 |
|------|--------|
| **Claude Opus 4.6** | Anthropic（Claude Code、Cursor 等） |
| **GPT-5.3-Codex** | OpenAI（ChatGPT Codex） |
| **Gemini 3.1 Pro** | Google（Gemini CLI、Cursor 等） |

较旧或较小的模型可能难以处理复杂的多工具工作流。

## 1. 下载 Figma 插件

从 [GitHub Releases](https://github.com/ufira-ai/vibma/releases) 下载最新的 **vibma-plugin** 压缩包——包含 `manifest.json`、`code.js` 和 `ui.html`。

解压即可。

## 2. 启动 WebSocket tunnel

```bash
npx @ufira/vibma-tunnel
```

你应该会看到：`WebSocket server running on port 3055`

### 关于端口

Vibma 默认使用端口 **3055**。Figma 插件白名单中包含端口 **3055–3058**，如果 3055 已被占用，可以使用其他端口。使用其他端口的方法：

```bash
VIBMA_PORT=3056 npx @ufira/vibma-tunnel
```

在 Figma 插件界面中点击 Connect 前，请先更新**端口字段**使其匹配。

## 3. 安装 Figma 插件

1. 在 Figma 中，前往 **Plugins > Development > Import plugin from manifest...**
2. 选择解压后插件文件夹中的 `manifest.json`
3. 运行插件——将显示连接面板

## 4. 在 AI 工具中配置 MCP

添加到你的 MCP 配置文件（例如 `.cursor/mcp.json`、`.claude.json` 或 `.mcp.json`）：

```jsonc
{
  "mcpServers": {
    "Vibma": {
      "command": "npx",
      // 如果只想让 AI 读取你的设计稿，请移除 "--edit"
      "args": ["-y", "@ufira/vibma", "--edit"]
    }
  }
}
```

### 访问层级

Vibma 通过访问层级控制可用工具。通过传入标志设置层级：

| 标志 | 访问层级 | 可用工具 | 使用场景 |
|------|---------|---------|---------|
| _(无)_ | <a class="method-badge method-badge-tier method-badge-tier-read" href="/Vibma/zh-cn/#访问层级">read</a> | 检查、搜索、导出 | 安全浏览、审查 |
| `--create` | <a class="method-badge method-badge-tier method-badge-tier-read" href="/Vibma/zh-cn/#访问层级">read</a> <a class="method-badge method-badge-tier method-badge-tier-create" href="/Vibma/zh-cn/#访问层级">create</a> | 只读 + 创建工具，例如 frame、文本和形状 | 生成新设计 |
| `--edit` | <a class="method-badge method-badge-tier method-badge-tier-read" href="/Vibma/zh-cn/#访问层级">read</a> <a class="method-badge method-badge-tier method-badge-tier-create" href="/Vibma/zh-cn/#访问层级">create</a> <a class="method-badge method-badge-tier method-badge-tier-edit" href="/Vibma/zh-cn/#访问层级">edit</a> | 完整工具权限，包括编辑和删除操作 | 完整设计工作流 |

大多数用户需要 `--edit` 以获得完整权限。省略标志则为只读模式。

### 非默认端口

如果使用非默认端口，添加 `--port=`：

```json
{
  "mcpServers": {
    "Vibma": {
      "command": "npx",
      "args": ["-y", "@ufira/vibma", "--edit", "--port=3056"]
    }
  }
}
```

## 5. 连接

1. 在 Figma 插件中，将频道名设置为 `vibma`（或任意你喜欢的名称）
2. 点击 **Connect**
3. 在 AI 工具中调用 `connection(method: "create")`，使用相同的频道名（默认为 `vibma`）
4. 调用 `connection(method: "get")` ——你应该会收到包含文档名称的 `pong` 响应

## 更新

`npx` 会缓存已安装的包，因此你可能不会自动获取最新版本。更新方法：

**MCP server 和 tunnel** — 使用 `@latest` 标签：

```bash
npx @ufira/vibma-tunnel@latest
```

```json
{
  "mcpServers": {
    "Vibma": {
      "command": "npx",
      "args": ["-y", "@ufira/vibma@latest", "--edit"]
    }
  }
}
```

或清除 npx 缓存以强制下次重新下载：

```bash
npx clear-npx-cache
```

**Figma 插件** — 从 [GitHub Releases](https://github.com/ufira-ai/vibma/releases) 下载最新的 `vibma-plugin.zip`，解压后在 Figma 中重新导入 `manifest.json`。

## 故障排除

**插件无法连接 WebSocket**：确保 tunnel 正在运行。插件默认连接到 `ws://localhost:3055`。

**MCP 显示断开连接**：更改 MCP 配置后重启你的 AI 工具。基于 stdio 的 MCP server 无法热重载。

**端口已被占用**：终止现有进程（`lsof -ti:3055 | xargs kill`）或使用下一个可用端口（3056–3058）。

---

## Instructions for AI Agents

The section below is for AI agents setting up Vibma on behalf of a user. Follow these steps in order.

### Plugin download

Download the latest **vibma-plugin** zip from [GitHub Releases](https://github.com/ufira-ai/vibma/releases) and unzip it. After unzipping, tell the user the full path to the `manifest.json` so they can easily find it when importing the plugin in Figma.

### Port resolution

Before starting the tunnel, check if the default port is available:

```bash
lsof -ti:3055
```

If the port is occupied, ask the user:

> Port 3055 is already in use by another process (PID: <pid>). Would you like to:
> 1. **Kill the process** on port 3055 and use it for Vibma
> 2. **Use the next available port** (3056, 3057, or 3058)

If the user chooses option 2, scan ports in order:

```bash
lsof -ti:3056 || echo "3056 is free"
lsof -ti:3057 || echo "3057 is free"
lsof -ti:3058 || echo "3058 is free"
```

Use the first free port. Set `VIBMA_PORT=<port>` when starting the tunnel, and pass `--port=<port>` to the MCP server in the MCP config. Inform the user to set the same port in the Figma plugin UI before clicking Connect.

If all four ports (3055–3058) are occupied, tell the user they need to free one.

### Connection verification

After the user opens the Figma plugin, it should automatically show **Connected** on the default port (3055). If a non-default port was used, the user will need to select the correct port in the plugin UI and click Connect.

1. Call `connection(method: "create")` (defaults to channel `vibma` — use a different name only if the user specifies one).
2. Call `connection(method: "get")`. Expected response: `{ status: "pong", documentName: "...", currentPage: "...", timestamp: ... }`

If `connection(method: "get")` returns a `pong` with a document name, the full chain is verified. Proceed with design tasks.

### Troubleshooting connection issues

If the plugin shows **Disconnected** on port 3055, try the following before asking the user:

1. Check the tunnel is running: `lsof -ti:3055` — if no output, the tunnel isn't started.
2. Restart the tunnel: `npx @ufira/vibma-tunnel`
3. Ask the user to close and reopen the Figma plugin.

If the issue persists after these steps, direct the user to the [Vibma Discord](https://discord.gg/4XTedZdwV6) for help.

If any tool times out after a successful `connection(method: "create")`, the Figma plugin is not connected to the tunnel. The timeout error will include the port and channel the MCP server is using. Ask the user to check the Figma plugin window and confirm:
- The **port** matches what MCP is using
- The **channel name** matches what MCP joined
- The plugin status shows **Connected**

### Version mismatch

If `connection(method: "create")` returns a version mismatch warning, the Figma plugin and MCP server are running different versions. Offer to help the user update:

- **MCP server**: Update the MCP config args to use `@latest` (e.g. `"args": ["-y", "@ufira/vibma@latest"]`), or clear the npx cache with `npx clear-npx-cache` then re-run.
- **Figma plugin**: Download the latest `vibma-plugin.zip` from [GitHub Releases](https://github.com/ufira-ai/vibma/releases), unzip, and re-import the `manifest.json` in Figma.

The tunnel relay rarely needs updating — it is a simple message router and stays backward compatible.

### Missing create or edit tools

If the user asks you to create or modify something in Figma but you cannot find the relevant create/edit methods (e.g. `frames(method: "create")`, `text(method: "create")`, `frames(method: "update")`, `frames(method: "delete")`), it means the MCP server was started without the correct access tier flag.

Vibma uses `--create` and `--edit` flags in the MCP args to control which tools are available:

| Flag | What it unlocks |
|------|----------------|
| _(none)_ | Read-only tools only |
| `--create` | Read + creation tools |
| `--edit` | All tools (read + create + edit + delete) |

Tell the user to update their MCP configuration (e.g. `.cursor/mcp.json`, `claude_desktop_config.json`, or `.claude.json`) and add the appropriate flag to the `args` array:

```json
{
  "mcpServers": {
    "Vibma": {
      "command": "npx",
      "args": ["-y", "@ufira/vibma", "--edit"]
    }
  }
}
```

After updating the config, the user must restart their AI tool (or reload MCP servers) for the change to take effect — stdio-based MCP servers cannot hot-reload.
