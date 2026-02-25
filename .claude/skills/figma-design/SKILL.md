---
name: figma-design
description: >
  Build and edit Figma designs using TalkToFigma MCP tools. Covers design systems,
  components, variants, tokens, auto-layout, and page composition. Use when the user
  asks to create, modify, or explore designs directly in Figma via the TalkToFigma MCP
  plugin — e.g., "build a button component in Figma", "set up a design system",
  "create a color palette", "add variants to this component", "explore this Figma file",
  or any task involving the TalkToFigma MCP tools (create_frame, create_component,
  set_fill_color, etc.).
---

# Figma Design with TalkToFigma MCP

## Hard Rules (Non-Negotiable)

1. **Frames only** — Never use Groups for layout. Every structural container = Frame.
2. **Auto-layout mandatory** — Any frame with 2+ children must have auto-layout. Absolute positioning is forbidden unless explicitly needed (floating badge, tooltip).
3. **Explicit sizing** — Every node inside auto-layout needs `layoutSizingHorizontal` and `layoutSizingVertical` (HUG, FILL, or FIXED). FIXED is discouraged for responsive layouts. `create_text` and `create_frame` accept these directly — no separate `set_layout_sizing` call needed.
4. **No raw values** — Never inject raw hex colors or arbitrary spacing numbers. Inventory existing styles/variables first (`get_styles`, `get_local_variables`). Only create new ones if nothing matches.
5. **Apply what you create** — After creating paint/text/effect styles, USE them via `apply_style_to_node`. Styles that aren't applied to any nodes are wasted. For text, pass `textStyleId` directly to `create_text`.
6. **Component-first** — If building 2+ similar elements, create ONE as Frame, convert to component, instantiate copies. Check `get_local_components` before creating.
7. **Transparent layout frames** — Layout-only frames (rows, columns, wrappers) must have NO FILL. Only surface frames (cards, modals) get fills. Dark theme failure mode: root dark + intermediate white = invisible text.
8. **Contrast validation** — Do NOT trust screenshots for contrast. Programmatically trace text fill -> walk up parent chain -> find first opaque ancestor -> compare. Both light-on-light and dark-on-dark = broken.
9. **Colors are 0-1** — Figma uses normalized 0-1 RGB, not 0-255. Convert: `hex / 255`. Example: #007AFF = `{ r: 0, g: 0.478, b: 1 }`.

## Connection & Setup

```
join_channel(channel: "channel-id")     <- provided by user or Figma plugin UI
get_current_page()                      <- ALWAYS start here (safe entry point)
```

**Never** start with `get_document_info` on an unfamiliar file — may have unloaded pages.

## Read Before Write

Before creating anything, understand the existing file. This prevents duplicating styles, mismatching naming, and breaking patterns.

### Exploration toolkit (ordered by scope)

| Scope | Tool | Purpose |
|-------|------|---------|
| Document | `get_current_page` | Current page + top-level children (safe) |
| Document | `get_pages` | All pages with child counts |
| Page | `set_current_page(pageName: "...")` | Switch page (case-insensitive partial match) |
| Page | `search_nodes(query, types, limit)` | Find nodes by name/type |
| Node | `get_node_info(nodeId, depth: 0)` | Node + child stubs (names/types only) |
| Node | `get_node_info(nodeId, depth: 1)` | Node + direct children fully detailed |
| Tokens | `get_styles` | All paint/text/effect/grid styles |
| Tokens | `get_local_variable_collections` | Variable collections |
| Tokens | `get_local_variables` | Variables (names, IDs, types) |
| Components | `get_local_components(setsOnly: true)` | Component sets only (not individual variants) |
| Fonts | `get_available_fonts(query: "Inter")` | Check fonts before creating text styles |

### Depth parameter strategy

- `depth: 0` — Node + child stubs (name, type, ID). Best for scanning.
- `depth: 1` — Node + direct children with full details.
- `depth: 2` — Two levels. Use for component internals.
- `depth: -1` — Unlimited. **Avoid on large nodes** — can overflow context.

Start with `depth: 0`, drill into specific children with `depth: 1`.

## Coordinate System

Figma uses **relative coordinates** for children inside frames/components/sections.

**Critical rule**: `move_node` x/y values are RELATIVE to the parent, not the page.

```
# The absoluteBoundingBox from get_node_info gives page-level coords.
# To compute correct relative position:
child_relative_x = child_absoluteBoundingBox.x - parent_absoluteBoundingBox.x
child_relative_y = child_absoluteBoundingBox.y - parent_absoluteBoundingBox.y
```

After `insert_child`, the node retains old coordinates — always follow with `move_node` or use auto-layout parent (preferred).

