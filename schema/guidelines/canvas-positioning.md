# Canvas Positioning

Top-level frame placement is part of the design quality, not an implementation detail.

If multiple root frames are created at `0,0`, the result is harder to review, harder to compare, and easier to misread as unfinished work.

## Core Principle

Every top-level frame, section, and stage area must be intentionally placed on the canvas.

- Root nodes should not overlap by default.
- Final output should be readable from the canvas without opening the layer panel.
- Review flow should be visible in the spatial layout.

`x` and `y` are required for top-level composition.

## Root Placement Rule

Never create a top-level frame, section, or stage area without explicit `x` and `y`.

Bad:

- multiple mockups created at `0,0`
- component stage dropped on top of final screens
- cloned artboards left at the source position

Good:

- each root node has planned placement
- sibling screens are aligned on a shared row or column
- support material is placed in a separate zone

## Reviewer-First Layout

The canvas should present work in review order.

Recommended zones:

- top-left: final outputs
- below final outputs: component stage or supporting assets
- off to the side: experiments only if they are intentionally preserved

Recommended reading patterns:

- left to right for sibling screens
- top to bottom for stages or supporting material

A reviewer should understand what to look at first from position alone.

## Positioning System

Use a simple deterministic grid for top-level placement.

Suggested defaults:

- page margin: `80`
- section start: `x: 80`, `y: 80`
- screen gap: `80` to `120`
- section gap: `120` to `160`
- stage area placed below outputs, not mixed among them

Example:

- Screen 1: `x = 140`, `y = 180`
- Screen 2: `x = 140 + screenWidth + 80`
- Screen 3: `x = 140 + 2 * (screenWidth + 80)`

Use formulas, not guesswork.

## Section Rule

Create sections before screens when the page contains multiple artifacts.

- sections define the review zones
- screens live inside the final-output section
- components live inside a dedicated component section
- experiments should be deleted or isolated

Do not rely on raw frame placement alone when the page has multiple purposes.

## Cloning Rule

When cloning a frame for a new mockup:

- always provide new `x` and `y`
- never leave the clone at the original coordinates
- treat clone placement as part of the operation, not a later cleanup

If the clone is meant to be compared to the source, place it in a predictable adjacent position.

## Component Stage Rule

Component masters and staging frames should not interrupt product review.

- keep them on a separate row or section
- align them consistently
- use clear names
- do not scatter them around the page root

The component area is support material, not the primary story.

## No Root Chaos

Avoid these patterns:

- orphan text nodes at the page root
- stray failed-attempt frames
- partially overlapping screens
- mixed final and draft work in the same row
- invisible spatial logic

If root nodes cannot be understood at a glance, the canvas is not reviewer-friendly.

## Verification Checklist

Before considering the canvas organized, verify:

1. Are all top-level frames and sections placed with explicit `x` and `y`?
2. Does the canvas show a clear reading order?
3. Are final outputs separated from components and experiments?
4. Can a reviewer compare sibling screens without panning unpredictably?
5. Are clones placed intentionally instead of stacked on the source?
6. Are there any leftover root nodes that should be deleted?

If the answer to any of these is no, the page layout is unfinished.

## Figma and Vibma Notes

When working through Vibma:

- always pass `x` and `y` on top-level `frames.create`, `pages.create` follow-up layout, and `frames.clone`
- use sections to define review zones early
- keep a consistent gap system across top-level artifacts
- verify placement after batch operations, especially after cloning
- treat `0,0` as a sign that placement was skipped, not as a neutral default

Canvas organization is part of communication quality. A good design on a messy canvas is still harder to review than it should be.
