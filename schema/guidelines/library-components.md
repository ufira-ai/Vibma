# Working with Library Components

Library components are read-only — they come from external team libraries and cannot be edited in the current file.

## Reading

When reading nodes, library instances appear as stubs with their overridable properties:
```
{name: "Header", type: "INSTANCE", componentProperties: {"Platform": "Desktop"}}
```

Library internals are hidden: no `componentId`, no variable names, no style names. You see resolved values (hex colors, numbers) instead.

## Using

Place library instances via `instances(method:"create", items:[{componentId:"<id>"}])` when you have a local component ID. For library components, instances are already placed by the designer — interact via `instances(method:"update")` to set properties.

## Customizing

To edit a library component, clone it into the local file first:

```
components(method:"clone", id:"<instanceId>")
```

This resolves the instance to its source component (or full component set) and creates a local copy with a new ID. Edit the local copy freely — it is independent of the library.

Do not attempt to `components(method:"get")` or `components(method:"update")` a library component directly — these will error.

## Overriding Instance Properties

Use `instances(method:"update")` to change overridable properties on library instances:
```
instances(method:"update", items:[{id:"<instanceId>", properties:{"Label":"New Text", "State":"Hover"}}])
```

Property names are clean (no hash suffixes needed for update — the system resolves partial keys).
