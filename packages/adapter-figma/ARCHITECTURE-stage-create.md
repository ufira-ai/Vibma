# Two-Path Authoring Model: Create / Stage / Commit

## Context
Vibma has a structural opinion engine (inline-tree.ts) that resolves incomplete tree input into concrete Figma layout. This design separates deterministic inferences (always applied silently) from material ambiguity (requires agent review via staging).

## Core Concept: Inference Confidence

Each rule in the opinion engine is tagged:

| Confidence | Definition | Examples |
|---|---|---|
| **deterministic** | One obvious Vibma rule applies. Applied silently on all paths. | Fixed-size parent + FILL children → promote to AL; FIXED without dim on cross → FILL; padding → infer VERTICAL; FIXED without dim on primary → HUG |
| **ambiguous** | Multiple structurally different plausible trees. Triggers staging. | FILL vs FIXED choice; inventing a width constraint; container vs decoration role; HUG parent + FILL child (who constrains?) |
| **conflict** | Contradictory signals — always reject. | FILL + explicit dimension; explicit NONE + FILL/HUG children |

## Create Behavior (auto mode, default)

`create` applies all deterministic inferences silently and succeeds. If any ambiguous inference is needed, it auto-stages instead of failing.

### No ambiguity → direct create
```
frames(method:"create", type:"auto_layout", items:[{
  name: "Card", width: 320, height: 200, fillColor: "#FFF",
  children: [{type:"text", text:"Title", layoutSizingHorizontal:"FILL"}]
}])

→ {
  status: "created",
  results: [{ id: "1:234" }],
  correctedPayload: { ... full payload with all inferences applied ... },
  warnings: [...]
}
```

Deterministic inferences (like promoting layoutMode, inferring layoutSizingVertical:"HUG") are applied silently. `correctedPayload` teaches the agent the fully-specified form for next time.

### Ambiguity detected → auto-stage
```
frames(method:"create", type:"frame", items:[{
  name: "Card", fillColor: "#FFF",
  children: [{type:"text", text:"Title", layoutSizingHorizontal:"FILL"}]
}])

→ {
  status: "staged",
  results: [{ id: "1:234" }],
  diff: "Card\n- layoutMode: (not set)\n+ layoutMode: \"VERTICAL\"  # ambiguous: no dimensions, container size unknown\n\nCard > Title\n- layoutSizingVertical: (not set)\n+ layoutSizingVertical: \"HUG\"  # primary axis default",
  correctedPayload: {
    "name": "Card",
    "layoutMode": "VERTICAL",
    "fillColor": "#FFF",
    "children": [{ "type": "text", "text": "Title", "layoutSizingHorizontal": "FILL", "layoutSizingVertical": "HUG" }]
  },
  warnings: [...]
}
```

- `diff`: git-style string showing only the ambiguous decisions Vibma made. Agent scans to verify intent.
- `correctedPayload`: the exact payload that would pass through create with zero inferences. Agent can use this verbatim next time.
- The staged node is materialized in Figma (in a stage container on the same page) for visual review.

## Three Methods

### `create` (tier: create) — default, auto behavior
- Applies deterministic inferences silently → creates directly
- If ambiguous inference needed → auto-stages
- Response discriminated: `status: "created"` vs `status: "staged"`
- Always returns `correctedPayload` — teaches the fully-specified form
- Staged response additionally includes `diff` (ambiguous decisions only)

### `stage` (tier: create) — explicit staging
- Forces all trees through staging, even if fully deterministic
- Same response shape as auto-staged: `status: "staged"` + `diff` + `correctedPayload`
- For agents that want to preview before committing, regardless of ambiguity

### `commit` (tier: create, NOT edit)
- Takes staged node ID + target parentId, x, y
- Unwraps node from stage container into the real target
- No re-inference — exact staged tree is committed
- Returns `status: "created"` + `{ id }` at final location
- **Tier: create** — critical for access tier safety

## Stage Container Design

**Problem (from audit)**: Staging on a separate page breaks the review guarantee — parent-context-dependent sizing (HUG+FILL, cross-axis inference) will reflow when reparented to a different context.

**Solution**: Stage containers live on the **same page**, near the target location. The stage container mimics the target context:
- If `parentId` is provided at stage/create time: inspect the target parent's constraints (layoutMode, sizing, width/height)
- Create a staging frame with equivalent constraints: width and height normalized to FIXED (if parent was FILL, resolve to current pixel value)
- Build the staged tree inside this container
- On `commit`: reparent children from stage container into the real target parent, remove stage container

Stage container naming: `[STAGED] {name}` — visually distinct in Figma's layer panel.

## Response Shape

