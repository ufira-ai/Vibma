# Accessibility Baseline

Accessibility is not a polish pass. It is part of the minimum acceptable quality.

## Core Principle

The default output should be usable, legible, and operable without special pleading.

## Color Contrast

Meet at least AA contrast for normal UI text.

- body text should have sufficient contrast against its background
- muted text can be softer, but still readable
- semantic surfaces should not hide labels or metadata

Do not use subtlety as an excuse for unreadable UI.

## Non-Text Contrast

Interactive or meaningful boundaries should still be visible.

- inputs should look like inputs
- selected items should read as selected
- cards and panels should separate clearly enough from the background

If a reviewer has to squint to understand hierarchy, contrast is too weak.

## Touch Target And Control Size

Interactive controls should respect practical target size.

- aim for at least `44x44`
- do not create tiny pills or buttons that only look clickable

Compact UI still needs usable targets.

## Labeling Rule

Do not rely on color alone.

- warnings need text or icon support
- states should have a label, not just a fill change
- icons that carry meaning should have text support unless the pattern is universally obvious

## Text Hierarchy

Readable hierarchy requires:

- clear title sizes
- readable body text
- supporting copy that is visibly secondary but still legible

If hierarchy depends only on tiny font size changes, it is too weak.

## Form Rule

Inputs should provide:

- clear label
- visible field boundary
- helper or error text when needed

Do not hide critical form meaning in placeholder text alone.

## Checklist

Before considering accessibility acceptable, verify:

1. Does body text meet practical contrast expectations?
2. Are interactive boundaries visible enough?
3. Are controls large enough to use?
4. Are status and state communicated by more than color?
5. Are labels and helpers present where needed?

If the answer to any of these is no, the design is not ready.

## Figma and Vibma Notes

When working through Vibma:

- run focused contrast lint
- review dark and light modes separately
- check both text contrast and practical non-text visibility
- do not stop at zero hardcoded colors; that is not the same as accessibility

An accessible baseline is the floor, not the stretch goal.
