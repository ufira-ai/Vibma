# Component Structure

Components need correct sizing, property bindings, and token usage to work well as instances.

## Width Constraints

Components with text content need a width — otherwise text never wraps.

- Set `width` and `layoutSizingHorizontal:"FIXED"` on cards, panels, list items
- HUG on both axes is only correct for buttons, badges, icons — intrinsically-sized elements

## Property Bindings

Every text node inside a component should be bound to a TEXT property so instances can edit the content.

- On creation: `children:[{type:"text", text:"Title", componentPropertyName:"Title"}]` auto-creates and binds
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

### Adding Variants to an Existing Set

Clone an existing variant into the same set with a new name. The `name` param is required — without it, the duplicate name corrupts the set.

**Add a new value to an existing dimension** (e.g. State=Hover):
```
components(method:"clone", id:"<variant_id>", name:"Style=Primary, State=Hover", parentId:"<set_id>")
```
Clone one variant per combination. For a Style×State set, adding State=Hover requires two clones (one per Style). Use batch `items` for efficiency:
```
components(method:"clone", items:[
  {id:"<Primary/Default>", name:"Style=Primary, State=Hover", parentId:"<set_id>"},
  {id:"<Secondary/Default>", name:"Style=Secondary, State=Hover", parentId:"<set_id>"}
])
```
Then patch the new variants: `frames(method:"update", items:[{id:"<new>", fillVariableName:"color/hover"}])`

**Add a new dimension** (e.g. Size=sm to a Style×State set):
1. Batch rename existing variants to include the new dimension: `frames(method:"update", items:[{id:"<each>", name:"..., Size=md"}])`
2. Batch clone all variants with the new value: `components(method:"clone", items:[{id:"<each>", name:"..., Size=sm", parentId:"<set_id>"}])`
3. Batch patch the new variants: `frames(method:"update", items:[{id:"<each>", padding:8, minHeight:32}])`

Property bindings (TEXT, INSTANCE_SWAP) are preserved on cloned variants.

## Checking

Run `components(method:"audit", id)` — checks both lint rules and property bindings in one call.
