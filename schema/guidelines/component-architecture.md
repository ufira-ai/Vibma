# Component Architecture

Reusable UI should be built as systems, not as screenshots that happen to be reusable once.

## Core Principle

Create components for repeated behavior, not just repeated appearance.

- A good component captures structure, states, and override points.
- A bad component preserves the dimensions of the first mockup it was drawn in.

## When Something Must Be a Component

Use a component when any of these are true:

- it appears more than once on a page
- it will appear across multiple pages
- it has meaningful states
- it accepts different content in the same structure
- it should stay consistent over time

Typical examples:

- buttons
- inputs
- nav items
- cards
- table rows
- badges
- dialogs

## When to Use a Variant Set

Use a variant set when the structure is the same but the state changes.

Good variant dimensions:

- `State`: default, active, disabled, error
- `Style`: primary, secondary, ghost
- `Tone`: neutral, success, warning, danger
- `Size`: sm, md, lg

Do not use a variant set when the underlying structure meaningfully changes.

If two nodes behave differently enough that they need different internal layout, they should be separate components.

## Instance Rule

Final screens should be assembled from instances, not detached duplicates.

- build the component once
- place instances in layouts
- override content through properties
- only detach when the design intentionally stops being shared

If the screen is composed of clones instead of instances, the design is not maintainable enough.

## Internal Layout Rule

Component roots should describe behavior, not specimen size.

- the component root should usually be usable with `FILL` in context
- structural inner frames should usually use `FILL`
- content-sized leaves can use `HUG`
- fixed size should be reserved for true fixed parts like icons or small controls

Example:

- nav item root: `FILL`
- label rail: `FILL`
- label text: `FILL`
- count pill: `HUG`
- icon: fixed

## Property Rule

Exposed properties must be semantic.

Good property names:

- `label`
- `value`
- `helper_text`
- `title`
- `description`
- `meta`
- `cta`

Bad property names:

- raw text content used as property name
- generated ids
- names that only make sense in the first specimen

## State Coverage

Each important component should include the minimum states needed for product work.

Examples:

- button: default, secondary or ghost, disabled if used
- input: default, focus or active, error, disabled if used
- nav item: default and active
- badge: neutral and at least one semantic status

Do not build only the happy path if the component clearly needs states.

## Avoid Over-Varianting

Not every difference should be a variant.

Use variants for stable, repeatable state dimensions. Do not add variants for one-off content or page-specific copy.

If a difference is just text, prefer a text property.

## Verification Checklist

Before considering a component done, verify:

1. Is it used as an instance in final screens?
2. Does it support the needed states?
3. Are the exposed properties semantic?
4. Do the internals adapt to the parent instead of forcing a specimen width?
5. Is the component root reusable across multiple pages without manual repair?

If the answer to any of these is no, the component definition is incomplete.

## Figma and Vibma Notes

When building through Vibma:

- create clean source frames before converting to components
- expose text properties intentionally
- inspect property definitions before mass overrides
- use variant sets for true state dimensions
- build screens from `instances.create`, not `frames.clone`

If a component only works because each instance is manually resized or patched, the architecture is too weak.
