> **[English](./README.md)**

<div align="center">

# ✦ Vibma

**Vibe Design 遇上 Figma。**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

让 AI 代理直接在 Figma 中进行设计——读取布局、创建组件、修改样式，并通过对话构建完整的设计系统。

---

## 模型推荐

Vibma 兼容任何支持 MCP 的大语言模型。以下是基于[基准测试](https://github.com/ufira-ai/vibma-benchmark)的推荐：

- **低成本一次性构建：** GPT-5.3 Codex（meidum）——正确创建组件、绑定所有变量，费用低于 $1。不适合后续迭代任务。
- **迭代设计工作：** GPT-5.3 Codex（xhigh）、Gemini 3.1 Pro 或 Claude Opus 4.6——随上下文增长仍保持质量，适合多轮工作流。
- **不推荐：** 跳过组件搭建的模型（如 Cursor Auto、Kimi K2.5）生成的画面看似正确，但结构不可用——没有实例、没有变体、没有组件库。

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