```ts
// Direct create (no ambiguity)
{
  status: "created",
  results: [{ id: string }],
  correctedPayload: object,       // exact payload that would pass with zero inferences
  warnings?: string[]
}

// Staged (ambiguity detected, or explicit stage call)
{
  status: "staged",
  results: [{ id: string }],       // staged node ID
  diff: string,                    // git-style diff of ambiguous decisions only
  correctedPayload: object,        // exact payload with all inferences applied
  warnings?: string[]
}
```

## Diff Format

Only ambiguous decisions appear in the diff. Deterministic inferences are silent (but reflected in `correctedPayload`).

```
Card
- layoutMode: (not set)
+ layoutMode: "VERTICAL"          # no dimensions — container size unknown

Card > Title
- layoutSizingHorizontal: "FILL"
+ layoutSizingHorizontal: "FILL"  # HUG parent + FILL child — siblings determine width
```

Unchanged fields are omitted. The `#` comment is the reason for the ambiguous decision. Path uses `>` separator matching the Figma layer hierarchy.

## Access Tier Safety

| Action | Tier | Why |
|---|---|---|
| create (auto) | create | Produces new nodes, may auto-stage |
| stage | create | Produces new nodes in stage container |
| commit | create | Moves staged nodes to target (specialized create) |
| update (patch staged) | edit | Modifying existing nodes |
| delete (discard stage) | edit | Removing nodes |

Create-only agents can: create → auto-stage → review → commit (accept) or just create (if no ambiguity).
Create-only agents cannot: patch staged nodes. They'd need edit tier.

## Opinion Engine Refactor

### inline-tree.ts changes

```ts
interface Inference {
  path: string;                              // "Card > Title"
  field: string;                             // "layoutMode"
  from: any;                                 // original value (undefined if missing)
  to: any;                                   // resolved value
  confidence: "deterministic" | "ambiguous";
  reason: string;
}

function validateAndFixInlineChildren(
  parentParams: any,
  hints: Hint[],
): { hasAmbiguity: boolean; inferences: Inference[] }
```

Each rule is tagged. The function always applies all fixes (deterministic and ambiguous). The caller decides what to do based on `hasAmbiguity`:
- `create`: if `hasAmbiguity` → stage; else → create directly
- `stage`: always stage regardless

### Confidence classification

| Rule | Confidence | Rationale |
|---|---|---|
| Fixed-size parent + FILL children → promote to AL | deterministic | width+height = container, children need AL |
| AL params present → infer VERTICAL | deterministic | padding/spacing only makes sense with AL |
| FIXED without dim on cross-axis → FILL | deterministic | One obvious cross-axis behavior |
| FIXED without dim on primary-axis → HUG | deterministic | One obvious primary-axis behavior |
| No dims, no layoutMode + children need AL → promote | ambiguous | Container size unknown |
| HUG parent + FILL child | ambiguous | Multiple plausible trees |

### Diff generation

```ts
function formatDiff(inferences: Inference[]): string {
  // Group by path, filter to ambiguous only, format as git-style diff
  const ambiguous = inferences.filter(i => i.confidence === "ambiguous");
  // ... format
}
```

### Corrected payload generation

```ts
function buildCorrectedPayload(originalParams: any): object {
  // After validateAndFixInlineChildren mutates params in-place,
  // deep-clone the mutated params = correctedPayload
  // Strip internal fields (_skipOverlapCheck, etc.)
}
```

## Implementation Phases

### Phase 1: Confidence tagging (inline-tree.ts)
- Add `Inference` type, tag each rule
- `validateAndFixInlineChildren` returns `{ hasAmbiguity, inferences }`
- Add `formatDiff()` and `buildCorrectedPayload()` helpers
- Current create path unchanged (ignores the return value for now)

### Phase 2: Auto-stage on create
- `createSingleFrame` / `createComponentSingle` check `hasAmbiguity`
- If ambiguous: create in stage container, return `{ status: "staged", diff, correctedPayload }`
- If not: create directly, return `{ status: "created", correctedPayload }`
- Stage container: create sibling frame `[STAGED] {name}` with target context constraints

### Phase 3: Stage + commit methods
- `stage`: force-stage path (same as auto-stage but always stages)
- `commit`: unwrap from stage container into target parent
- Schema (frames.yaml, components.yaml) + registry

### Key Files
1. `packages/adapter-figma/src/handlers/inline-tree.ts` — confidence tags, Inference, formatDiff, buildCorrectedPayload
2. `packages/adapter-figma/src/handlers/create-frame.ts` — auto-stage logic in createSingleFrame
3. `packages/adapter-figma/src/handlers/components.ts` — auto-stage logic in createComponentSingle
4. **New**: `packages/adapter-figma/src/handlers/stage.ts` — stage + commit handlers
5. `packages/adapter-figma/src/handlers/registry.ts` — register new handlers
6. `schema/tools/frames.yaml` — stage, commit method definitions
7. `schema/tools/components.yaml` — stage, commit method definitions
