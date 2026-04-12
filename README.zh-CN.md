> **[English](https://github.com/ufira-ai/vibma/blob/main/README.md)**

<div align="center">

<img src="https://raw.githubusercontent.com/ufira-ai/vibma/main/logo.svg" alt="Vibma" width="120" />

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

Vibma 帮助 AI 代理生成结构规范的 Figma 文件 — 正确的 auto-layout、design token、组件架构与可复用的设计系统模式。

---

## 模型推荐

Vibma 兼容任何支持 MCP 的大语言模型，但模型质量很重要。

| 层级 | OpenAI | Claude | Gemini | 开源模型 |
|------|--------|--------|--------|---------|
| **基线** | GPT 5.2 Medium | Claude Sonnet 4.6 | Gemini 2.5 Flash | Kimi K2.5 |
| **推荐** | GPT 5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | — |

- **GPT 5.4** — 工具能力与设计品味的最佳综合表现。
- **Claude Opus 4.6** — 工具调用最强，但成品设计 AI 味较重。
- **Gemini 3.1 Pro** — 稳健的中间选择；GPT 5.4 目前在两方面略胜一筹。
- **开源模型** — Kimi K2.5 可完成基础功能（变量、样式），但难以胜任复杂的多工具流程。

## 安装

| | 指南 | 适用场景 |
|---|---|---|
| 📦 | [**DRAGME.md**](https://github.com/ufira-ai/vibma/blob/main/DRAGME.zh-CN.md) | 克隆仓库，从源码构建 |
| ☁️ | [**CARRYME.md**](https://github.com/ufira-ai/vibma/blob/main/CARRYME.zh-CN.md) | 从 npm 安装，无需克隆 |
| 📖 | [**文档**](https://ufira-ai.github.io/Vibma/zh-cn) | 工具参考 — 参数、响应结构、示例 |

或直接发给你的 AI 代理：

```
帮我设置好 Vibma。
指令在这里：https://raw.githubusercontent.com/ufira-ai/vibma/refs/heads/main/CARRYME.md
```

## 可选：库与图片工具

核心工具无需 API 密钥。两个可选集成可启用库发现和图库照片：

| 环境变量 | 启用功能 | 获取方式 |
|---------|---------|---------|
| `FIGMA_API_TOKEN` | **库** — 发现已发布的团队库组件和样式 | [Figma 设置 > 安全 > 个人访问令牌](https://www.figma.com/developers/api#access-tokens) |
| `FIGMA_TEAM_ID` | 库发现的默认团队 | `figma.com/files/team/<ID>/...` 中的数字 |
| `PEXELS_API_KEY` | **图片** — 搜索和放置图库照片 | [pexels.com/api/key](https://www.pexels.com/api/key/)（免费） |

Figma PAT 需要两个权限：**File content (Read)** 和 **Team library content (Read)**。详见安装指南中的截图说明。

## 社区

[![Discord](https://img.shields.io/discord/1476577401298358315?color=5865F2&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4XTedZdwV6)

[GitHub Issues](https://github.com/ufira-ai/vibma/issues) — 报告问题和功能请求

Vibma 是 **[ufira](https://github.com/ufira-ai)** 的首个开源项目 — 一个连接创作者与技术的平台。

## 致谢

基于 [sonnylazuardi](https://github.com/sonnylazuardi) 的 [cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) 构建。图标搜索与插入由 [Iconify](https://iconify.design/) 公共 API 提供支持 — 一个开源的统一图标框架，涵盖 100+ 图标集的 200,000+ 图标。图库照片由 [Pexels](https://www.pexels.com) 提供 — 个人和商业用途均免费。请阅读 [Pexels 服务条款](https://www.pexels.com/terms-of-service/)，在生产环境中使用图片时请注明摄影师。

## 许可证

[MIT](https://github.com/ufira-ai/vibma/blob/main/LICENSE)
