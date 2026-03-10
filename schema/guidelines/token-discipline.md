# Token Discipline

Tokens are the system. Screens and components should consume them, not compete with them.

## Core Principle

Define reusable design decisions once, then bind UI to those decisions everywhere.

- variables are the source of truth
- styles are optional convenience layers
- hardcoded values are exceptions, not defaults

## What Must Be Tokenized

Tokenize any value that is part of the design language:

- colors
- spacing
- radius
- stroke width
- opacity when reused
- key layout dimensions
- typography styles

Do not hardcode production UI values for these unless there is a clear reason.

## Semantic Naming

Prefer semantic token names over literal ones.

Good:

- `bg/canvas`
- `surface/raised`
- `text/default`
- `border/strong`
- `brand/solid`

Less useful:

- `green-500`
- `gray-light-2`
- `card-beige`

Semantic names survive theme changes and product growth better.

## Source of Truth Rule

Use variables as the main source of truth for reusable values.

- bind fills and strokes to color variables
- bind radius and spacing to numeric variables where supported
- use text styles for reusable typography systems

Paint styles are allowed as convenience or library references, but they should not replace the token layer.

## Build Order

Use this order:

1. create variable collections and modes
2. create semantic variables
3. create text styles and optional paint styles
4. bind components to tokens
5. assemble screens from token-bound components

If screens come before tokens, the system usually ends up partially hardcoded.

## Theme Verification

Theme support should be verified on identical structure.

Recommended method:

- build one surface
- clone it
- pin the clone to a different variable mode
- verify that the same components invert correctly

Do not rebuild the same screen twice if the goal is mode verification.

## Hardcoded Value Rule

Hardcoded values are acceptable only when one of these is true:

- the value is one-off and intentionally not part of the system
- the tooling cannot bind the property yet
- the value is purely temporary during exploration

If a hardcoded value remains in final UI, it should be a conscious exception.

## Checklist

Before considering token work done, verify:

1. Are the main colors variable-bound?
2. Are text styles used consistently?
3. Are spacing and radius tokenized where the tool supports it?
4. Are semantic names used instead of literal color names?
5. Can the theme be validated by switching modes on identical structure?

If the design changes require editing many nodes directly, the token layer is not strong enough.

## Figma and Vibma Notes

When working through Vibma:

- use `fillVariableName` and `strokeVariableName` for color
- use numeric variable bindings where available, such as radius and spacing
- pin theme modes with `explicitMode: { collectionId, modeId }`
- run lint for hardcoded colors after assembly
- if a property cannot yet be bound cleanly, document the exception

Token discipline is successful when a theme or system update changes the UI through bindings, not through manual repainting.
