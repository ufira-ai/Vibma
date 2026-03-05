# YAML Schema Compiler — Plan

## Goal
Single source of truth: YAML defines every endpoint. A compiler generates all MCP code, Figma handler wiring, docs, and response types.

## Architecture

```
schema/
  base/node.yaml          — base methods inherited by all scene-graph endpoints
  tools/
    connection.yaml       — non-node endpoint
    document.yaml         — non-node endpoint
    selection.yaml        — non-node endpoint
    frames.yaml           — extends node
    text.yaml             — extends node
    shapes.yaml           — extends node
    components.yaml       — extends node
    instances.yaml        — extends node
    styles.yaml           — non-node endpoint (existing CRUD)
    variables.yaml        — non-node endpoint (existing CRUD)
    variable_collections.yaml — non-node endpoint (existing CRUD + custom methods)
    fonts.yaml            — non-node endpoint
    lint.yaml             — non-node endpoint
    export.yaml           — non-node endpoint
  refs/                   — shared schema fragments ($ref targets)
    color.yaml
    effect.yaml
    depth.yaml
  compiler/
    index.ts              — entry point: reads YAML, merges base, generates all outputs
    parse.ts              — YAML loader + validation
    merge.ts              — base method inheritance (extends: node)
    gen-mcp.ts            — generates ToolDef arrays + Zod schemas
    gen-descriptions.ts   — flattens method table into tool description string
    gen-response-types.ts — generates TS interfaces + JSON Schema map
    gen-docs.ts           — generates manifest + domain MDX (replaces extract-tools.ts)
    gen-handlers.ts       — generates Figma dispatcher wiring (registry.ts)
```

## YAML Format

### Base (node.yaml)
```yaml
base: node
methods:
  get:
    tier: read
    description: Get serialized node data
    params:
      id: { type: string, required: true, description: Node ID }
      fields: { type: string[], coerce: json, description: "Property whitelist" }
      depth: { $ref: depth }
    response: { type: object, description: Serialized node tree }

  list:
    tier: read
    description: Search for nodes
    params:
      query: { type: string, description: Name search query }
      types: { type: string[], coerce: json, description: Filter by node types }
      fields: { type: string[], coerce: json }
      offset: { type: number, coerce: true, default: 0 }
      limit: { type: number, coerce: true, default: 100 }
    response: { type: paginated }

  update:
    tier: edit
    description: Patch node properties
    params:
      items: { type: array, items: { $ref: patch_item }, coerce: json }
    response: { type: batch }

  delete:
    tier: edit
    params:
      id: { type: string }
      items: { type: array, items: { type: object, properties: { id: { type: string } } }, coerce: json }
    response: { type: batch_ok }

  clone:
    tier: create
    params:
      id: { type: string, required: true }
      parentId: { type: string }
      x: { type: number, coerce: true }
      y: { type: number, coerce: true }
    response: { type: batch, item: { id: string } }

  reparent:
    tier: edit
    params:
      items: { type: array, coerce: json, items: { type: object, properties: { id: { type: string }, parentId: { type: string }, index: { type: number } } } }
    response: { type: batch_ok }
```

### Endpoint (frames.yaml)
```yaml
endpoint: frames
extends: node
domain: creation
description: "Create and manage frames, auto-layout containers, and sections."

methods:
  create:
    tier: create
    description: Create frame-like containers
    discriminant: type
    types:
      frame:
        params:
          name: { type: string }
          parentId: { $ref: parentId }
          x: { $ref: xPos }
          y: { $ref: yPos }
          width: { type: number, coerce: true }
          height: { type: number, coerce: true }
          fillColor: { $ref: color, description: Background fill }
          fillStyleName: { type: string }
          # ... more frame properties
      auto_layout:
        params:
          name: { type: string }
          parentId: { $ref: parentId }
          layoutMode: { type: enum, values: [HORIZONTAL, VERTICAL] }
          itemSpacing: { type: number, coerce: true }
          paddingTop: { type: number, coerce: true }
          paddingBottom: { type: number, coerce: true }
          paddingLeft: { type: number, coerce: true }
          paddingRight: { type: number, coerce: true }
          # ...
      section:
        params:
          name: { type: string, required: true }
          parentId: { $ref: parentId }
          x: { $ref: xPos }
          y: { $ref: yPos }
          width: { type: number, coerce: true }
          height: { type: number, coerce: true }
    response:
      type: batch
      item: { id: string }
```

### Non-node endpoint (connection.yaml)
```yaml
endpoint: connection
domain: connection
description: "Manage the Figma plugin connection."

methods:
  create:
    command: join_channel
    tier: read
    inline: true
    description: Join a relay channel (required first step)
    params:
      channel: { type: string, default: vibma, description: Channel name }
    response:
      type: string
      example: 'Joined channel "vibma" on port 3055.'

  get:
    command: ping
    tier: read
    timeout: 5000
    description: Verify end-to-end connection
    params: {}
    response:
      type: object
      properties:
        status: { type: string, const: pong }
        documentName: { type: string }
        currentPage: { type: string }
        timestamp: { type: number }
      example: { status: pong, documentName: Design System, currentPage: Components }

  list:
    command: channel_info
    tier: read
    inline: true
    description: Inspect connected clients per channel
    params: {}
    response:
      type: object
      description: Map of channels to client status

  delete:
    command: reset_tunnel
    tier: edit
    inline: true
    description: Factory-reset a channel (disconnects all clients)
    params:
      channel: { type: string, default: vibma }
    response:
      type: string
      example: "Channel vibma reset"
```

## Compiler Output

The compiler generates (all into `generated/` dirs, gitignored or committed):

1. **`packages/core/src/tools/generated/defs/*.ts`** — ToolDef arrays per endpoint
2. **`packages/core/src/tools/generated/mcp-registry.ts`** — imports + registerAllTools
3. **`packages/core/src/tools/generated/response-types.ts`** — TS interfaces + JSON Schema map
4. **`packages/adapter-figma/src/handlers/generated/registry.ts`** — dispatcher wiring
5. **`docs/public/tools-manifest.json`** — docs manifest
6. **`docs/src/content/docs/tools/*.mdx`** — domain MDX pages

## Compiler Phases

1. **Parse** — load all YAML, resolve $ref, validate structure
2. **Merge** — for endpoints with `extends: node`, merge base methods under inherited methods
3. **Generate descriptions** — for each endpoint, flatten method signatures into compact table
4. **Generate MCP** — emit ToolDef with Zod schema (method enum, per-method params union)
5. **Generate response types** — emit TS interfaces + JSON Schema
6. **Generate handler registry** — emit command-to-handler dispatch map
7. **Generate docs** — emit manifest JSON + MDX pages

## Migration Strategy

Phase 1 (this PR): Compiler + connection + selection + frames as proof of concept
Phase 2: Migrate remaining endpoints, delete hand-written defs
Phase 3: Delete old extract-tools.ts, domain-config.ts, response-types.ts
