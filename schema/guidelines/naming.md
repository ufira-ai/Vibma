# Naming

Naming is part of the design system. Reviewers and future editors should understand the file without decoding placeholder names.

## Core Principle

Every meaningful node should be named for its role.

- names should describe purpose
- names should reduce ambiguity
- names should help both review and reuse

## Structural Naming

Use semantic names for pages, sections, frames, and groups.

Good:

- `Desktop Mockups`
- `Mockup Components`
- `Workspace Overview`
- `Primary Nav`
- `Review Queue Panel`

Bad:

- `Frame 1`
- `Group 2`
- `Rectangle 7`
- `Auto layout`

## Component Naming

Component names should describe the reusable object.

Good:

- `Button`
- `Sidebar Item`
- `Metric Tile / Default`
- `Queue Row / Default`

Variant components should use clear dimensions:

- `State=Active`
- `Style=Primary`
- `Tone=Warning`

## Property Naming

Exposed component properties must be semantic.

Good:

- `label`
- `value`
- `title`
- `description`
- `helper_text`
- `owner`
- `time`

Bad:

- property names copied from raw text content
- generated ids
- names that only make sense in one specimen

## Text Layer Naming

Use the right naming style for the situation:

- semantic names for stable structural text inside components
- content-synced names for free text only when that improves review and the tool supports clean syncing

Do not leave a component property named after the first sentence that happened to be typed into it.

## Section And Stage Naming

Canvas organization should be readable from node names.

Good:

- `Desktop Mockups`
- `Component Stage`
- `Nav Item Stage`
- `Examples`

Bad:

- `Stuff`
- `Other`
- `Copy`
- `Working Area`

## Naming Consistency

Choose one naming pattern and keep it stable.

Examples:

- title case for pages, sections, frames, and components
- lowercase snake case for text properties when useful
- consistent variant property names such as `State`, `Size`, `Style`, `Tone`

Inconsistent naming makes good structure look weaker than it is.

## Checklist

Before considering naming done, verify:

1. Are there any default names left?
2. Do component names describe reusable objects?
3. Are variant names clear and stable?
4. Are exposed properties semantic?
5. Can a reviewer understand the page from names alone?

If the answer to any of these is no, naming needs another pass.

## Figma and Vibma Notes

When working through Vibma:

- rename source nodes before converting them into components when possible
- inspect generated property names after `exposeText`
- clean up stale names after instance overrides if the workflow allows it
- do not accept successful creation as proof of good naming

Good names reduce review time and improve edit safety.
