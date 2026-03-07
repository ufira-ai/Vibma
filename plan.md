# Design System MCP — Plan

## Overview

A design-tool-agnostic MCP that accepts TSX + Tailwind + CVA from any AI agent, compiles it to an intermediate representation, and translates it into design tool commands via adapters.

Agents know how to write HTML/TSX. Not all agents know how to work with a canvas like Figma. This MCP bridges that gap: the agent writes code it already knows, the compiler transforms it into a design-tool-agnostic IR, and the adapter translates that IR into specific design tool commands.

---

## Architecture

```
Agent (any LLM)
  |  TSX / Tailwind CSS
  v
+------------------------------------------------------+
|                    MCP Server                         |
|                                                       |
|  +------------+    +-----------------------------+    |
|  |  Compiler  |    |         Adapter              |    |
|  |  (pure,    |    |     (async, stateful)        |    |
|  |   sync)    |    |                              |    |
|  |            |    |  +----------+                |    |
|  | TSX parser |    |  | Registry | Map<name, id>  |    |
|  | Tailwind   |--IR-->|          |                |    |
|  | CVA        |    |  +----------+                |    |
|  |            |    |         |                     |    |
|  +------------+    |    resolve + apply            |    |
|       |            |         |                     |    |
|   error? stop      |    { jobId }                  |    |
|                    +----------+--------------------+    |
+----------------------|-----------------------------+
                       v
                 Design Tool (Figma / Penpot)
```

---

## Flow

```
1. Agent calls connect(fileId)
     -> Adapter connects to design tool
     -> Design tool returns full design system (variables, components, styles, fonts with IDs)
     -> Adapter populates registry (name -> ID mappings)
     -> Agent receives design system context as response

2. Agent writes code, calls define_variables / define_styles / define_components / create_layout
     -> Compiler parses code synchronously -> emits IR or returns error immediately
     -> On compile error: tool returns error, no job created
     -> On success: adapter starts async work -> tool returns { jobId }
     -> Adapter resolves names to IDs via registry
     -> Adapter loads fonts, creates nodes, binds variables
     -> On completion: job status becomes "done" with results or errors

3. Agent polls job({ id }) to wait for completion
     -> { status: "running" }
     -> { status: "done", result: { created: [...], errors: [...] } }
     -> { status: "failed", error: "..." }

4. Agent calls inspect for details on a specific variable/component/style
     -> Goes directly to design tool via adapter (synchronous)
     -> Returns fresh data
     -> Response is populated into registry (name -> ID mappings updated)
```

---

## Components

### Compiler (pure, synchronous)

Transforms code to IR. No side effects, no knowledge of what exists in the design tool. Returns IR on success or throws on invalid input. The agent is responsible for writing correct code using the design system context from `connect`.

#### Input: `@theme` CSS -> IR variable operations

```css
@theme {
  --color-primary: #3B82F6;
  --color-primary-foreground: #FFFFFF;
  --spacing-md: 16px;
  --radius-md: 8px;
}

@theme dark {
  --color-primary: #60A5FA;
  --color-primary-foreground: #1A1A1A;
}
```

#### Input: CSS classes -> IR style operations

Styles are separate from variables. A style maps to a hex color or a variable reference.

```css
.primary-fill { background: var(--color-primary); }
.surface-fill { background: #F8F9FA; }
.heading { font-family: Inter; font-size: 24px; font-weight: 700; color: var(--color-foreground); }
.shadow-card { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
```

#### Input: TSX + CVA -> IR component operations

```tsx
const buttonVariants = cva("rounded-md font-medium", {
  variants: {
    variant: {
      primary: "bg-primary text-primary-foreground",
      secondary: "bg-secondary text-secondary-foreground",
    },
    size: {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

export function Button({ label, variant, size }) {
  return (
    <button className={buttonVariants({ variant, size })}>
      {label}
    </button>
  );
}
```

#### Input: TSX -> IR layout operations

```tsx
export function Dashboard() {
  return (
    <page name="Dashboard" width={1440} height={900}>
      <div className="flex flex-col gap-6 p-8">
        <span className="text-2xl font-bold text-foreground">Dashboard</span>
        <div className="flex gap-4">
          <Button variant="primary" size="md" label="Export" />
        </div>
      </div>
    </page>
  );
}
```

#### Compiler internals

- `parser/theme.ts` — `@theme` CSS -> IR variables
- `parser/styles.ts` — CSS classes -> IR styles (paint/text/effect)
- `parser/tsx.ts` — JSX AST via `@babel/parser`
- `parser/cva.ts` — CVA call -> variant matrix extraction
- `resolver/tailwind.ts` — class string -> properties with variable references

