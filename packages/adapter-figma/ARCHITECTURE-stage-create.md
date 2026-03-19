# Two-Path Authoring Model: Stage / Create / Commit / Auto

## Context
Vibma has a structural opinion engine (inline-tree.ts) that resolves incomplete tree input into concrete Figma layout. Today it's baked into create — mixing "learning" and "production" into one path. This design separates them:
- **stage**: permissive learning path — apply opinions, materialize draft, teach the agent
- **create**: strict production path — fully specified or reject
- **commit**: promote staged draft to real target
- **auto**: smart default — applies deterministic inferences directly, stages only on material ambiguity

## Core Concept: Inference Confidence

Each rule in the opinion engine is tagged:

| Confidence | Definition | Examples |
|---|---|---|
| **deterministic** | One obvious Vibma rule applies. No structural alternatives. | Fixed-size parent + FILL children → promote to AL; FIXED without dim on cross → FILL; padding → infer VERTICAL; FIXED without dim on primary → HUG |
| **material ambiguity** | Multiple structurally different plausible trees. Choosing differently would produce a meaningfully different layout. | FILL vs FIXED choice (stretch vs constrain?); inventing a width constraint; container vs decoration role; component/property structure; variant semantics; HUG parent + FILL child (who constrains?) |
| **conflict** | Contradictory signals — no valid resolution. | FILL + explicit dimension; explicit NONE + FILL/HUG children |

## Four Methods

### `stage` (tier: create)
- Applies full opinion engine — all inferences (deterministic + bold)
- Materializes on `_vibma_stage` page
- Returns `status: "staged"` + full resolved tree (depth=-1) + `inferences[]`
- Agent reviews, patches with update tools, then commits

### `create` strict (tier: create)
- Opinion engine in strict mode — rejects if ANY inference would be needed
- All-or-nothing: entire tree rejected if one node is underspecified
- Returns `status: "created"` + `{ id }` per item (standard create response)

### `commit` (tier: create, NOT edit)
- Takes staged node ID + target location (parentId, x, y)
- Moves node from `_vibma_stage` to target — no re-inference, exact staged tree
- Returns `status: "created"` + `{ id }` at new location
- **Tier: create** — critical for access tier safety (see below)

### `auto` (tier: create, future default for create)
- Applies deterministic inferences → creates directly
- If material ambiguity detected → auto-stages instead of failing
- Response discriminated: `status: "created"` vs `status: "staged"`
- Always returns `inferences[]` even on direct create — agent learns what was guessed

## Response Shape

```ts
// Direct create (strict or auto with no ambiguity)
{
  status: "created",
  results: [{ id: "1:234" }],
  inferences?: [                        // present in auto mode, absent in strict
    { node: "Card", field: "layoutMode", from: undefined, to: "VERTICAL", confidence: "deterministic", reason: "Fixed-size parent with FILL children" }
  ],
  warnings?: string[]
}

// Staged (stage or auto with material ambiguity)
{
  status: "staged",
  results: [{                            // full resolved tree, depth=-1
    id: "1:234",
    name: "Card",
    layoutMode: "VERTICAL",
    children: [{ ... }],
    ...
  }],
  inferences: [
    { node: "Card", field: "layoutMode", from: undefined, to: "VERTICAL", confidence: "deterministic", reason: "Fixed-size parent with FILL children" },
    { node: "Title", field: "layoutSizingHorizontal", from: "FILL", to: "FILL", confidence: "ambiguous", reason: "FILL inside HUG parent — siblings determine width" }
  ],
  _stagePage: "_vibma_stage",
  warnings?: string[]
}
```

## Access Tier Safety

**Problem**: A create-only session (no edit) that calls auto could get trapped — staging works (create tier) but patching the stage requires update (edit tier), and the agent can't escape.

**Solution**: `commit` is **create tier**, not edit tier. It's the counterpart to stage — both create-tier. The workflow is:

| Action | Tier | Why |
|---|---|---|
| stage | create | Produces new nodes |
| commit | create | Moves staged nodes to target (specialized create, not general edit) |
| update (patch staged) | edit | Modifying existing nodes — standard edit |
| delete (discard stage) | edit | Removing nodes — standard edit |

Create-only agents can: stage → review → commit (accept as-is) or stage → commit (blind accept).
Create-only agents cannot: stage → patch → commit. They'd need edit tier for patching.

This is correct behavior — if you need to fix Vibma's guesses, you need edit capabilities. If you trust the guesses, create-only is sufficient.