**Best practice**: Let auto-layout handle positioning. Eliminates all coordinate math.

## Auto-Layout Essentials

```
# Create an auto-layout frame (x/y/width/height all optional, default: 0/0/100/100)
# Frames and components default to transparent (no fill) and 0 padding.
# FILL sizing works at creation when parentId points to an auto-layout frame.
create_frame(
  name: "Button Row", parentId: "container-id",
  layoutMode: "HORIZONTAL", itemSpacing: 16,
  paddingTop: 12, paddingBottom: 12, paddingLeft: 16, paddingRight: 16,
  counterAxisAlignItems: "CENTER",
  layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG"
)

# Text nodes accept layoutSizing directly — no follow-up set_layout_sizing needed.
# FILL automatically sets textAutoResize to HEIGHT (prevents 0px width bug).
create_text(
  text: "Hello", parentId: "auto-layout-frame-id",
  fontSize: 14, layoutSizingHorizontal: "FILL"
)

# Wrap existing nodes (replaces create_frame + set_layout_mode + insert_child x N)
create_auto_layout(
  nodeIds: ["node-1", "node-2"], name: "Row",
  layoutMode: "HORIZONTAL", itemSpacing: 16,
  layoutSizingHorizontal: "HUG", layoutSizingVertical: "HUG"
)
```

### Sizing modes

| Mode | Behavior | Valid On |
|------|----------|----------|
| `HUG` | Shrink-wrap to fit children | Auto-layout frames, text nodes |
| `FILL` | Stretch to fill parent's space | Children of auto-layout frames |
| `FIXED` | Exact pixel dimensions | Any node |

### Auto-layout tools

| Tool | Purpose |
|------|---------|
| `set_layout_mode` | HORIZONTAL, VERTICAL, or NONE |
| `set_item_spacing` | Gap between children (px) |
| `set_padding` | Inner padding (top, bottom, left, right) |
| `set_axis_align` | Primary: MIN/CENTER/MAX/SPACE_BETWEEN; Counter: MIN/CENTER/MAX |
| `set_layout_sizing` | HUG, FILL, FIXED per axis |

### Page structure pattern

```
Page
  Section "Buttons" (no auto-layout — sections can't have it)
    Frame "Buttons Content" (VERTICAL auto-layout, HUG both axes)
      Text "Push Button" (heading)
      Component Set "Push Button" (the variants)
```

## Context Management

Figma files can be enormous (187K+ chars for `get_local_components` on large files).

1. **Depth control**: Start `depth: 0`, drill with `depth: 1`. Never `depth: -1` on large nodes.
2. **Filtering**: `get_local_components(setsOnly: true)` = 17x reduction.
3. **Pagination**: `limit: 20, offset: 0` on list tools and `search_nodes`.
4. **List/Get split**: List tools return summaries -> use detail tools on specific items (`get_style_by_id`, `get_variable_by_id`, `get_component_by_id`).
5. **Search over scan**: `search_nodes(query: "Button", types: ["COMPONENT_SET"])` instead of traversing the tree.

## Naming Conventions

- **Pages**: Clear category, capitalized (`Buttons`, `Text Fields`)
- **Components**: PascalCase (`Push Button`, `Switch`)
- **Variants**: `Property=Value` format (`Style=Default, State=Idle`)
- **Internal/sub-components**: `_` prefix (`_Button Icon`)
- **Styles**: Slash-separated (`Materials/Thick`, `Heading/Large Title`)
- **Variables**: Slash-separated (`color/background/primary`, `size/spacing/md`)

## Visual Verification

```
export_node_as_image(nodeId, format: "PNG", scale: 1)    <- actual size
export_node_as_image(nodeId, format: "PNG", scale: 2)    <- retina (small components)
export_node_as_image(nodeId, format: "PNG", scale: 0.5)  <- overview (large pages)
```

Check: children inside bounds, text not truncated, spacing consistent, colors correct, alignment.

Navigate to show work: `zoom_into_view(nodeIds: [...])` or `set_focus(nodeId)`.

## Reference Guides

- **Tokens, variables, styles**: See [references/tokens-and-styles.md](references/tokens-and-styles.md) — variable collections, bindings, paint/text/effect styles
- **Components, variants, instances**: See [references/components.md](references/components.md) — creation strategies, variant naming, icons, SVG, boolean ops, composition
- **Common pitfalls**: See [references/pitfalls.md](references/pitfalls.md) — 10 documented pitfalls with solutions
- **Workflow recipes**: See [references/recipes.md](references/recipes.md) — design system from scratch, adding components, exploring files, batch updates, tool quick reference
