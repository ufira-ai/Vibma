# Vibma Workflow

Vibma is powerful enough for serious design work, but weaker models need explicit operating rules to avoid preventable mistakes.

## Core Principle

Work with the tool in a predictable sequence.

- read before writing
- create parents before children
- verify after significant mutations

## Session Rule

Confirm the connection before doing anything substantial.

- ensure the channel is joined
- confirm the current page and document
- treat a reset session as normal, not exceptional

If the channel is missing, reconnect first.

## Read-Before-Write Rule

Inspect existing pages, components, variables, and styles before creating new ones.

Do not guess:

- existing token names
- component property names
- page structure
- current selection

Guessing is one of the fastest ways to create duplicate systems or invalid overrides.

## Parent-First Rule

Always create parent containers before dependent children.

Good:

- create section
- create frame in section
- create child stacks in frame
- create text inside the stacks

Bad:

- create parent and child in parallel when the child depends on the parent id

Dependent creates should not be parallelized.

## Batch Rule

Batch independent operations, but chunk large writes.

- keep large updates in manageable groups
- verify after big batches
- do not assume a very large batch will be accepted

If a write affects many nodes, chunk it intentionally.

## Placement Rule

Always pass `x` and `y` for top-level nodes and clones.

- sections need explicit placement
- screen roots need explicit placement
- clones need explicit new placement

Do not accept `0,0` stacking as a neutral default.

## Layout Update Rule

For layout sizing updates, prefer the explicit layout payload.

Examples:

- `layout.layoutSizingHorizontal`
- `layout.layoutSizingVertical`
- `layout.itemSpacing`

Do not assume that a top-level shortcut field changed the actual node just because the write returned `ok`.

## Instance Rule

Inspect component properties before bulk overrides.

- verify property names
- verify variant dimensions
- override through instance properties, not detached edits

If a property name is unclear, inspect first.

## Verification Rule

After important operations, check the result directly:

- after clone
- after swap
- after explicit mode pinning
- after large layout refactors
- after token-binding passes

Successful writes are not enough. Read back the node.

## Cleanup Rule

If a dependent operation fails:

- clean stray nodes
- remove root-level leftovers
- do not leave failed attempts on the page

Mess from failed writes compounds quickly.

## Checklist

Before considering a Vibma task done, verify:

1. Was the session connected and verified?
2. Did you read the existing structure before writing?
3. Were parents created before children?
4. Were large writes chunked reasonably?
5. Were top-level nodes placed intentionally?
6. Were important mutations verified by reading back the node?

If the answer to any of these is no, the workflow is too fragile.

Weaker models improve significantly when Vibma is treated as a disciplined build system instead of a free-form drawing surface.
