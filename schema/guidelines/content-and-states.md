# Content And States

A polished layout with unrealistic content or missing states is still incomplete.

## Core Principle

Use realistic content and show the states that matter for the product.

- content should feel product-like
- states should reflect actual usage
- default-only design is rarely enough

## Content Rule

Avoid placeholder content in final review work.

Prefer:

- plausible product names
- realistic labels
- short but credible descriptions
- believable owners, counts, dates, and statuses

Avoid:

- lorem ipsum
- repeated identical cards
- empty labels used only to satisfy layout

Weak content makes strong structure harder to evaluate.

## State Rule

Each key component should show the minimum meaningful state coverage.

Examples:

- button: primary and at least one alternate state
- nav item: default and active
- input: default and error or active
- badge: neutral and semantic status
- queue row: normal and at least one high-priority state through content or tone

Do not show only the clean happy path when the product clearly depends on state changes.

## Screen Rule

Each screen should communicate a concrete scenario.

Examples:

- overview screen with live metrics
- review screen with blockers
- pipeline screen with scheduling pressure

If the screen has no scenario, it becomes a generic layout demo instead of a useful mockup.

## Empty And Edge Cases

Not every page needs every state, but the design system should prove it can handle:

- empty lists
- long labels
- errors
- warnings
- blocked states
- disabled actions

At least one of these should usually appear in component or example coverage.

## Copy Discipline

Good UI copy is:

- short
- specific
- scannable
- role-appropriate

Avoid clever filler text that looks polished but explains nothing.

## Checklist

Before considering content and state coverage done, verify:

1. Does the screen show a believable scenario?
2. Are repeated elements differentiated with real content?
3. Do the key components show the states they need?
4. Is there evidence the system can handle warnings, blockers, or errors?
5. Would a reviewer learn product behavior from the examples?

If the answer to any of these is no, the work is too shallow.

## Figma and Vibma Notes

When working through Vibma:

- use instance overrides for realistic content
- avoid detached copies just to change text
- inspect property names before large override passes
- clean obvious stale layer names when the tool allows it

A strong mockup communicates both structure and product reality.