#### Tailwind resolver

Deterministic lookup, not running Tailwind:

| Class | IR Property |
|---|---|
| `bg-primary` | `fill: { variable: "color-primary" }` |
| `text-primary` (color) | `textFill: { variable: "color-primary" }` |
| `flex` / `flex-col` / `flex-row` | `layout: { mode }` |
| `gap-4` | `layout: { gap: 16 }` |
| `p-4` / `px-4` / `py-2` | `layout: { padding }` |
| `rounded-md` | `cornerRadius: { variable: "radius-md" }` |
| `w-full` | `sizing: { horizontal: "FILL" }` |
| `w-[1440px]` | `sizing: { horizontal: "FIXED", width: 1440 }` |
| `text-2xl` | `fontSize: 24` |
| `font-bold` | `fontWeight: 700` |
| `shadow-md` | `effect: { type: "DROP_SHADOW", variable: "shadow-md" }` |
| `overflow-hidden` | `clipsContent: true` |
| `opacity-50` | `opacity: 0.5` |

---

### Registry (adapter-internal)

Token-only dictionary. Maps names to IDs. Never exposed to the agent or compiler.

```ts
interface Registry {
  variables: Map<string, string>;    // "color-primary" -> "VariableId:1:23"
  components: Map<string, string>;   // "Button" -> "ComponentId:4:56"
  styles: Map<string, string>;       // "heading-1" -> "StyleId:7:89"
  fonts: Map<string, string[]>;      // "Inter" -> ["Regular", "Bold", ...]
}
```

Populated by:
- `connect` response — initial file state (includes available fonts)
- `inspect` response — any queried item gets its name/ID added
- Successful jobs — newly created items added

---

### Job Manager (MCP server-internal)

Tracks async adapter work. Each `define_*` / `create_layout` call that passes compilation creates a job.

```ts
interface Job {
  id: string;
  status: "running" | "done" | "failed";
  result?: ApplyResult;
  error?: string;
  createdAt: number;
}
```

Jobs are ephemeral — kept in memory for the session. The agent polls via the `job` tool.

---

### Adapter (stateful, async, tool-specific)

Owns the registry. Receives IR, resolves references, builds commands. Two phases:

1. **Resolve (sync)** — lookup names in registry, validate references exist. Throws immediately on missing variable/style/component/font family.
2. **Send (async)** — send resolved commands to design tool plugin. Font loading, node creation, variable binding happen here. Returns via job.

```ts
interface DesignSystemContext {
  variables: { name: string; collection: string; resolvedType: IRVariableType }[];
  styles: { name: string; type: "PAINT" | "TEXT" | "EFFECT" }[];
  components: { name: string; variants: Record<string, string[]> }[];
  fonts: { family: string; styles: string[] }[];
}

interface ApplyResult {
  created: string[];  // names of created items
  errors: string[];   // error messages for failed items
}

interface DesignAdapter {
  connect(fileId: string): Promise<DesignSystemContext>;
  inspect(type: "variable" | "style" | "component", name: string): Promise<InspectResult>;
  applyVariables(ir: IRVariableOp[]): Promise<ApplyResult>;
  applyStyles(ir: IRStyleOp[]): Promise<ApplyResult>;
  applyComponents(ir: IRComponentOp[]): Promise<ApplyResult>;
  applyLayout(ir: IRLayoutOp[]): Promise<ApplyResult>;
}

interface InspectResult {
  variable?: { name: string; resolvedType: IRVariableType; collection: string; valuesByMode: Record<string, IRVariableValue> };
  style?: { name: string; type: "PAINT" | "TEXT" | "EFFECT" };
  component?: { name: string; variants: Record<string, string[]>; props: Record<string, "TEXT"> };
}
```

The adapter is where:
- **Resolve (sync, throws):**
  - IR `{ type: "instance", component: "Button" }` -> registry lookup -> `"Button"` -> `"ComponentId:4:56"`
  - IR `{ fill: { type: "variable", name: "color-primary" } }` -> registry lookup -> `"color-primary"` -> `"VariableId:1:23"`
  - IR `{ fontFamily: "Inter" }` -> registry font check -> family exists?
  - Unknown name -> throw: `"Variable 'color-primary' not found. Available: color-bg, color-text, color-accent"`
- **Send (async, via job):**
  - Resolved commands sent to design tool plugin
  - Font loading, node creation, variable binding
  - Plugin errors surface in job result