## `_vibma_stage` Page

- Created lazily on first stage call
- Last page in document, named `_vibma_stage`
- `commit` moves nodes out; `delete` cleans up
- `list` and `get` on the stage page work normally but response includes `_staged: true` flag
- Future: periodic cleanup for abandoned stages (TTL-based)

## Opinion Engine Refactor

### inline-tree.ts changes

```ts
interface Inference {
  node: string;           // node name for messages
  field: string;          // which property was inferred
  from: any;              // original value (undefined if missing)
  to: any;                // resolved value
  confidence: "deterministic" | "ambiguous";
  reason: string;
}

type OpinionMode = "permissive" | "strict" | "auto";

function validateAndFixInlineChildren(
  parentParams: any,
  hints: Hint[],
  mode: OpinionMode = "permissive",
): { staged: boolean; inferences: Inference[] }
```

Each existing rule gets a confidence tag:

| Rule | Confidence | Rationale |
|---|---|---|
| Fixed-size parent + FILL children → promote to AL | deterministic | width+height = container, children need AL |
| AL params present → infer VERTICAL | deterministic | padding/spacing only makes sense with AL |
| FIXED without dim on cross-axis → FILL | deterministic | One obvious cross-axis behavior |
| FIXED without dim on primary-axis → HUG | deterministic | One obvious primary-axis behavior |
| No dims, no layoutMode + children need AL → promote | ambiguous | Container size unknown |
| HUG parent + FILL child | ambiguous | Multiple plausible trees (set width? change FILL to HUG?) |

### Mode behavior per confidence

```ts
// In validateInlineTree, per-rule:
if (confidence === "conflict") throw new Error(...);

if (mode === "strict") throw new Error(`Strict: ${field} requires explicit value`);

// Apply the fix (all non-strict modes do this)
applyFix(raw, field, resolvedValue);
inferences.push({ node, field, from, to, confidence, reason });

if (mode === "auto" && confidence === "ambiguous") {
  staged = true;  // flag: this tree needs staging
}
```

## Implementation Phases

### Phase 1: Tag existing rules with confidence (inline-tree.ts)
- Add `Inference` type
- Each rule in `validateInlineTree` gets a confidence tag
- `validateAndFixInlineChildren` returns `{ staged, inferences }`
- Create path uses `mode: "permissive"` (current behavior, no change)

### Phase 2: Stage + commit methods
1. **`stage` handler** (`packages/adapter-figma/src/handlers/stage.ts`)
   - Ensure `_vibma_stage` page exists
   - Call `validateAndFixInlineChildren(p, hints, "permissive")`
   - Create nodes on stage page (reuse `createSingleFrame` / `createComponentSingle`)
   - Serialize full tree (depth=-1)
   - Return `{ status: "staged", results, inferences, _stagePage }`

2. **`commit` handler** (same file)
   - Lookup staged node by ID
   - Validate it's on `_vibma_stage` page
   - Reparent to target (parentId) or move to current page
   - Set x/y position
   - Return `{ status: "created", results: [{ id }] }`

3. **Schema** (frames.yaml, components.yaml)
   - Add `stage` method (tier: create, same discriminant types as create)
   - Add `commit` method (tier: create, params: id, parentId?, x?, y?)

4. **Registry** (registry.ts)
   - Register stage/commit handlers for frames and components endpoints

### Phase 3: Strict create mode
- `create` calls `validateAndFixInlineChildren(p, hints, "strict")`
- Strict mode: any inference → throw with specific message about what to specify

### Phase 4: Auto mode
- New `auto` method or mode param on create
- Calls `validateAndFixInlineChildren(p, hints, "auto")`
- If `staged === false`: create directly, return `{ status: "created", inferences }`
- If `staged === true`: redirect to stage path, return `{ status: "staged", ... }`

### Key Files
1. `packages/adapter-figma/src/handlers/inline-tree.ts` — confidence tags, Inference type, mode param
2. **New**: `packages/adapter-figma/src/handlers/stage.ts` — stage + commit handlers
3. `packages/adapter-figma/src/handlers/create-frame.ts` — pass mode to validator
4. `packages/adapter-figma/src/handlers/components.ts` — pass mode to validator
5. `packages/adapter-figma/src/handlers/registry.ts` — register new handlers
6. `schema/tools/frames.yaml` — stage, commit method definitions
7. `schema/tools/components.yaml` — stage, commit method definitions
