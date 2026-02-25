# Building Components, Variants & Instances

## Table of Contents
- [Component Creation Strategies](#component-creation-strategies)
- [Building a Button (Step-by-Step)](#building-a-button-step-by-step)
- [Variant Naming Convention](#variant-naming-convention)
- [Component Properties](#component-properties)
- [Icons and SVG Import](#icons-and-svg-import)
- [Boolean Operations](#boolean-operations)
- [Responsive Constraints](#responsive-constraints)
- [Instances and Composition](#instances-and-composition)
- [Overriding Instance Content](#overriding-instance-content)

---

## Component Creation Strategies

**Approach A: Direct Component Creation** (best for variants)
1. Create individual components with `create_component` (one per variant)
2. Combine into a component set with `combine_as_variants`
3. Do NOT manually position variants — `combine_as_variants` handles layout

**Approach B: Build-Then-Promote** (best for iterative/complex components)
1. Build a frame with `create_frame`, style it, add children
2. Verify visually with `export_node_as_image`
3. Promote to component with `create_component_from_node`

> **Warning**: `create_component_from_node` returns a **new node ID**. The original frame ID becomes invalid. Always use the returned ID.

## Building a Button (Step-by-Step)

### Step 1: Create each variant as a component

```
# x/y/width/height are all optional (default: 0/0/100/100)
# Components default to transparent fill and 0 padding
create_component(
  name: "Style=Default, State=Idle",
  layoutMode: "HORIZONTAL",
  primaryAxisAlignItems: "CENTER", counterAxisAlignItems: "CENTER",
  paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 4,
  layoutSizingHorizontal: "HUG",
  fillColor: { r: 0, g: 0.48, b: 1 }, cornerRadius: 6
)  -> componentId

# create_text accepts layoutSizing directly — no separate set_layout_sizing call needed
create_text(
  text: "Button", fontSize: 13, fontWeight: 600,
  fontColor: { r: 1, g: 1, b: 1 }, parentId: componentId,
  layoutSizingHorizontal: "HUG"
)
```

### Step 2: Build all variants

Repeat for each combination (Style=Default/Bordered x State=Idle/Disabled).

### Step 3: Combine as variants

```
combine_as_variants(
  componentIds: ["comp-1", "comp-2", "comp-3", "comp-4"],
  name: "Push Button"
)
```

This automatically groups all variants, infers variant properties from the `Property=Value` naming, and lays out variants in a grid.

## Variant Naming Convention

Figma parses variant component names to extract properties:

```
"Style=Default, State=Idle"      -> Properties: Style (Default), State (Idle)
"Style=Default, State=Disabled"  -> Properties: Style (Default), State (Disabled)
```

**Rules:**
- Comma-separated `Property=Value` pairs
- All variants in a set must have the **same property names**
- Property names and values are case-sensitive

## Component Properties

```
# Boolean (show/hide a layer)
add_component_property(componentId, propertyName: "Show Icon", type: "BOOLEAN", defaultValue: true)

# Text (override text content)
add_component_property(componentId, propertyName: "Label", type: "TEXT", defaultValue: "Button")

# Instance swap (swap a nested component)
add_component_property(componentId, propertyName: "Icon", type: "INSTANCE_SWAP")
```

## Icons and SVG Import

Import icons directly as SVG strings:

```
create_node_from_svg(
  svg: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17L4 12" stroke="black" stroke-width="2" stroke-linecap="round"/></svg>',
  name: "Icon/Checkmark", x: 0, y: 0
)
```

## Boolean Operations

Combine shapes for complex icons:

```
create_ellipse(name: "Outer", width: 40, height: 40)
create_ellipse(name: "Inner", x: 8, y: 8, width: 24, height: 24)  # offset for SUBTRACT
create_boolean_operation(nodeIds: ["outer-id", "inner-id"], operation: "SUBTRACT", name: "Ring Icon")
```

Operations: `UNION` (combine), `SUBTRACT` (cut out), `INTERSECT` (overlap only), `EXCLUDE` (XOR).
**Order matters for SUBTRACT** — first node is base, subsequent are subtracted.

## Responsive Constraints

For components that need responsive behavior in non-auto-layout frames:

```
set_constraints(nodeId, horizontal: "MAX", vertical: "MIN")   <- pin to top-right
set_constraints(nodeId, horizontal: "STRETCH", vertical: "MAX")  <- stretch across bottom
```

| Value | Behavior |
|-------|----------|
| `MIN` | Pin to left (H) or top (V) |
| `MAX` | Pin to right (H) or bottom (V) |
| `CENTER` | Stay centered |
| `STRETCH` | Stretch with parent |
| `SCALE` | Scale proportionally |

> Constraints only apply in non-auto-layout frames. Auto-layout uses `FILL`/`HUG`/`FIXED` sizing.

## Instances and Composition

Always use `create_instance_from_local` for components in the same file. Pass a component ID or a component set ID (auto-selects default variant):

```
create_instance_from_local(componentId, x: 100, y: 200)
create_instance_from_local(componentId: "component-set-id")  <- auto-picks default variant
create_instance_from_local(componentId, parentId: "auto-layout-frame-id")  <- AL handles position
```

### Composing layouts

```
# Frames default to transparent — pass fillColor explicitly for surface frames
create_frame(name: "Dialog Card", layoutMode: "VERTICAL", itemSpacing: 12,
  paddingTop: 20, paddingBottom: 20, paddingLeft: 20, paddingRight: 20,
  fillColor: { r: 1, g: 1, b: 1 }, cornerRadius: 12,
  layoutSizingVertical: "HUG")

# Text nodes accept layoutSizing and textStyleId directly
create_text(text: "Are you sure?", parentId: cardId,
  fontSize: 16, fontWeight: 700, layoutSizingHorizontal: "FILL")
create_instance_from_local(componentId: buttonId, parentId: cardId)
```

## Overriding Instance Content

```
scan_text_nodes(nodeId: instanceId)    <- find text nodes
set_text_content(nodeId: textNodeId, text: "Cancel")    <- single override

# Batch override (processes in batches of 5, much faster):
set_multiple_text_contents(
  nodeId: instanceId,
  text: [
    { nodeId: "title-id", text: "Confirm Delete" },
    { nodeId: "body-id", text: "This action cannot be undone." }
  ]
)
```
