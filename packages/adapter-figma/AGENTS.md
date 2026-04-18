# Figma Adapter (packages/adapter-figma)

## Batch Handler Pattern

All batch operations use `batchHandler` from `src/handlers/helpers.ts`:

```typescript
async function myBatch(params: any) {
  const ctx = await prep(params);         // batch-level setup (fonts, styles, etc.)
  return batchHandler(params, (item) => single(item, ctx));
}
```

`batchHandler` provides:
- Per-item try/catch → `{error: "message"}` (one failure doesn't abort the batch)
- Depth enrichment → if `depth` param present and result has `id`, merges node snapshot
- Warning hoisting → per-item `warning` fields move to batch-level `warnings[]`, deduplicated
- `{}` → `"ok"` conversion for readability
- Progress reporting for batches > 3 items (extends MCP timeout from 30s to 60s)

## Response Design

- **Batch creates** return `{id}` per item — the only novel info
- **Batch mutations** return `"ok"` — batchHandler converts `{}` → `"ok"`
- **Don't return parent state per batch item** — it's redundant and stale by the next item
- **Warnings** are hoisted to batch level and deduplicated
- **`depth` param** on create tools: if provided, merges a node snapshot into the `{id}` result
- **Max response size**: 50K chars (~12K tokens). Exceeding returns `_error: "response_too_large"` with hints

## Agent Guidance in Responses

- **Error messages list available options** — when a style/variable name isn't found, return available names so the agent can self-correct
- **Warn on misuse, don't block** — if an agent hardcodes a color that matches a style, emit a warning. Don't fail the operation.
- **Auto-bind colors** — when a hardcoded color matches a variable/style, automatically bind it and emit a confirmation warning
- **Fix instructions in lint results** must reference current tool names

**Warnings are the product.** Every warning (hardcoded color, missing auto-layout, unbound token) represents a structural issue a designer would have to fix manually. Following warnings reduces noise from the MCP and produces well-structured design systems that designers enjoy working with.

## Command Dispatch

`src/handlers/registry.ts` maps every `"{endpoint}.{method}"` command to a handler function:
- **Dispatcher-based**: styles, components, variables use `createDispatcher()` — a single handler routes by method
- **Alias-based**: frames, text translate endpoint params and delegate to shared handlers (node-info, patch-nodes, modify-node)

## Endpoint Consistency

- New discriminant branches added under an existing endpoint must preserve that endpoint's normal validation path. If the endpoint's other create variants use generated guard key sets with `batchHandler(..., { keys, help })`, the new branch should too.
- Contextual create paths must reject invalid parent targets explicitly. Do not silently fall back to a different parent when `parentId` resolves to a node that cannot contain children or is outside the intended ownership context.
