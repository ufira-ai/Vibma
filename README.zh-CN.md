> **[English](./README.md)**

<div align="center">

<img src="./logo.svg" alt="Vibma" width="120" />

# Vibma

**Vibe Design 遇上 Figma。**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

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

## 社区

[![Discord Banner](https://img.shields.io/discord/1476577401298358315?color=5865F2&label=Join%20the%20Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4XTedZdwV6)

[GitHub Issues](https://github.com/ufira-ai/vibma/issues) — 报告问题和提交功能请求

Vibma 是 **[ufira](https://github.com/ufira-ai)** 的首个开源项目——一个连接创作者与技术的平台。我们相信每个想要创作的人都应该能使用 AI 驱动的工具，而不仅仅是开发者。

## 致谢

基于 [sonnylazuardi](https://github.com/sonnylazuardi) 的 [cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) 构建。

## 许可证

[MIT](./LICENSE)
