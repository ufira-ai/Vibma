# Changelog

## 1.0.0 (upcoming)

Changes from `v0.3.2` to current.

### What This Means for Designers

- Better token discipline. Agents are much better at using your design tokens consistently. Beyond colors, Vibma now helps agents apply variables and styles for spacing, border radius, and strokes, which leads to cleaner and more maintainable design files.
- Stronger responsive design awareness. Agents are more likely to create layouts that adapt well to different container sizes, with better use of auto layout, sizing, and structure that holds up across screen sizes.
- Prototyping support. You can now ask agents to build interactive prototypes, not just static screens.
- Higher-quality components. Agents are more likely to create reusable components with proper properties, and to bind those properties to text and other editable content so components are easier to work with later.
- Faster variable creation. Vibma is much faster at bootstrapping variable collections, which makes setting up a new design system or token foundation quicker.
- Built-in help and design guidance for AI agents. Vibma now includes endpoint-level help plus a dedicated `guidelines` tool for design-system and structural guidance, so agents are less likely to get stuck, cheaper models can use Vibma more effectively, and compatibility across models is better. UI taste is still the hard part: structure is much better, but strong visual design still depends on the model.

### Breaking Changes

- MCP tools were consolidated into REST-style endpoint tools. Clients using older standalone tools such as `create_frame`, `create_text`, `node_info`, `patch_nodes`, and similar commands must migrate to endpoint calls with `method` dispatch.
- Node and resource APIs were normalized around shared conventions like `get`, `list`, `create`, `update`, `delete`, `clone`, `reparent`, `fields`, `depth`, `offset`, and `limit`.
- Update payloads were flattened and several resource identifiers were normalized so APIs now accept both IDs and names in more places.
- Schema generation is now part of the tooling model. When changing or adding tools, the YAML schema and generated artifacts must stay in sync.

### Added

- **Endpoint-based MCP surface.** Related operations grouped under endpoint tools (`frames`, `text`, `styles`, `variables`, `components`, `instances`, `connection`, etc.) instead of a large flat tool list.
- **Schema-driven tool contracts.** YAML definitions generate help text, parameter guards, prompts, response interfaces, and docs from a single source of truth.
- **Standalone tools:** `guidelines` for design-system guidance, `version_history` for named snapshots, `prototyping` for interaction/prototype operations.
- **Help surface.** Endpoint-level `method: "help"` support across all endpoints with generated content from the schema.
- **Inline children on create.** `frames.create`, `components.create`, and `components.create(type:"variant_set")` accept a `children` array to build nested trees in a single call. Supported child types: `text`, `frame`, `instance`, `component`.
- **Component property auto-binding.** Inline text children with `componentPropertyName` auto-create and bind TEXT properties. Inline instance children with `componentPropertyName` auto-create and bind INSTANCE_SWAP properties.
- **Inline variant set creation.** `variant_set` accepts `children` with `{type:"component"}` entries as an alternative to `componentIds`. Validates consistent child structure across variants.
- **Clone with `name` param.** All endpoints support `name` on clone — required when cloning a variant into its component set to avoid duplicate name corruption.
- **Batch operations.** Clone and `prototyping.add` accept `items` arrays for batch operations with per-item error isolation.
- **Contextual instance sizing.** `instances.create` accepts `sizing:"contextual"` to infer FILL/HUG from parent layout context. Opt-in, backward compatible.
- **Component tree inspection.** `components.get` accepts `depth` and `verbose` — returns full node tree with component properties merged. Without depth, returns property summary only.
- **Lint and structural checks:** overlapping children, unbounded hug, hug cross-axis, overflow-parent (with context-aware fix messages), text HUG checks, fixed-in-autolayout (with HUG-parent and decorative-element exclusions), runtime warnings for structural problems.
- **Token and variable capabilities:** document-level variable collections, query-based variable lookups, scope-aware auto-binding, canonical fills/strokes handling.
- **Design guidelines:** responsive sizing (top-down workflow, HUG/HUG anti-patterns), wrapping layouts (`layoutWrap` constraints and patterns), component structure (variant clone workflow), token discipline, library components, vibma workflow.
- **UX improvements:** welcome/best-practices message on `connection.create`, `VIBMA_SERVER` environment variable support, package-level architecture docs.

