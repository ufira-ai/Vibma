> **[English](./README.md)**

<div align="center">

<img src="./logo.svg" alt="Vibma" width="120" />

# Vibma

**Vibe Design 遇上 Figma。**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

> **项目状态：** Vibma 已停止积极开发。Figma 已通过
> **[Figma for Agents](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)**
> 推出原生 MCP 能力，Vibma 插件因与该官方功能"重叠"而未被 Figma 市场接受。
>
> **Vibma 不是 Figma 官方工具。** 我们建议在生产环境中使用 Figma 的原生 MCP 集成，
> 并关注 [Figma 官方博客](https://www.figma.com/blog/) 获取最新的代理能力更新。
>
> 源代码以 MIT 协议开放，供学习和参考使用。
> 我们建议在使用 Vibma 之前阅读 [Figma 服务条款](https://www.figma.com/tos/)，
> 以确保符合其平台政策。

让设计师回归设计品味，把结构需求交给 Vibma。Vibma 帮助 AI 代理操作并保持 Figma
文件的结构一致性，强化规范 design token、auto-layout、组件架构与可复用的设计系统模式。

---

## 模型推荐

Vibma 兼容任何支持 MCP 的大语言模型，但模型质量仍然很重要。

| 推荐层级     | OpenAI | Claude | Gemini           | 开源模型 |
|----------|---|---|------------------|---|
| **最低要求** | GPT 5.2 Medium | Claude Sonnet 4.6 | Gemini 2.5 Flash | Kimi K2.5 |
| **最佳表现** | GPT 5.4 | Claude Opus 4.6 | Gemini 3.1 Pro   | 目前没有推荐 |

- **OpenAI：** GPT 5.4 是当前的通用推荐。在 Vibma 兼容性和基础设计品味之间取得了最好的平衡。
- **Claude：** Claude Opus 4.6 是目前最擅长使用 Vibma 插件的模型，但最终设计成果AI味较重。
- **Gemini：** Gemini 3.1 Pro 是兼容性和设计质量之间比较中性的选择，但 GPT 5.4 目前在两方面都更强。
- **开源模型：** 开源模型仍然普遍难以胜任这类任务。Kimi K2.5 可以作为要求基准线，完成变量集合管理等基础功能，但更容易在 mockup 中使用不规范的结构。

## 安装

两种方式：

| | 指南 | 适用场景 |
|---|---|---|
| 📦 | [**DRAGME.md**](./DRAGME.zh-CN.md) | 克隆仓库，从源码构建，完全掌控 |
| ☁️ | [**CARRYME.md**](./CARRYME.zh-CN.md) | 从 npm 安装，无需克隆 |
| 📖 | [**Docs**](https://ufira-ai.github.io/Vibma/zh-cn) | 工具参考文档，包含参数、响应结构和示例 |

或者直接把下面这段话发给你的 AI 代理，让它自行完成设置：

```
帮我设置好Vibma
指令在这里： https://raw.githubusercontent.com/ufira-ai/vibma/refs/heads/main/CARRYME.md
```

## 可选：库与图片工具

Vibma 的核心工具无需任何 API 密钥即可使用。两个可选集成可解锁额外功能：

| 环境变量 | 启用功能 | 获取方式 |
|---------|---------|---------|
| `FIGMA_API_TOKEN` | **库工具** — 发现和使用已发布的团队库组件和样式 | [Figma 设置 > 安全 > 个人访问令牌](https://www.figma.com/developers/api#access-tokens) |
| `FIGMA_TEAM_ID` | 库发现的默认团队 | 从 Figma 主页 URL 复制数字：`figma.com/files/team/<TEAM_ID>/...` |
| `PEXELS_API_KEY` | **图片工具** — 搜索和放置免费图库照片 | [Pexels API](https://www.pexels.com/api/key/)（免费） |

Figma 个人访问令牌需要两个权限：**File content — Read**（`file_content:read`）和 **Team library content — Read**（`team_library_content:read`）。

详细配置请参阅 [DRAGME.md](./DRAGME.zh-CN.md) 或 [CARRYME.md](./CARRYME.zh-CN.md)。

## 社区

[![Discord Banner](https://img.shields.io/discord/1476577401298358315?color=5865F2&label=Join%20the%20Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4XTedZdwV6)

[GitHub Issues](https://github.com/ufira-ai/vibma/issues) — 报告问题和提交功能请求

Vibma 是 **[ufira](https://github.com/ufira-ai)** 的首个开源项目——一个连接创作者与技术的平台。我们相信每个想要创作的人都应该能使用 AI 驱动的工具，而不仅仅是开发者。

## 致谢

基于 [sonnylazuardi](https://github.com/sonnylazuardi) 的 [cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) 构建。

图库照片由 [Pexels](https://www.pexels.com) 提供 — 个人和商业用途均免费。请阅读 [Pexels 服务条款](https://www.pexels.com/terms-of-service/)，在生产环境中使用图片时请注明摄影师。

## 许可证

[MIT](./LICENSE)
