# Design Tokens: Variables & Styles

## Table of Contents
- [Variable Collections](#variable-collections)
- [Variable Types](#variable-types)
- [Binding Variables to Nodes](#binding-variables-to-nodes)
- [Paint Styles](#paint-styles)
- [Text Styles](#text-styles)
- [Effect Styles](#effect-styles)
- [Style Naming Convention](#style-naming-convention)

---

## Variable Collections

Variable collections hold design tokens with multiple modes (e.g., Light/Dark):

```
create_variable_collection(name: "Appearance")   -> collectionId + default modeId
rename_mode(collectionId, modeId: "default-mode-id", name: "Light")
add_mode(collectionId, name: "Dark")   -> new modeId
remove_mode(collectionId, modeId: "mode-to-delete")  # delete a mode

create_variable(collectionId, name: "background/primary", resolvedType: "COLOR")

set_variable_value(variableId, modeId: "light-mode-id", value: { r: 1, g: 1, b: 1, a: 1 })
set_variable_value(variableId, modeId: "dark-mode-id", value: { r: 0.1, g: 0.1, b: 0.1, a: 1 })
```

## Variable Types

| Type | Use Case | Value Format |
|------|----------|--------------|
| `COLOR` | Colors | `{ r: 0-1, g: 0-1, b: 0-1, a: 0-1 }` |
| `FLOAT` | Spacing, sizing, radii | Number |
| `STRING` | Text content | String |
| `BOOLEAN` | Visibility toggles | `true`/`false` |

## Binding Variables to Nodes

Variables are useful only when bound to node properties via `set_variable_binding`:

```
# Color variables -> paint properties
set_variable_binding(nodeId, field: "fills/0/color", variableId)
set_variable_binding(nodeId, field: "strokes/0/color", variableId)

# Float variables -> numeric properties
set_variable_binding(nodeId, field: "height", variableId)
set_variable_binding(nodeId, field: "width", variableId)
set_variable_binding(nodeId, field: "cornerRadius", variableId)
set_variable_binding(nodeId, field: "itemSpacing", variableId)
set_variable_binding(nodeId, field: "paddingLeft", variableId)
set_variable_binding(nodeId, field: "opacity", variableId)
set_variable_binding(nodeId, field: "strokeWeight", variableId)
```

**Important**: For `fills/0/color` and `strokes/0/color`, the node must already have at least one fill or stroke applied. If the index is out of range, the tool will error.

## Paint Styles

For simple, non-modal colors (brand colors, materials):

```
create_paint_style(name: "Materials/Thick", color: { r: 0.96, g: 0.96, b: 0.96, a: 0.9 })
create_paint_style(name: "Accent/Blue", color: { r: 0, g: 0.48, b: 1, a: 1 })

# Apply by ID
apply_style_to_node(nodeId, styleId: "S:abc123...", styleType: "fill")

# Or apply by name (case-insensitive substring match — no need to track IDs)
apply_style_to_node(nodeId, styleName: "Accent/Blue", styleType: "fill")
```

## Text Styles

**Always verify fonts first** — never call `get_available_fonts()` without a `query` parameter (returns 450K+ chars):

```
get_available_fonts(query: "SF Pro")
-> { familyCount: 4, fonts: [{ family: "SF Pro", styles: ["Regular", "Bold", ...] }] }

create_text_style(name: "Heading/Large Title", fontFamily: "SF Pro", fontSize: 26, fontStyle: "Bold")
create_text_style(name: "Body/Regular", fontFamily: "SF Pro", fontSize: 13, fontStyle: "Regular",
                  lineHeight: { value: 18, unit: "PIXELS" })

# Apply to existing text nodes
apply_style_to_node(nodeId, styleId, styleType: "text")

# Or apply at creation time — pass textStyleId directly to create_text
create_text(text: "Hello", parentId: frameId, textStyleId: bodyStyleId,
            layoutSizingHorizontal: "FILL")
```

## Effect Styles

```
create_effect_style(
  name: "Shadow/Medium",
  effects: [{
    type: "DROP_SHADOW", radius: 8,
    offset: { x: 0, y: 2 },
    color: { r: 0, g: 0, b: 0, a: 0.15 },
    spread: 0, visible: true
  }]
)
```

## Style Naming Convention

Use `/` in style names to create groups in the Figma UI:

```
Materials/Thick       -> "Materials" group
Materials/Medium
Accent/Blue           -> "Accent" group
Heading/Large Title   -> "Heading" group
Body/Regular          -> "Body" group
```