---

## IR Types

```ts
// ─── Primitives ──────────────────────────────────────────────

/** A color source — either a hex literal or a reference to a variable by name. */
type IRColorSource =
  | { type: "hex"; value: string }
  | { type: "variable"; name: string };

/** A numeric source — either a literal value or a reference to a variable by name. */
type IRNumericSource =
  | { type: "literal"; value: number }
  | { type: "variable"; name: string };

type IRVariableType = "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";

type IRVariableValue = string | number | boolean; // hex string for COLOR, number for FLOAT, etc.

// ─── Variables ───────────────────────────────────────────────

interface IRCreateCollection {
  op: "create_collection";
  name: string;
  modes: string[]; // e.g. ["default", "dark"]
}

interface IRCreateVariable {
  op: "create_variable";
  name: string;
  collection: string;
  resolvedType: IRVariableType;
  values: Record<string, IRVariableValue>; // mode name -> value
}

type IRVariableOp = IRCreateCollection | IRCreateVariable;

// ─── Styles ──────────────────────────────────────────────────
// Styles are separate from variables.
// A style's color maps to a hex literal or a variable reference.

interface IRCreatePaintStyle {
  op: "create_paint_style";
  name: string;
  color: IRColorSource;
}

interface IRCreateTextStyle {
  op: "create_text_style";
  name: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: IRColorSource;
}

interface IRCreateEffectStyle {
  op: "create_effect_style";
  name: string;
  effects: IREffect[];
}

type IRStyleOp = IRCreatePaintStyle | IRCreateTextStyle | IRCreateEffectStyle;

// ─── Components ──────────────────────────────────────────────

interface IRCreateComponent {
  op: "create_component";
  name: string;
  props: Record<string, "TEXT">; // exposed text properties
  node: IRNode;
}

interface IRCreateComponentSet {
  op: "create_component_set";
  name: string;
  variants: Record<string, string[]>; // variant prop -> possible values
  props: Record<string, "TEXT">;
  permutations: IRComponentPermutation[];
}

interface IRComponentPermutation {
  variantValues: Record<string, string>; // e.g. { variant: "primary", size: "sm" }
  node: IRNode;
}

type IRComponentOp = IRCreateComponent | IRCreateComponentSet;

// ─── Layout ──────────────────────────────────────────────────

interface IRCreatePage {
  op: "create_page";
  name: string;
  root: IRNode;
}

interface IRCreateTree {
  op: "create_tree";
  pageName: string;
  root: IRNode;
}

type IRLayoutOp = IRCreatePage | IRCreateTree;

// ─── Node tree ───────────────────────────────────────────────

interface IRFrameNode {
  type: "frame";
  name: string;
  layout: IRLayout;
  fill: IRColorSource | null;
  stroke: IRStroke | null;
  cornerRadius: IRNumericSource | null;
  effects: IREffect[];
  opacity: number;
  clipsContent: boolean;
  children: IRNode[];
}

interface IRTextNode {
  type: "text";
  name: string;
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  fill: IRColorSource;
  opacity: number;
}

interface IRInstanceNode {
  type: "instance";
  component: string; // name reference, resolved by adapter via registry
  variantValues: Record<string, string>; // which variant to use
  overrides: Record<string, string>; // prop name -> override value (text content)
}

interface IRSvgNode {
  type: "svg";
  name: string;
  svg: string; // raw SVG markup
  fill: IRColorSource | null;
}

type IRNode = IRFrameNode | IRTextNode | IRInstanceNode | IRSvgNode;

// ─── Shared sub-types ────────────────────────────────────────

interface IRLayout {
  mode: "HORIZONTAL" | "VERTICAL" | "NONE";
  gap: number;
  padding: IRPadding;
  primaryAlign: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAlign: "MIN" | "CENTER" | "MAX" | "BASELINE";
  wrap: boolean;
  sizingH: "FIXED" | "HUG" | "FILL";
  sizingV: "FIXED" | "HUG" | "FILL";
  width: number;
  height: number;
  minWidth: number | null;
  maxWidth: number | null;
  minHeight: number | null;
  maxHeight: number | null;
}

interface IRPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface IRStroke {
  color: IRColorSource;
  weight: number;
  alignment: "INSIDE" | "OUTSIDE" | "CENTER";
}

interface IREffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "BLUR" | "BACKGROUND_BLUR";
  color: IRColorSource; // ignored for BLUR/BACKGROUND_BLUR
  offset: { x: number; y: number };
  radius: number;
  spread: number;
}
```

---

