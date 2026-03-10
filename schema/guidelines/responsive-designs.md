# Responsive Designs

Responsiveness is the default for web-facing design. A layout is not considered complete if it only works at the specimen width it was first drawn at.

## Core Principle

Set layout from the top down.

- Parent containers define structure and available space.
- Children adapt to the parent.
- Do not let container width be determined by child content unless that is the explicit goal.

In practice:

- structural frames are usually `FIXED` or token-driven at the shell level
- container children usually use `FILL`
- leaf content can use `HUG`

## Sizing Rules

Use `FIXED` when the element is a layout boundary:

- page frame
- app shell
- sidebar width
- topbar height
- modal max width

Use `FILL` when the element should respond to its parent:

- main content next to a sidebar
- navigation stacks inside a sidebar
- cards inside responsive columns
- component instances placed inside layout containers
- text blocks that should wrap within the container

Use `HUG` only when the element is content-sized by intent:

- icon
- badge pill
- count chip
- button label
- small metadata cluster
- branding lockup

Avoid using `HUG` on structural containers.

## Component Rule

Do not encode specimen width into a reusable component unless the component is truly fixed-size.

Bad:

- a sidebar item component created at `1270px` wide, then resized down in instances

Good:

- the sidebar item defines internal layout behavior
- the instance uses `FILL` in its parent nav stack
- icon stays fixed
- label fills remaining space
- count pill hugs content

The component should describe behavior, not just preserve the dimensions of the first mockup it was drawn in.

## Sidebar Example

Recommended sidebar pattern:

- `Sidebar`: `FIXED` width
- `Main Column`: `FILL`
- `Primary Nav`: `FILL`
- `Sidebar Item` instance: `FILL`
- item left cluster: `FILL`
- item label: `FILL` with truncation or wrapping based on product need
- item count/badge: `HUG`
- footer container: `FILL`
- footer body text: `FILL` with height auto-resize

If the sidebar width changes, the nav items and footer should follow automatically without manual resizing.

## Text Behavior

Text must be sized for the container it lives in.

- Long-form body copy should usually use fill width and grow in height.
- Single-line labels can fill horizontally and truncate when needed.
- Do not allow text to force container width unless the component is intentionally content-sized.

## Design Review Checks

Before considering a layout done, verify:

1. If the parent gets wider, do the children expand correctly?
2. If the parent gets narrower, do labels wrap or truncate intentionally?
3. Does the main content fill the remaining space after shell widths change?
4. Are there any components whose master width is just a leftover specimen size?
5. Are structural containers using `FILL` where they should, instead of fixed child widths?

If resizing one container requires hand-fixing multiple children, the structure is not responsive enough.

## Exceptions

Exceptions are valid, but should be deliberate:

- intrinsic branding marks
- chips, pills, and compact controls
- menus or popovers with content-driven sizing
- small inline metadata groups
- tightly controlled fixed-size widgets

Exception logic should stay local. It should not leak upward and dictate the size of major layout containers.

## Figma and Vibma Notes

When implementing responsive layouts in Figma through Vibma:

- set shell widths explicitly at the parent level
- prefer `layout.layoutSizingHorizontal: "FILL"` on container children
- keep leaf nodes on `HUG` or fixed size
- test by changing the parent width after assembly
- treat a successful resize test as part of verification, not as optional polish

If a component only works after instance-level resizing, the component definition is not finished.
