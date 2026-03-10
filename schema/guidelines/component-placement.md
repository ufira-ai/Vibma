# Component Placement

Reusable components should be easy to inspect without interrupting review of final screens.

## Core Principle

Component masters belong in a clearly defined support zone, not mixed into the primary product canvas.

- final outputs tell the story
- component masters support the story
- experiments should not compete with either

## Placement Rule

Place component masters and staging frames in a dedicated area.

Recommended pattern:

- final screens in the primary review zone
- component stages in a separate section below or beside the screens
- experiments isolated or removed

Do not scatter masters across the page root.

## Stage Rule

Create stages by category.

Examples:

- `Button Stage`
- `Input Stage`
- `Navigation Stage`
- `Card Stage`
- `Table Stage`

Each stage should hold only closely related components.

## Alignment Rule

Component areas should be arranged as deliberately as screens.

- align stages on a shared row or column
- use consistent gaps
- give each stage a clear title
- avoid mixed scales in the same stage

If the component area looks like leftovers, review quality drops.

## Distance Rule

Keep components close enough to be discoverable, but far enough away to avoid confusion with final output.

Good:

- a section directly below the screens
- a library zone to the right of the screens

Bad:

- component masters between two review screens
- staging frames mixed into a final mockup row

## Example Rule

Keep examples and masters separate when possible.

- masters show the reusable source
- example instances show real usage

The reviewer should be able to tell which is which at a glance.

## Checklist

Before considering component placement done, verify:

1. Are component masters grouped in a dedicated zone?
2. Are stages named clearly?
3. Are final screens visually separate from component sources?
4. Can a reviewer inspect the component area without losing the review flow?
5. Are stray masters or experiments left at the page root?

If the answer to any of these is no, the canvas needs another organization pass.

## Figma and Vibma Notes

When working through Vibma:

- create a component section before creating many masters
- place stages with explicit `x` and `y`
- keep stage widths and gaps consistent
- convert source nodes in place inside the stage area
- delete failed attempts instead of leaving them around the page

Component placement is successful when reviewers can find the library quickly without mistaking it for final output.