## MCP Tools

| Tool | Input | Returns | Notes |
|---|---|---|---|
| `connect` | `{ fileId }` | `DesignSystemContext` | Sync. Populates registry (variables, styles, components, fonts). |
| `inspect` | `{ type, name }` | `InspectResult` | Sync. Fresh data from design tool. Updates registry. |
| `define_variables` | `{ code }` | `{ jobId }` or compile error | Compile sync → adapter async. |
| `define_styles` | `{ code }` | `{ jobId }` or compile error | Compile sync → adapter async. Font loading may be slow. |
| `define_components` | `{ code }` | `{ jobId }` or compile error | Compile sync → adapter async. |
| `create_layout` | `{ code }` | `{ jobId }` or compile error | Compile sync → adapter async. Largest payloads. |
| `job` | `{ id }` | `Job` | Poll for async work completion. |

### Tool response flow

```
Agent calls define_styles({ code: "..." })
  1. Compiler parses synchronously
     -> Parse error? Return error immediately. No job.
  2. Adapter resolves IR synchronously (registry lookups)
     -> Missing variable/style/component? Return error immediately. No job.
     -> e.g. "Variable 'color-primary' not found. Available: color-bg, color-text, color-accent"
  3. Resolution succeeds → adapter sends commands to plugin (async)
     -> Job created, tool returns { jobId: "abc123" } immediately
  4. Agent polls job({ id: "abc123" })
     -> { status: "running" }
     -> { status: "done", result: { created: ["heading", "body"], errors: [] } }
     -> or { status: "failed", error: "Font 'CustomFont' not available" }
```

Errors at steps 1–2 are fast and actionable — the agent fixes code and retries. Step 3 failures (font loading, plugin timeouts) are rarer and surface via job polling.

### Gating

- Before `connect`: all other tools blocked
- After `connect`: all tools available, registry is populated

### Agent workflow

The agent operates in sequential batches, using `job` to confirm each step before proceeding:

```
connect → define_variables → job (poll) → define_styles → job (poll) → define_components → job (poll) → create_layout → job (poll)
```

Variables must exist before styles can reference them. Components must exist before layouts can instantiate them.

---

## Constraints (enforced)

- No inline styles except layout (flex, gap, padding, width, height, overflow)
- Visual properties only via Tailwind classes referencing theme variables
- Flexbox only — no grid, no absolute positioning
- Components must be defined before use (adapter errors on unknown)
- No images — SVG via inline `<svg>` in JSX
- Creation only — no editing existing nodes

---

## Package Structure

```
packages/
  compiler/               # Pure, synchronous
    src/
      ir/
        types.ts
      parser/
        theme.ts          # @theme CSS -> IRVariableOp[]
        styles.ts         # CSS classes -> IRStyleOp[]
        tsx.ts            # JSX -> IRNode tree
        cva.ts            # CVA -> variant matrix
      resolver/
        tailwind.ts       # class string -> IR properties
      index.ts            # compile_variables(), compile_styles(), compile_components(), compile_layout()

  mcp/                    # Server + tools + job manager
    src/
      server.ts
      jobs.ts             # Job manager — tracks async adapter work
      tools/
        connect.ts
        inspect.ts
        define-variables.ts
        define-styles.ts
        define-components.ts
        create-layout.ts
        job.ts            # Poll job status

  adapter-figma/          # Figma-specific, async
    src/
      adapter.ts          # DesignAdapter implementation
      registry.ts         # Map<name, id> + font registry
      apply/
        variables.ts      # IRVariableOp -> Figma variable commands
        styles.ts         # IRStyleOp -> Figma paint/text/effect style commands
        components.ts     # IRComponentOp -> Figma component commands
        layout.ts         # IRLayoutOp -> Figma frame/instance commands
      plugin/             # Figma plugin (runs in browser)

  tunnel/                 # WebSocket relay (unchanged)
```

---

## Implementation Order

1. IR types — the contract everything builds against
2. Theme parser — `@theme` CSS -> IRVariableOp[]
3. Style parser — CSS classes -> IRStyleOp[]
4. Tailwind resolver — class string -> IR properties
5. Job manager — create, poll, complete/fail jobs
6. Figma adapter + registry — connect (populate registry including fonts), apply variables + styles
7. TSX parser + CVA extractor — component compilation
8. Component adapter — create design tool components/component sets
9. Layout compiler + adapter — instance resolution, page creation
10. MCP server + tools — wire compile → job → adapter pipeline
11. Actionable errors — adapter returns context-rich errors (available names, etc.)
