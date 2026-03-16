# Component Structure

Components need correct sizing, property bindings, and token usage to work well as instances.

## Width Constraints

Components with text content need a width — otherwise text never wraps.

- Set `width` and `layoutSizingHorizontal:"FIXED"` on cards, panels, list items
- HUG on both axes is only correct for buttons, badges, icons — intrinsically-sized elements

## Property Bindings

Every text node inside a component should be bound to a TEXT property so instances can edit the content.

- On creation: `children:[{type:"text", text:"Title", componentPropertyName:"Title"}]` auto-creates and binds
- After creation: `frames(method:"update", items:[{id:"<textNodeId>", componentPropertyName:"<propName>"}])`
- For existing nodes with many text children: `components(method:"create", type:"from_node", exposeText:true)`

Orphaned properties (defined but not bound to any node) should be deleted:
```
components(method:"update", items:[{id, propertyName:"<key>", action:"delete"}])
```

## Variant Sets

Group related components as variants — don't leave them as separate components.

- Name variants with the property format: `Style=Primary`, `Style=Secondary`
- Combine: `components(method:"create", type:"variant_set", items:[{componentIds:[...], name:"Button"}])`
- Instances pick variants via `variantProperties:{"Style":"Primary"}`

## Checking

Run `components(method:"audit", id)` — checks both lint rules and property bindings in one call.
