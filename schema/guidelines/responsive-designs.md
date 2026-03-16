# Responsive Sizing

## FIXED / FILL / HUG

- **FIXED** — layout boundaries: page shell, sidebar width, modal max-width
- **FILL** — children that adapt to parent: main content area, nav stacks, cards in columns, text that should wrap
- **HUG** — content-sized leaves only: icons, badges, pills, button labels

## Component Sizing

Component roots use `FILL` when placed in a parent — they adapt to context, not a fixed specimen width.

Example sidebar item:
- Instance: `FILL` in parent nav stack
- Icon child: fixed 18x18
- Label child: `FILL`
- Badge child: `HUG`

## Text Sizing

- Body text inside containers: `FILL` width, `HUG` height (auto-wraps)
- Single-line labels: `FILL` horizontal (truncates if needed)
- Standalone headings: `HUG` is fine

Inside auto-layout parents, text defaults to `FILL` horizontal + `HUG` vertical + `textAutoResize: HEIGHT`.
