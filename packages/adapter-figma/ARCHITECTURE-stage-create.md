# Two-Path Authoring Model: Create / Commit

## Context
Vibma has a structural opinion engine (inline-tree.ts) that resolves incomplete tree input into concrete Figma layout. This design separates deterministic inferences (always applied silently) from material ambiguity (triggers per-item staging with a diff and corrected payload for agent learning).

## Inference Confidence

| Confidence | Definition | Examples |
|---|---|---|
| **deterministic** | One obvious Vibma rule. Applied silently on all paths. | Fixed-size parent + FILL children → promote to AL; FIXED without dim on cross → FILL; padding → infer VERTICAL |
| **ambiguous** | Multiple structurally different plausible trees. Triggers staging. | Inventing a width constraint; container vs decoration; HUG parent + FILL child |
| **conflict** | Contradictory. Always reject. | FILL + explicit dimension; explicit NONE + FILL/HUG children |

## Methods

### `create` (tier: create) — auto behavior
- Applies deterministic inferences silently
- Per-item: if ambiguous → auto-stage that item; if deterministic-only → create directly
- Mixed batches: each item independently resolves to `created` or `staged`
- `correctedPayload` returned only on staged items (not on successful direct creates unless opt-in via `returnPayload: true`)

### `commit` (tier: edit)
- Takes staged node ID — commits to the parentId captured at stage time
- No fresh parentId allowed — commit is locked to the original target context
- Unwraps from stage container into the real target parent
- Returns `{ status: "created", id }`
- Edit-tier because only edit-tier agents materialize stages

Note: an explicit `stage` method (force-preview regardless of ambiguity) is deferred for v1. Auto on create covers the learning path. No stage schema work in v1.

## Response Shape

### Per-item in batch results

```ts
// Direct create (no ambiguity, or deterministic-only)
{ id: string, status: "created" }

// Staged — edit-tier agents only
{
  id: string,                     // staged node ID
  status: "staged",
  diff: string,                   // git-style, ambiguous decisions only
  correctedPayload: object        // authoring-schema payload, zero-inference form
}

// Rejected for ambiguity — create-tier agents (no staging)
// IMPORTANT: returned as a structured result object, NOT thrown.
// batchHandler collapses thrown errors to { error: string }, which loses
// the learning payload. The per-item handler must return this directly.
{
  error: string,                  // description of ambiguous decisions
  diff: string,                   // same diff format — teaches what was ambiguous
  correctedPayload: object        // agent can re-call create with this payload
}

// Rejected for conflict — all tiers (thrown, collapsed by batchHandler)
{ error: string }
```

**Contract note**: The per-item result union (`created | staged | ambiguity-rejected | error`) extends beyond the standard Vibma batch-create contract (`{ id }` only). This endpoint needs a custom response schema — it should not be treated as a normal batch-create response by the compiler or endpoint typing.

### Batch envelope

```ts
{
  results: Array<CreatedResult | StagedResult | ErrorResult>,
  warnings?: string[]             // standard batch warnings (tokens, styles, etc.)
}
```

### Opt-in correctedPayload on direct creates

```
frames(method:"create", ..., returnPayload: true)

→ results: [{ id: "1:234", status: "created", correctedPayload: {...} }]
```

Only for agents that want to learn even when the create succeeded. Not returned by default to keep response size minimal.

## Diff Format

Only ambiguous decisions. Deterministic inferences are silent.

```
Card
- layoutMode: (not set)
+ layoutMode: "VERTICAL"          # no dimensions — container size unknown

Card > Title
- layoutSizingHorizontal: "FILL"
+ layoutSizingHorizontal: "FILL"  # HUG parent + FILL child — siblings determine width
```

Path uses `>` separator. `#` comment is the reason. Unchanged fields omitted.

## correctedPayload

The corrected payload is in the **authoring schema** — what the agent sends to the MCP, not internal form. Captured after `validateAndFixInlineChildren` mutates params but **before** `setupFrameNode`'s alias expansion, padding shorthand normalization, and fill/stroke resolution.

This means: if the agent passes `correctedPayload` back to `create`, it arrives in the same form and goes through the same pipeline — but with zero inferences needed.

Internal fields (`_skipOverlapCheck`, etc.) are stripped.

## Stage Container

Staged nodes live on the **same page** as the target, in a sibling stage container that mimics the target's constraints.

### Stage flow
1. Inspect target parent (from `parentId`): read its layoutMode, sizing, width/height
2. Create `[STAGED] {name}` frame nearby with equivalent fixed constraints
3. Build the tree inside the stage container
4. Return staged node ID

