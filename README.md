> **[简体中文](./README.zh-CN.md)**

<div align="center">

<img src="./logo.svg" alt="Vibma" width="120" />

# Vibma

**Vibe Design meets Figma.**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

Let AI agents design directly in Figma — read layouts, create components,
modify styles, and build entire design systems through conversation.

---

## Model Recommendations

Vibma works with any LLM that supports MCP. Based on our [benchmark](https://github.com/ufira-ai/vibma-benchmark):

- **Cheap one-shot builds:** GPT-5.3 Codex (medium reasoning) — proper components, all variables bound, clean output for under $1. Degrades on follow-up tasks.
- **Iterative design work:** GPT-5.3 Codex (xhigh), Gemini 3.1 Pro, or Claude Opus 4.6 — these maintain quality as context grows and handle multi-pass workflows.
- **Avoid:** Models that skip figma components building (e.g. Cursor Auto, Kimi K2.5) produce frames that look right but aren't structurally usable — no instances, no variants, no library.

## Setup

Two paths:

| | Guide | For |
|---|---|---|
| 📦 | [**DRAGME.md**](./DRAGME.md) | Clone the repo, build from source, full control |
| ☁️ | [**CARRYME.md**](./CARRYME.md) | Install from npm, zero cloning |
| 📖 | [**Docs**](https://ufira-ai.github.io/Vibma/) | Tool reference with parameters, response schemas, and examples |

Or just paste this to your AI agent and let it figure it out:

```
Set up Vibma so I can vibe-design in Figma.
Follow the instructions at https://raw.githubusercontent.com/ufira-ai/vibma/refs/heads/main/CARRYME.md
```

## Community

[![Discord Banner](https://img.shields.io/discord/1476577401298358315?color=5865F2&label=Join%20the%20Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4XTedZdwV6)

[GitHub Issues](https://github.com/ufira-ai/vibma/issues) — bugs and feature requests

Vibma is the first open-source project from **[ufira](https://github.com/ufira-ai)** — a platform bridging creators and technology. We believe everyone who wants to create should have access to AI-powered tools, not just developers.

## Acknowledgments

Built on the foundation of [cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) by [sonnylazuardi](https://github.com/sonnylazuardi).

## License

[MIT](./LICENSE)
