# Vibma Workflow

Work with the tool in a predictable sequence: read before writing, create parents before children, verify after mutations.

## Build Order

1. `connection.create` → `connection.get` to verify
2. Inspect existing structure: `document.get`, `variables.list`, `styles.list`, `components.list`
3. Create design tokens: variable collections → variables → text styles → effect styles
4. Create components from tokens
5. Assemble screens from component instances
6. Verify with `lint.check` and `frames.export`

## Parent-First Rule

Create parent containers before children. Dependent creates must be sequential — never parallelize when the child needs the parent ID.

## Component Creation

Build components early — they are the building blocks for screens. A component IS a frame: create it directly with layout properties, then add children.

- Use `components.create(type: "component")` with properties for TEXT, BOOLEAN, INSTANCE_SWAP
- TEXT properties auto-bind to child text nodes with matching names
- Group related components into variant sets with `components.create(type: "variant_set")` for state dimensions (Style, Size, State)
- Use flat components (not variant sets) for INSTANCE_SWAP slots like icons or avatars
- Assemble screens from `instances.create`, not by cloning frames

## Placement Rule

Always pass `x` and `y` for top-level nodes and clones. Do not stack everything at `0,0`.

## Instance Rule

Call `components.get` or `instances.get` to discover property keys (including `#suffix`) before setting overrides. Do not guess property names.

## Verify After Mutations

`"ok"` means the write succeeded, not that the result is correct. Read back the node after clone, swap, mode pinning, or large batch updates.
