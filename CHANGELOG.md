# Changelog

## 1.0.0-rc2 - 2026-03-18

### Added

- **Inline children on create.** `frames.create`, `components.create`, and `components.create(type:"variant_set")` now accept a `children` array to build nested trees in a single call. Supported child types: `text`, `frame`, `instance`, `component`.
- **Component property auto-binding.** Inline text children with `componentPropertyName` auto-create and bind TEXT properties. Inline instance children with `componentPropertyName` auto-create and bind INSTANCE_SWAP properties (resolves variant components for the default value).
- **Inline variant set creation.** `variant_set` accepts `children` with `{type:"component"}` entries as an alternative to `componentIds`. Validates that all variants share the same child structure and rejects non-component types.
- **Type normalization for inline children.** `normalizeInlineChildTypes` fixes common agent mistakes: lowercase normalization (`"TEXT"` → `"text"`), type inference from fields (`{text:"hello"}` → text, `{componentId:"1:2"}` → instance), and `id` → `componentId` aliasing.
- **`$ref` shared definitions** for inline children descriptions (`inlineChildren`, `inlineChildrenComponent`, `inlineVariants`) in `schema/refs/common.yaml` — single source of truth across frames, components, and variant set schemas.

### Changed

- **Smart sizing defaults.** `applySizing` infers HUG/FILL from context (parent layout direction, node type) when no explicit sizing or dimensions are given. Empty HUG frames resize to 1px instead of sitting at Figma's 100×100 default.
- **`layoutMode` inference on create.** `resolveLayoutMode` detects auto-layout intent from padding, spacing, alignment, or HUG sizing params and infers `VERTICAL` with a hint. Explicit `layoutMode:"NONE"` without width+height is rejected with an actionable error.
- **Resilient update path.** `update-frame` auto-promotes to auto-layout when layout properties are set without `layoutMode`, warns instead of throwing on non-layout node types, and auto-enables `layoutWrap:"WRAP"` when `counterAxisSpacing` is set.
- **Resilient create path.** `counterAxisSpacing` on create now auto-enables WRAP (matching update behavior) instead of silently dropping the value.
- **Hardcoded color hint batching.** Multiple hardcoded color warnings are consolidated into a single summary with all colors listed.
- **Width/height docs updated.** Frame param descriptions now say "omit to shrink-to-content via HUG" instead of "default: 100".
- **Duplicate `componentPropertyName` handling.** Uses `keysBefore`/`keysAfter` pattern to capture the actual Figma-assigned key, avoiding prefix-match collisions when multiple children share the same property name.

### Fixed

- **Partial success on invalid inline children.** Previously, invalid child types (missing `type`, uppercase `type`, wrong `componentId` field) were silently skipped, leaving empty parent frames. Now handled by type normalization and inference.
- **`npx @ufira/vibma` direct invocation.** Added scoped bin entry `"@ufira/vibma"` so `npx` resolves the package correctly without requiring `--package` flag.
- **`nodeIds` + `children` on auto_layout.** Now rejected with a clear error instead of silently dropping children.
- **Variant set `children` + `componentIds` mutual exclusion.** Rejected with an actionable error message.

## 1.0.0 - 2026-03-17

Prepared from `v0.3.2..HEAD` for the `1.0.0` release line.

### What This Means for Designers

- Better token discipline. Agents are much better at using your design tokens consistently. Beyond colors, Vibma now helps agents apply variables and styles for spacing, border radius, and strokes, which leads to cleaner and more maintainable design files.
- Stronger responsive design awareness. Agents are more likely to create layouts that adapt well to different container sizes, with better use of auto layout, sizing, and structure that holds up across screen sizes.
- Prototyping support. You can now ask agents to build interactive prototypes, not just static screens.
- Higher-quality components. Agents are more likely to create reusable components with proper properties, and to bind those properties to text and other editable content so components are easier to work with later.
- Faster variable creation. Vibma is much faster at bootstrapping variable collections, which makes setting up a new design system or token foundation quicker.
- Built-in help and design guidance for AI agents. Vibma now includes endpoint-level help plus a dedicated `guidelines` tool for design-system and structural guidance, so agents are less likely to get stuck, cheaper models can use Vibma more effectively, and compatibility across models is better. UI taste is still the hard part: structure is much better, but strong visual design still depends on the model.