### Commit flow
1. Lookup staged node — validate it's in a `[STAGED]` container
2. Reparent children into the **original** target parent (captured at stage time)
3. Remove the stage container
4. Return final node ID

### Context fidelity
- Stage container normalizes parent sizing to FIXED pixel values (if parent was FILL, resolve to current dimensions)
- Commit is locked to the original parentId — no re-targeting
- If the target parent was resized between stage and commit, the committed tree may reflow. This is acceptable — the agent reviewed the layout at stage time, and any parent changes are external.

## Access Tier Safety

| Action | Tier | Behavior |
|---|---|---|
| create (auto, no ambiguity) | create | Direct create |
| create (auto, ambiguous) | create | Reject with diff + correctedPayload |
| create (auto, ambiguous) | edit | Auto-stage, return `{ status: "staged", diff, correctedPayload }` |
| commit | edit | Accept staged tree into original target |
| update (patch staged) | edit | Modify staged nodes |
| delete (discard stage) | edit | Remove staged nodes |

**Edit-tier agents**: ambiguous → auto-stage → patch → commit.
**Create-tier agents**: ambiguous → reject with `{ error, diff, correctedPayload }`. Agent re-calls create with corrected payload. No staging materialized — create-only agents learn from the error response.

## Opinion Engine Changes

### inline-tree.ts

```ts
interface Inference {
  path: string;                              // "Card > Title"
  field: string;                             // "layoutMode"
  from: any;                                 // original value
  to: any;                                   // resolved value
  confidence: "deterministic" | "ambiguous";
  reason: string;
}

function validateAndFixInlineChildren(
  parentParams: any,
  hints: Hint[],
): { hasAmbiguity: boolean; inferences: Inference[] }
```

Always applies all fixes. Returns `hasAmbiguity` flag — caller decides whether to stage or create.

### Confidence classification

| Rule | Confidence |
|---|---|
| Fixed-size parent + FILL children → promote to AL | deterministic |
| AL params present → infer VERTICAL | deterministic |
| FIXED without dim on cross-axis → FILL | deterministic |
| FIXED without dim on primary-axis → HUG | deterministic |
| No dims, no layoutMode + children need AL → promote | ambiguous |
| HUG parent + FILL child | ambiguous |

### Helpers

```ts
function formatDiff(inferences: Inference[]): string
// Filter to ambiguous, format as git-style diff

function buildCorrectedPayload(mutatedParams: any): object
// Deep clone mutated params, strip internal fields
// Snapshot BEFORE setupFrameNode alias/shorthand expansion
```

## Implementation Phases

### Phase 1: Confidence tagging
- Tag each rule in `validateInlineTree` with confidence
- Return `{ hasAmbiguity, inferences }` from `validateAndFixInlineChildren`
- Add `formatDiff()` and `buildCorrectedPayload()`
- Current create path: ignore return value (no behavior change yet)

### Phase 2: Auto-stage on create
- `createSingleFrame` / `createComponentSingle` check `hasAmbiguity`
- Ambiguous: create stage container, build tree inside, return `{ status: "staged", diff, correctedPayload }`
- Not ambiguous: create directly, return `{ status: "created", id }`
- `returnPayload: true` opt-in for correctedPayload on direct creates
- batchHandler already handles per-item isolation — each item independently created or staged

### Phase 3: Commit method
- `commit`: unwrap from stage container, locked to original parentId
- Schema (frames.yaml, components.yaml): add commit method (tier: edit)
- Registry: register commit handler
- Explicit `stage` method deferred for v1

### Key Files
1. `packages/adapter-figma/src/handlers/inline-tree.ts` — confidence tags, Inference, formatDiff, buildCorrectedPayload
2. `packages/adapter-figma/src/handlers/create-frame.ts` — auto-stage in createSingleFrame (edit-tier), ambiguity reject (create-tier)
3. `packages/adapter-figma/src/handlers/components.ts` — same for createComponentSingle
4. `packages/adapter-figma/src/handlers/helpers.ts` — batchHandler needs to pass through structured ambiguity-reject results (not collapse to `{ error }`)
5. **New**: `packages/adapter-figma/src/handlers/commit.ts` — commit handler
6. `packages/adapter-figma/src/handlers/registry.ts` — register commit handler
7. `schema/tools/frames.yaml` — commit method (tier: edit)
8. `schema/tools/components.yaml` — commit method (tier: edit)
