# Responsive Sizing

Agents consistently get FIXED/FILL/HUG wrong. This is the mental model.

## The Rule

- **FIXED** — layout boundaries: page shell, sidebar width, modal max-width
- **FILL** — children that adapt to parent: main content area, nav stacks, cards in columns, text that should wrap
- **HUG** — content-sized leaves only: icons, badges, pills, button labels

Never use HUG on structural containers. Never use FIXED on a child inside auto-layout just because it looked right at one width.

## Component Sizing

Components describe behavior, not specimen dimensions. The component root should work with `FILL` when placed in a parent. Don't bake a specific pixel width into a reusable component.

Example sidebar item:
- Instance: `FILL` in parent nav stack
- Icon child: fixed 18x18
- Label child: `FILL`
- Badge child: `HUG`

## Text Sizing

- Body text inside containers: `FILL` width, `HUG` height (auto-wraps)
- Single-line labels: `FILL` horizontal (truncates if needed)
- Standalone headings: `HUG` is fine

Inside auto-layout parents, text defaults to `FILL` horizontal + `HUG` vertical + `textAutoResize: HEIGHT`. Override only when needed.