Summary:
- 37 commits since `v0.3.2`
- 136 files changed
- 14,299 insertions, 3,823 deletions

### Highlights

- Vibma now exposes a cleaner endpoint-based MCP surface instead of a large flat tool list. Related operations are grouped under endpoint tools such as `frames`, `text`, `styles`, `variables`, `components`, `instances`, and `connection`.
- Tool contracts are now schema-driven. YAML definitions generate help text, parameter guards, prompts, response interfaces, and docs from a single source of truth.
- Design guardrails are substantially stronger. Linting, audit feedback, token binding, and contrast reporting were expanded to catch more structural mistakes before designers have to clean them up manually.
- The platform added new capabilities for version history, design guidelines, prototyping, component catalog workflows, and document-level token management.
- Agents can now self-serve better with built-in endpoint help and the `guidelines` tool, which reduces tool-use friction and improves compatibility with smaller or less capable models.

### Breaking Changes

- MCP tools were consolidated into REST-style endpoint tools. Clients using older standalone tools such as `create_frame`, `create_text`, `node_info`, `patch_nodes`, and similar commands must migrate to endpoint calls with `method` dispatch.
- Node and resource APIs were normalized around shared conventions like `get`, `list`, `create`, `update`, `delete`, `clone`, `reparent`, `fields`, `depth`, `offset`, and `limit`.
- Update payloads were flattened and several resource identifiers were normalized so APIs now accept both IDs and names in more places.
- Schema generation is now part of the tooling model. When changing or adding tools, the YAML schema and generated artifacts must stay in sync.

### Added

- New standalone tools:
  - `guidelines` for design-system and structural guidance
  - `version_history` for saving named snapshots to the Figma file history
  - `prototyping` for interaction/prototype operations
- New help surface:
  - endpoint-level `method: "help"` support across Vibma endpoints
  - generated help content from the schema source of truth
- New schema/codegen pipeline for:
  - generated tool defs
  - generated help content
  - generated response types
  - generated parameter guard sets
- New lint and structural checks:
  - overlapping children
  - unbounded hug
  - hug cross-axis issues
  - text HUG checks
  - runtime warnings for structural problems
- New token and variable capabilities:
  - document-level variable collections
  - query-based variable lookups
  - scope-aware auto-binding
  - canonical fills/strokes handling
- New UX and operational improvements:
  - welcome/best-practices message on `connection.create`
  - `VIBMA_SERVER` environment variable support
  - package-level architecture docs in `AGENTS.md`
  - MCP audit support

### Changed

- Plugin UI was redesigned and rebranded.
- Help, docs, and prompt text are now generated from schema definitions instead of being maintained manually.
- Node serialization was unified, including library-opaque serialization behavior and component catalog improvements.
- Instance behavior improved through inheritance handling and broader alias normalization.
- Contrast warnings now surface token names more clearly and reduce noise on already-bound surface pairs.
- Relay version mismatch messaging was improved to better guide plugin updates.

### Fixed

- Multiple audit and lint defects, including dead handlers, warning quality, and instruction clarity.
- Variable collection handling bugs, especially around `collectionName`, duplicate reporting, and multi-mode workflows.
- Rollback behavior for orphan styles and shapes.
- Sizing defaults and component audit/lint edge cases.
- Font color alias normalization in inline child creation.
- `version_history.save` now returns the actual saved version ID.
- Create/serialize regressions related to newer tool surface changes.

### Upgrade Notes

- Restart MCP clients after upgrading server-side code. The Figma plugin auto-reloads after build, but the stdio MCP server does not hot-reload.
- After reconnecting, re-create the relay channel with `connection(method: "create")` and verify with `connection(method: "get")`.
- If you maintain prompts, scripts, or tests against Vibma tools, update them for the endpoint-style API before moving from `0.3.2`.