### Changed

- **Smart sizing defaults.** `applySizing` infers HUG/FILL from context (parent layout direction, node type) when no explicit sizing or dimensions are given. Frames default to HUG (shrink to content) instead of FIXED 100×100.
- **`layoutMode` inference on create.** Detects auto-layout intent from padding, spacing, alignment, or HUG sizing params and infers `VERTICAL` with a hint.
- **Resilient update path.** `update-frame` auto-promotes to auto-layout when layout properties are set without `layoutMode`, warns instead of throwing on non-layout node types, auto-enables `layoutWrap:"WRAP"` when `counterAxisSpacing` is set, and rejects `WRAP` on vertical layouts with a clear error.
- **CHANGE_TO destination validation.** `prototyping.add` with `navigation:"CHANGE_TO"` validates the destination is a variant (COMPONENT inside COMPONENT_SET) instead of requiring a top-level frame.
- **Text sizing dispatch.** `text.update` with `layoutSizingHorizontal`/`layoutSizingVertical` routes through the text handler correctly instead of being rejected by the layout handler.
- **Overflow-parent lint.** Checks actual bounding dimensions (not just FIXED children). Fix messages are context-aware based on parent sizing mode (FILL → suggest scroll or ancestor resize, FIXED → suggest increasing size).
- **Type normalization for inline children.** Fixes common agent mistakes: lowercase normalization, type inference from fields, `id` → `componentId` aliasing.
- **Duplicate `componentPropertyName` handling.** Uses `keysBefore`/`keysAfter` pattern to capture exact Figma-assigned keys, avoiding prefix-match collisions.
- **Hardcoded color hint batching.** Multiple hardcoded color warnings consolidated into a single summary.
- **Plugin UI** redesigned and rebranded.
- **Help, docs, and prompt text** generated from schema definitions instead of maintained manually.
- **Node serialization** unified, including library-opaque serialization and component catalog improvements.
- **Registry deduplication.** Clone, delete, reparent, and audit adapters extracted into shared helpers — single source of truth.

### Fixed

- **Clone-variant corruption prevention.** Cloning a component into its parent component set without renaming silently corrupted the set. Now pre-validated with an actionable error.
- **Clone preserves property bindings.** `componentPropertyReferences` (TEXT and INSTANCE_SWAP) re-applied after cloning a variant into a component set — Figma drops them during the operation.
- **`npx @ufira/vibma` direct invocation.** Added scoped bin entry so `npx` resolves correctly.
- **Partial success on invalid inline children.** Invalid child types were silently skipped, leaving empty parent frames. Now handled by type normalization and inference.
- **`nodeIds` + `children` on auto_layout.** Rejected with a clear error instead of silently dropping children.
- **Audit adapter missing params.** `frames.audit` and `text.audit` were not forwarding `minSeverity` and `skipInstances`.
- Multiple audit and lint defects, including dead handlers, warning quality, and instruction clarity.
- Variable collection handling bugs, especially around `collectionName`, duplicate reporting, and multi-mode workflows.
- Sizing defaults and component audit/lint edge cases.
- Font color alias normalization in inline child creation.
- `version_history.save` now returns the actual saved version ID.

### Upgrade Notes

- Restart MCP clients after upgrading server-side code. The Figma plugin auto-reloads after build, but the stdio MCP server does not hot-reload.
- After reconnecting, re-create the relay channel with `connection(method: "create")` and verify with `connection(method: "get")`.
- If you maintain prompts, scripts, or tests against Vibma tools, update them for the endpoint-style API before moving from `0.3.2`.
