# Common Pitfalls & Solutions

## 1. Absolute Coordinates for Children

**Problem**: Using page-absolute coordinates when positioning children inside frames.
**Solution**: Use auto-layout (preferred). If manual positioning required:
```
child_x = desired_absolute_x - parent_absolute_x
child_y = desired_absolute_y - parent_absolute_y
move_node(nodeId: child, x: child_x, y: child_y)
```

## 2. Orphaned Nodes

**Problem**: Children placed outside parent's visible bounds.
**Solution**: Use auto-layout containers — children automatically flow into position.

## 3. Sections Don't Auto-Layout

**Problem**: Expecting sections to auto-layout their children.
**Solution**: Sections are canvas organizers only. Nest an auto-layout frame inside:
```
create_section(name: "Buttons", width: 800, height: 400)
create_frame(name: "Buttons Content", parentId: sectionId,
  layoutMode: "VERTICAL", itemSpacing: 24,
  layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG")
```

## 4. Text Sizing in Auto-Layout

**Problem**: Text nodes render at 0px width (vertical character-by-character) inside auto-layout frames.
**Root cause**: Figma text defaults to `textAutoResize: "WIDTH_AND_HEIGHT"` (shrink to fit content), which conflicts with `layoutSizingHorizontal: "FILL"`.
**Solution**: Pass `layoutSizingHorizontal: "FILL"` in `create_text` — it automatically sets `textAutoResize: "HEIGHT"`:
```
create_text(text: "Long paragraph...", parentId: autoLayoutFrameId,
  layoutSizingHorizontal: "FILL")
```
For fixed-width text, explicitly set `textAutoResize: "HEIGHT"`:
```
create_text(text: "Fixed width text", parentId: frameId,
  textAutoResize: "HEIGHT", layoutSizingHorizontal: "FIXED")
```

## 5. Font Loading Failures

**Problem**: `create_text_style` fails because font family/style doesn't exist.
**Solution**: Always verify first: `get_available_fonts(query: "Inter")`.
**Never** call `get_available_fonts()` without `query` — returns 450K+ chars.

## 6. Colors are 0-1, Not 0-255

**Problem**: Passing RGB values as 0-255.
**Solution**: Figma uses normalized 0-1 values.
```
# Hex #007AFF -> { r: 0/255, g: 122/255, b: 255/255 } = { r: 0, g: 0.478, b: 1 }
```

## 7. Local Components Use create_instance_from_local

**Problem**: Trying to instantiate a local component with the wrong tool or wrong ID type.
**Solution**: Always use `create_instance_from_local(componentId)` for same-file components. Pass the component's node ID (not a key). For component sets, pass the set ID — the default variant is auto-selected.

## 8. insert_child Doesn't Reposition

**Problem**: After `insert_child`, node appears at wrong position in new parent.
**Solution**: Node keeps old coordinates. Use an auto-layout parent (best) or follow with `move_node` using parent-relative coordinates.

## 9. create_component_from_node Changes the Node ID

**Problem**: After promoting a frame to a component, old node ID is invalid.
**Solution**: Always capture and use the returned ID:
```
create_component_from_node(nodeId: "4:22")  -> { id: "4:24", ... }
# "4:22" is now INVALID — use "4:24" for all subsequent operations
```

## 10. Component Set Naming Mismatch

**Problem**: `combine_as_variants` fails or creates wrong properties.
**Solution**: ALL variant component names must share the exact same property names:
```
# GOOD
"Size=Small, State=Idle"
"Size=Large, State=Idle"

# BAD — mismatched property names
"Size=Small, State=Idle"
"Style=Large, Active=True"
```

## 11. Creating Styles but Never Applying Them

**Problem**: Created paint/text/effect styles but used raw color/font values on every node. Styles exist but aren't connected to any nodes.
**Solution**: After creating a style, apply it to nodes. Use `styleName` for convenience (no need to track IDs):
```
# For text, apply at creation time:
create_text(text: "Title", parentId: frameId, textStyleId: headingStyleId)

# For existing nodes — by ID:
apply_style_to_node(nodeId, styleId: "S:abc123...", styleType: "fill")

# Or by name (case-insensitive substring match — much easier):
apply_style_to_node(nodeId, styleName: "Heading/Large Title", styleType: "text")
apply_style_to_node(nodeId, styleName: "Accent/Blue", styleType: "fill")
apply_style_to_node(nodeId, styleName: "Shadow/Medium", styleType: "effect")
```

## 12. No Single-Side Strokes

**Problem**: Trying to create a left-bordered callout or bottom-bordered row with `set_stroke_color`. Figma strokes apply to all sides — there's no `strokeSide` parameter.
**Solution**: Build single-side borders as a colored rectangle inside a horizontal auto-layout:
```
# Left-bordered callout
create_frame(name: "Callout", parentId: parentId,
  layoutMode: "HORIZONTAL", itemSpacing: 0,
  layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG")

# Left border bar
create_rectangle(name: "Border", parentId: calloutId, width: 4, height: 1)
set_fill_color(nodeId: borderRectId, r: 0, g: 0.48, b: 1)
set_layout_sizing(nodeId: borderRectId, layoutSizingVertical: "FILL")

# Content area
create_frame(name: "Content", parentId: calloutId,
  layoutMode: "VERTICAL", itemSpacing: 8,
  paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 12,
  layoutSizingHorizontal: "FILL", layoutSizingVertical: "HUG")
```

## 13. Instance Text Not Overridden

**Problem**: Component instances show default component text instead of contextual content.
**Solution**: After creating instances, override their text:
```
create_instance_from_local(componentId, parentId: frameId)
scan_text_nodes(nodeId: instanceId)    <- find text node IDs
set_text_content(nodeId: textNodeId, text: "Contextual content here")
```
