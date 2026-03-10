# Auto-Layout And Constraints

Most UI should be auto-layout first. Manual positioning is the exception.

## Core Principle

Containers should describe relationships, not frozen coordinates.

- use auto-layout for UI structure
- use constraints only where non-auto-layout behavior is intentional
- avoid absolute positioning for normal product UI

## Default Rule

If a frame contains UI content, it should usually be auto-layout.

Typical auto-layout containers:

- page shells
- sidebars
- topbars
- forms
- cards
- rows
- stacks
- panels

If a frame is only being used as a visual box with manually placed children, it is probably under-structured.

## Sizing Rule

Use sizing intentionally:

- `FIXED` for shell boundaries and true fixed dimensions
- `FILL` for structural children that should adapt to the parent
- `HUG` for content-sized leaves and compact groups

Do not use `FIXED` on a child inside auto-layout just because it looked right once.

## Alignment Rule

Use the parent layout to create alignment.

- use padding instead of manual offsets
- use item spacing instead of visual guessing
- use `SPACE_BETWEEN` only when the layout meaningfully calls for it

If alignment depends on manual nudging, the structure is weak.

## Common Patterns

Sidebar shell:

- sidebar width: `FIXED`
- main content: `FILL`

Topbar:

- shell width: `FILL`
- title group: `HUG` or `FILL` depending on content
- action group: `HUG`

Card list:

- list stack: `FILL`
- card: `FILL`
- internal content uses vertical stacks

Form:

- field stack: `FILL`
- label and helper text wrap within the field width
- buttons usually sit in a separate action row

## Absolute Positioning Rule

Use absolute positioning sparingly.

Good uses:

- decorative backgrounds
- overlays inside a controlled component
- badges or markers intentionally anchored in a card corner

Bad uses:

- normal labels, buttons, fields, and rows
- screen layout that should respond to width or content changes

## Constraint Rule

Constraints matter when a node is inside a non-auto-layout parent.

Use them intentionally for:

- scalable hero art
- anchored decoration
- special overlays

Do not rely on constraints to replace missing auto-layout structure.

## Checklist

Before considering layout done, verify:

1. Are all main UI containers auto-layout?
2. Are padding and spacing defined by layout, not eyeballing?
3. Are structural children using `FILL` where appropriate?
4. Is absolute positioning limited to deliberate exceptions?
5. Does the layout survive content changes and parent resizing?

If the answer to any of these is no, the layout is not robust enough.

## Figma and Vibma Notes

When updating layout through Vibma:

- prefer layout properties on frames instead of manual `x` and `y` for internal UI
- use nested `layout` patches for sizing and spacing updates
- remember that `FILL` only works for children inside an auto-layout parent
- verify after large batch updates because a successful write is not always enough by itself

Good auto-layout makes the design easier to review, easier to resize, and easier to fix.
