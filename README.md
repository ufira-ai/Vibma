> **[简体中文](https://github.com/ufira-ai/vibma/blob/main/README.zh-CN.md)**

<div align="center">

<img src="https://raw.githubusercontent.com/ufira-ai/vibma/main/logo.svg" alt="Vibma" width="120" />

# Vibma

**Vibe Design meets Figma.**

https://github.com/user-attachments/assets/bf38e37d-57bb-40b3-a2d1-f89216117c11
</div>

> **Project Status:** Vibma is no longer under active development. Figma has
> launched native MCP capabilities through
> **[Figma for Agents](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)**,
> and the Vibma plugin was not accepted to the Figma marketplace due to
> "overlap" with this first-party offering.
>
> **Vibma is not an official Figma tool.** For production use, we recommend
> Figma's native MCP integration and encourage you to follow
> [Figma's official updates](https://www.figma.com/blog/) for the latest
> agent capabilities.
>
> The source code remains available under MIT for learning and reference.
> We recommend reading [Figma's Terms of Service](https://www.figma.com/tos/)
> before using Vibma to ensure compliance with their platform policies.

Vibma helps AI agents produce structurally sound Figma files — proper auto-layout, design tokens, component architecture, and reusable design-system patterns.

---

## Model Recommendations

Vibma works with any MCP-capable LLM, but model quality matters.

| Tier | OpenAI | Claude | Gemini | Open Source |
|------|--------|--------|--------|-------------|
| **Baseline** | GPT 5.2 Medium | Claude Sonnet 4.6 | Gemini 2.5 Flash | Kimi K2.5 |
| **Recommended** | GPT 5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | Kimi K2.6 |

- **GPT 5.4** — best overall balance of tool competence and design taste.
- **Claude Opus 4.6** — strongest tool use, but final designs can feel formulaic.
- **Gemini 3.1 Pro** — solid middle ground; GPT 5.4 currently edges it on both axes.
- **Kimi K2.6** — performs well in following harness instructions, probably the cheapeast model that delivers a good experience overall.

## Setup

| | Guide | For |
|---|---|---|
| 📦 | [**DRAGME.md**](https://github.com/ufira-ai/vibma/blob/main/DRAGME.md) | Clone the repo, build from source |
| ☁️ | [**CARRYME.md**](https://github.com/ufira-ai/vibma/blob/main/CARRYME.md) | Install from npm, zero cloning |
| 📖 | [**Docs**](https://ufira-ai.github.io/Vibma/) | Tool reference — parameters, response schemas, examples |

Or paste this to your AI agent:

```
Set up Vibma so I can vibe-design in Figma.
Follow the instructions at https://raw.githubusercontent.com/ufira-ai/vibma/refs/heads/main/CARRYME.md
```

## Optional: Library & Image Tools

All core tools work without API keys. Two optional integrations add library discovery and stock photos:

| Env var | Enables | How to get it |
|---------|---------|---------------|
| `FIGMA_API_TOKEN` | **Library** — discover published team library components and styles | [Figma Settings > Security > Personal access tokens](https://www.figma.com/developers/api#access-tokens) |
| `FIGMA_TEAM_ID` | Default team for library discovery | The number in `figma.com/files/team/<ID>/...` |
| `PEXELS_API_KEY` | **Images** — search and place stock photos | [pexels.com/api/key](https://www.pexels.com/api/key/) (free) |

The Figma PAT requires two scopes: **File content (Read)** and **Team library content (Read)**. See the setup guides for step-by-step instructions with screenshots.

## Community

[![Discord](https://img.shields.io/discord/1476577401298358315?color=5865F2&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/4XTedZdwV6)

[GitHub Issues](https://github.com/ufira-ai/vibma/issues) — bugs and feature requests

Vibma is the first open-source project from **[ufira](https://github.com/ufira-ai)** — a platform bridging creators and technology.

## Acknowledgments

Built on [cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) by [sonnylazuardi](https://github.com/sonnylazuardi). Icon search and insertion powered by the [Iconify](https://iconify.design/) public API — an open-source unified icon framework providing 200,000+ icons from 100+ collections. Stock photos by [Pexels](https://www.pexels.com) — free for personal and commercial use. Please read the [Pexels Terms of Service](https://www.pexels.com/terms-of-service/) and credit photographers in production.

## FAQ

### What is Vibma?

Vibma helps AI agents produce structurally sound Figma files — proper auto-layout, design tokens, component architecture, and reusable design-system patterns. It brings "Vibe Design" to Figma.

### What is Vibma's project status?

**Vibma is no longer under active development.** Figma has launched native MCP capabilities through **[Figma for Agents](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)**, and the Vibma plugin was not accepted to the Figma marketplace due to "overlap" with this first-party offering.

For production use, we recommend Figma's native MCP integration. The Vibma source code remains available under MIT for learning and reference.

### What models work with Vibma?

Vibma works with any MCP-capable LLM. Model quality matters:

| Tier | OpenAI | Claude | Gemini | Open Source |
|------|--------|--------|--------|-------------|
| **Baseline** | GPT 5.2 Medium | Claude Sonnet 4.6 | Gemini 2.5 Flash | Kimi K2.5 |
| **Recommended** | GPT 5.4 | Claude Opus 4.6 | Gemini 3.1 Pro | Kimi K2.6 |

Recommendations:
- **GPT 5.4** — best overall balance of tool competence and design taste
- **Claude Opus 4.6** — strongest tool use, but final designs can feel formulaic
- **Gemini 3.1 Pro** — solid middle ground; GPT 5.4 currently edges it
- **Kimi K2.6** — cheapest model that delivers a good experience

### How to set up Vibma?

**Option 1: Clone and build (DRAGME.md)**
```bash
git clone https://github.com/ufira-ai/vibma.git
```

**Option 2: Install from npm (CARRYME.md)**
- No cloning required
- Zero setup

**Option 3: Quick start with your AI agent**
```
Set up Vibma so I can vibe-design in Figma.
Follow the instructions at https://raw.githubusercontent.com/ufira-ai/vibma/refs/heads/main/CARRYME.md
```

See [Docs](https://ufira-ai.github.io/Vibma/) for tool reference.

### Do I need API keys?

**Core tools work without API keys.** Optional integrations:

| Env var | Enables | How to get |
|---------|---------|------------|
| `FIGMA_API_TOKEN` | Library discovery (team components/styles) | [Figma Settings > Security > Personal access tokens](https://www.figma.com/developers/api#access-tokens) |
| `FIGMA_TEAM_ID` | Default team for library discovery | The number in `figma.com/files/team/<ID>/...` |
| `PEXELS_API_KEY` | Stock photos search and placement | [pexels.com/api/key](https://www.pexels.com/api/key/) (free) |

Figma PAT requires two scopes: **File content (Read)** and **Team library content (Read)**.

### What Figma scopes are required?

If using `FIGMA_API_TOKEN`, you need:
- **File content (Read)** — read Figma files
- **Team library content (Read)** — discover team library components and styles

See setup guides for step-by-step instructions with screenshots.

### Is Vibma free?

Yes. Vibma is open-source under **MIT License**. Free to use, modify, and distribute.

- Source code available on GitHub
- Learn and reference the architecture
- Modify for your own projects

Please read [Figma's Terms of Service](https://www.figma.com/tos/) before using Vibma.

### How to get help?

| Channel | Link |
|---------|------|
| Discord | [discord.gg/4XTedZdwV6](https://discord.gg/4XTedZdwV6) |
| GitHub Issues | [github.com/ufira-ai/vibma/issues](https://github.com/ufira-ai/vibma/issues) |

Report bugs and feature requests on GitHub Issues.

### What should I use instead of Vibma?

For production use, we recommend **Figma's native MCP integration**:
- [Figma for Agents](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)
- Follow [Figma's official updates](https://www.figma.com/blog/) for latest agent capabilities

Figma's first-party offering provides better support and future development.

### How to contribute?

Vibma is no longer under active development, but the source code remains available for:
- Learning MCP server architecture
- Reference for building Figma integrations
- Understanding AI agent tool design

You can still fork and modify for your own projects under MIT License.

---

## License

[MIT](https://github.com/ufira-ai/vibma/blob/main/LICENSE)
