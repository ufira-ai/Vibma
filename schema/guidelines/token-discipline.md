# Token Discipline

Every color, spacing value, and text style should come from a design token — not hardcoded values.

## Colors

Bind fills and strokes to color variables instead of hex values.

- Fill: `fillVariableName:"bg/primary"` or `fillStyleName:"Surface/Primary"`
- Stroke: `strokeVariableName:"border/default"`
- Text color: `fontColorVariableName:"text/primary"`

If no matching variable exists, create one first:
```
variables(method:"create", collectionId:"Colors", items:[{name:"bg/accent", type:"COLOR", valuesByMode:{"Light":"#E8F0FE","Dark":"#1A3A5C"}, scopes:["ALL_FILLS"]}])
```

## Spacing and Radius

Pass a variable name string instead of a number for cornerRadius, padding, itemSpacing, strokeWeight, opacity.

- `cornerRadius:"radius/8"` not `cornerRadius:8`
- `paddingTop:"space/16"` not `paddingTop:16`
- `itemSpacing:"space/8"` not `itemSpacing:8`

Create FLOAT variables with appropriate scopes:
```
variables(method:"create", collectionId:"Metrics", items:[{name:"space/12", type:"FLOAT", value:12, scopes:["GAP","WIDTH_HEIGHT"]}])
```

## Text Styles

Apply text styles by name — don't set fontSize/fontFamily/fontWeight manually.

- `textStyleName:"Body/M"` on text.create or frames.update
- Create styles with `styles(method:"create", type:"text", items:[{name:"Body/M", fontFamily:"Inter", fontSize:14, lineHeight:{value:20, unit:"PIXELS"}}])`

## Checking

Lint rules `hardcoded-color`, `hardcoded-token`, `no-text-style` catch these. Run `audit` on any node to check.
