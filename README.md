> **[简体中文](./README.zh-CN.md)**

<div align="center">

<img src="./logo.svg" alt="Vibma" width="120" />

# Vibma

**Vibe Design meets Figma.**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

Design with peace of mind in structure. Vibma helps AI agents keep Figma files
structurally consistent, with better token discipline, auto-layout, component
architecture, and reusable design-system patterns.

---

## Model Recommendations

Vibma works with any LLM that supports MCP, but model quality still matters.

| Recommendation       | OpenAI | Claude            | Gemini | Open Source |
|----------------------|---|-------------------|---|---|
| **Baseline**         | GPT 5.2 Medium | Claude Sonnet 4.6 | Gemini 2.5 Flash | Kimi K2.5 |
| **Best performance** | GPT 5.4 | Claude Opus 4.6   | Gemini 3.1 Pro | None currently recommended |

- **OpenAI:** GPT 5.4 is the general recommendation. It achieves strong compatibility with Vibma while also having good baseline design taste.
- **Claude:** Claude Opus 4.6 is the most capable model for working with the Vibma plugin, but its final design sense is less reliable than its tool competence suggests.
- **Gemini:** Gemini 3.1 Pro is a neutral choice between compatibility and design quality, but GPT 5.4 currently surpasses it on both.
- **Open source:** Open-source models still struggle with this task. Kimi K2.5 is the baseline for basic functions such as managing variable collections, but these smaller models are more likely to introduce inconsistencies in the final mockup.

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
