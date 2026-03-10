# Verification And Cleanup

Work is not done when the shapes exist. It is done when the file is verified and the canvas is clean.

## Core Principle

Every delivery should end with checks and cleanup.

- verify behavior
- verify structure
- verify token usage
- remove noise

## Required Checks

Run the checks that matter for the artifact:

- hardcoded color check
- text style check
- contrast check
- responsive resize check
- theme or mode check when multiple modes exist
- component reuse check

Do not assume the file is clean because creation calls succeeded.

## Responsive Check

Resize a meaningful parent and verify:

- children fill correctly
- labels wrap or truncate intentionally
- sibling areas rebalance correctly

If the design breaks during a basic resize test, it is not complete.

## Theme Check

If the file supports multiple modes:

- verify on identical structure
- check key screens in both modes
- confirm semantic bindings, not just visual similarity

## Canvas Cleanup

Remove or isolate:

- orphan root nodes
- failed attempts
- overlapping drafts
- unused staging fragments
- leftover clones from experiments

A clean page is easier to review and safer to extend.

## Naming Cleanup

Before finishing:

- remove default names
- improve bad property names
- clean obvious stale text names when practical

Do not leave the file in a “works, but messy” state if cleanup is straightforward.

## Checklist

Before considering the task done, verify:

1. Do key lint checks pass?
2. Have you resized at least one important parent container?
3. Have you verified theme behavior when relevant?
4. Are components reused instead of cloned?
5. Is the page root free of stray nodes and failed attempts?

If the answer to any of these is no, the task is not closed.

## Figma and Vibma Notes

When working through Vibma:

- use focused lint rules instead of only a giant all-rules pass
- verify after clone, swap, and large batch updates
- inspect the page root before finishing
- delete stray nodes created by failed dependent operations

Verification is what turns generation into deliverable work.
