# Responsive Sizing

## Workflow: Top-Down Sizing

Build layouts from the outside in:

1. **Set the container first.** Every container needs an explicit width — either `width` + `layoutSizingHorizontal:"FIXED"` for shells and bounded panels, or `layoutSizingHorizontal:"FILL"` inside an auto-layout parent. Set `layoutMode` (VERTICAL or HORIZONTAL) and spacing/padding.
2. **Children fill the container.** Use `layoutSizingHorizontal:"FILL"` on children so they stretch to the available space. Use `layoutSizingVertical:"HUG"` so height follows content.
3. **Only leaves use HUG on both axes.** Buttons, badges, icons — elements with short, predictable content that should shrink-wrap.

This ensures every level of the tree has a clear width constraint. Text wraps, FILL children stretch, and the layout adapts when the container resizes.

Always set BOTH axes explicitly on every node. Omitting sizing leads to unintended defaults.

## FIXED / FILL / HUG

- **FIXED** — explicit bounded widths: page shell, sidebar, modal max-width, specimen frames
- **FILL** — children that adapt to parent: cards, rows, panels, nav stacks, text that should wrap. Use `minWidth`/`maxWidth` for responsive constraints.
- **HUG** — content-sized leaves only: icons, badges, pills, button labels

## Anti-patterns: HUG/HUG

HUG on both axes is the most common cause of broken layouts. It means "shrink to fit my content on both axes" — the container has no opinion about its own size and collapses to whatever its children measure.

**Why HUG/HUG breaks designs:**

1. **Text never wraps.** A HUG-width container grows to fit the longest text line. Body text becomes a single very long line instead of wrapping at a readable width. The design looks correct with short placeholder text but breaks with real content.

2. **Layouts don't adapt.** HUG/HUG containers ignore their parent's width. A card inside a responsive column won't stretch to fill available space — it stays at its content width, leaving gaps or overflowing.

3. **FILL children become under-constrained.** A child with `layoutSizingHorizontal:"FILL"` inside a HUG-width parent has no space to fill — the parent defers its width to its children, but the FILL child defers its width to the parent. The result is under-constrained sizing that produces unpredictable or collapsed layouts.

4. **Cascading failures.** One HUG/HUG container at the top of a tree forces every child to resolve its own width. The entire layout becomes rigid and content-dependent instead of responsive.

**HUG/HUG is only correct for:**
- Buttons, pills, badges, chips — intrinsically-sized leaf elements with short, predictable content
- Icon containers with fixed-size children
- Inline tags and status indicators

**For everything else, set at least one axis to FIXED or FILL:**
- Cards, panels, list rows → `layoutSizingHorizontal:"FILL"`, vertical `HUG`. Add `minWidth`/`maxWidth` for responsive bounds.
- Shells, sidebars, modals → `width` + `layoutSizingHorizontal:"FIXED"`, vertical `FILL` or `HUG`
- Full-width sections → `layoutSizingHorizontal:"FILL"`, `layoutSizingVertical:"HUG"`

## Wrapping Layouts (layoutWrap)

`layoutWrap: WRAP` enables children to flow into new rows when they exceed the container width — like CSS `flex-wrap`. This only works with **HORIZONTAL** auto-layout. Figma does not support wrap on VERTICAL layouts.

**When to use wrap:**
- Card grids with a fixed number of columns at a known width
- Tag/chip collections where items flow into multiple rows
- Any layout where items should reflow based on available width

**Horizontal wrap pattern:**
```
frames.create(type: "auto_layout", layoutMode: "HORIZONTAL", layoutWrap: "WRAP",
  itemSpacing: "space/16", counterAxisSpacing: "space/16")
```
Children use FIXED width to control column count. `counterAxisSpacing` sets the gap between wrapped rows.

**Vertical grid alternative:**
Since VERTICAL layouts cannot wrap, build column-based grids by nesting VERTICAL columns inside a HORIZONTAL parent:
```
outer (HORIZONTAL, itemSpacing: 20, FILL width)
  col-1 (VERTICAL, FILL width, HUG height, itemSpacing: 20)
  col-2 (VERTICAL, FILL width, HUG height, itemSpacing: 20)
  col-3 (VERTICAL, FILL width, HUG height, itemSpacing: 20)
```
Each column gets equal width via FILL. Reparent items into columns for column-first ordering. This handles variable card heights per column independently.

## Component Sizing

Component roots use `FILL` when placed in a parent — they adapt to context, not a fixed specimen width. Use `FIXED` only for the specimen (the component definition itself when it needs a specific preview width).

Example sidebar item:
- Instance: `FILL` in parent nav stack
- Icon child: fixed 18x18
- Label child: `FILL`
- Badge child: `HUG`

## Text Sizing

- Body text inside containers: prefer `FILL` width, `HUG` height (auto-wraps)
- Single-line labels: prefer `FILL` horizontal (truncates if needed)
- Standalone headings: `HUG` is fine

Inside auto-layout parents, target `layoutSizingHorizontal:"FILL"` + `layoutSizingVertical:"HUG"` + `textAutoResize:"HEIGHT"` for text that should wrap. These are not auto-applied — set them explicitly on text.create or text.update.

## Checklist

Before finalizing a layout, verify:
1. No container with text has HUG on the horizontal axis (unless it's a button/badge)
2. Children use FILL on the axis that should absorb available space — not blindly on both axes. Compact controls in horizontal rows often stay HUG vertically.
3. Top-level containers have an explicit width (FIXED) or stretch to their parent (FILL)
4. Run `lint(method:"check", nodeId:"<rootId>", rules:["composition"])` to catch overflow-parent, unbounded-hug, and fixed-in-autolayout issues
