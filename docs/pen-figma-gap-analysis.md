# .pen Format vs Figma: Gap Analysis

This document identifies the gaps between the .pen format (Pencil) and Figma's feature set, organized by category. Each gap is categorized as:

- **Figma-only**: Feature exists in Figma but has no .pen equivalent
- **Pen-only**: Feature exists in .pen but has no Figma equivalent
- **Partial**: Feature exists in both but with differing capabilities

---

## 1. Object / Node Types

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Frame | `frame` | `FRAME` | Parity |
| Rectangle | `rectangle` | `RECTANGLE` | Parity |
| Ellipse | `ellipse` | `ELLIPSE` | Parity |
| Text | `text` | `TEXT` | Parity |
| Line | `line` | `LINE` | Parity |
| Path / Vector | `path` | `VECTOR` | Parity |
| Group | — | `GROUP` | **Figma-only** — .pen has no group type |
| Section | — | `SECTION` | **Figma-only** — .pen has no section type |
| Boolean operation | `boolean` | `BOOLEAN_OPERATION` | Parity |
| SVG | — | SVG import as vectors | **Figma-only** — .pen has no raw SVG node type |
| Image | `image` | Image fill on rectangles | Partial — .pen has a dedicated `image` type; Figma uses image fills |
| Icon font | `icon_font` | — | **Pen-only** — native icon font support |
| Ref (instance) | `ref` | `INSTANCE` | Parity (different naming) |
| Star | `star` | `STAR` | Parity |
| Polygon | `polygon` | `POLYGON` | Parity |
| Connector | `connector` | — | **Pen-only** — native connector/arrow type |
| Sticky note | `sticky_note` | `STICKY` | Parity |
| Stamp | `stamp` | `STAMP` | Parity |
| Slice | — | `SLICE` | **Figma-only** — export regions |
| Widget | — | `WIDGET` | **Figma-only** — interactive widgets |
| Embed | — | `EMBED` | **Figma-only** — embedded content |

## 2. Layout System

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Flexbox layout | `layout`, `justifyContent`, `alignItems` — CSS-like | `layoutMode`, `primaryAxisAlignItems`, `counterAxisAlignItems` | Partial — .pen uses CSS naming; Figma uses custom names |
| Layout wrap | Likely via flex properties | `layoutWrap: WRAP/NO_WRAP` | Parity |
| Fill sizing | `fill` on children | `FILL` | Parity |
| Hug sizing | `fit` (fit-content) on parent | `HUG` | Parity |
| Fixed sizing | `width`/`height` | `FIXED` | Parity |
| Padding | Likely per-side | `paddingTop/Right/Bottom/Left` | Parity |
| Item spacing (gap) | Likely via `gap` property | `itemSpacing` | Parity |
| Counter-axis spacing | — | `counterAxisSpacing` | **Figma-only** — gap between wrapped rows |
| Min/max width/height | — | `minWidth`, `maxWidth`, `minHeight`, `maxHeight` | **Figma-only** — responsive constraints |
| Absolute positioning in auto-layout | — | `layoutPositioning: ABSOLUTE` | **Figma-only** — floating children in auto-layout |
| Constraints (responsive pinning) | — | `constraints.horizontal/vertical` (MIN, CENTER, MAX, STRETCH, SCALE) | **Figma-only** — resize behavior constraints |
| Grid layout | — | Layout grids (visual guides only) | **Figma-only** — grid guides |
| CSS Grid | — | — | Neither supports CSS Grid natively |

## 3. Appearance & Graphics

### Fills

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Solid color | `color` string/object | `SOLID` paint | Parity |
| Linear gradient | `gradient` with `type: linear` | `GRADIENT_LINEAR` | Parity |
| Radial gradient | `gradient` with `type: radial` | `GRADIENT_RADIAL` | Parity |
| Angular gradient | `gradient` with `type: angular` | `GRADIENT_ANGULAR` | Parity |
| Diamond gradient | — | `GRADIENT_DIAMOND` | **Figma-only** |
| Image fill | `image` fill type | `IMAGE` paint with `scaleMode` | Partial — Figma has scale modes (FILL, FIT, CROP, TILE) |
| Mesh gradient | `mesh_gradient` | — | **Pen-only** |
| Multiple fills | Yes (array, painted in order) | Yes (`fills[]` array) | Parity |
| Fill visibility toggle | — | `visible` per paint entry | **Figma-only** — individual fill visibility |

### Stroke

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Single stroke | Yes | Yes | Parity |
| Stroke with multiple fills | Yes | — | **Pen-only** — stroke can have multiple fills |
| Stroke weight | Likely supported | `strokeWeight` | Parity |
| Per-side stroke weight | — | `strokeTopWeight`, `strokeBottomWeight`, etc. | **Figma-only** |
| Stroke alignment | — | `strokeAlign: INSIDE/OUTSIDE/CENTER` | **Figma-only** |
| Stroke cap | — | `strokeCap` (NONE, ROUND, SQUARE, etc.) | **Figma-only** |
| Stroke join | — | `strokeJoin` (MITER, BEVEL, ROUND) | **Figma-only** |
| Dash pattern | — | `dashPattern` | **Figma-only** |
| Multiple strokes | — | `strokes[]` array | **Figma-only** — .pen supports single stroke only |

### Effects

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Drop shadow | Via `effect` property | `DROP_SHADOW` | Parity |
| Inner shadow | Via `effect` property | `INNER_SHADOW` | Parity |
| Layer blur | Via `effect` property | `LAYER_BLUR` | Parity |
| Background blur | Via `effect` property | `BACKGROUND_BLUR` | Parity |
| Multiple effects | Yes (applied in order) | Yes (`effects[]` array) | Parity |
| Effect visibility toggle | — | `visible` per effect | **Figma-only** |
| Effect spread | — | `spread` on shadows | **Figma-only** |

### Other Appearance

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Opacity | Likely supported | `opacity` (0-1) | Parity |
| Blend mode | — | Full set (NORMAL through LUMINOSITY) | **Figma-only** |
| Corner radius | `cornerRadius` | `cornerRadius` + per-corner | Partial — need to verify .pen per-corner support |
| Rotation | — | `rotation` (0-360) | **Figma-only** |
| Visibility | — | `visible` | **Figma-only** |
| Locking | — | `locked` | **Figma-only** |
| Clip content | — | `clipsContent` | **Figma-only** |

## 4. Typography

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Font family | `fontFamily` | `fontName.family` | Parity |
| Font size | `fontSize` | `fontSize` | Parity |
| Font weight | `fontWeight` | `fontName.style` / `fontWeight` | Parity |
| Font style (italic) | — | `fontName.style` / `fontStyle` | **Figma-only** (as separate property) |
| Text content | `content` | `characters` | Parity (different naming) |
| Text alignment (horizontal) | — | `textAlignHorizontal` (LEFT, CENTER, RIGHT, JUSTIFIED) | **Figma-only** |
| Text alignment (vertical) | — | `textAlignVertical` (TOP, CENTER, BOTTOM) | **Figma-only** |
| Line height | — | `lineHeight` (px, %, AUTO) | **Figma-only** |
| Letter spacing | — | `letterSpacing` (px, %) | **Figma-only** |
| Text auto resize | — | `textAutoResize` (NONE, WIDTH_AND_HEIGHT, HEIGHT, TRUNCATE) | **Figma-only** |
| Text case | — | `textCase` (UPPER, LOWER, TITLE, SMALL_CAPS, etc.) | **Figma-only** |
| Text decoration | — | `textDecoration` (UNDERLINE, STRIKETHROUGH) | **Figma-only** |
| Paragraph spacing | — | `paragraphSpacing` | **Figma-only** |
| Paragraph indent | — | `paragraphIndent` | **Figma-only** |
| Leading trim | — | `leadingTrim` (CAP_HEIGHT, NONE) | **Figma-only** |
| Rich text / styled segments | — | `getStyledTextSegments()`, `setRange*()` | **Figma-only** |

> **Note:** The .pen schema (not available for review) may support many of these typography properties. The gap above is based on the documentation provided, which only shows `content`, `fontSize`, `fontFamily`, `fontWeight`, and `fill` on text nodes.

## 5. Components & Instances

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Reusable components | `reusable: true` | Component node type | Parity (different mechanism) |
| Instances | `type: "ref"` with `ref` property | Instance node type with `componentId` | Parity |
| Property overrides | Direct property override on ref | `componentProperties` map | Parity |
| Nested descendant overrides | `descendants` map with ID paths | Nested overrides via property keys | Partial — .pen's `descendants` map with `/` path syntax is more explicit; Figma uses property key suffixes like `Label#1:0` |
| Object replacement in descendants | `descendants` with `type` field triggers replacement | — | **Pen-only** — replace a descendant with a completely different object type |
| Children replacement | `descendants` with `children` array | — | **Pen-only** — replace all children of a descendant frame |
| Slots | `slot` property on frames | — | **Pen-only** — mark frames as intended insertion points with suggested component types |
| Variant properties | — | `VARIANT` property type, component sets | **Figma-only** |
| Component sets | — | `COMPONENT_SET` with variant grouping | **Figma-only** — .pen has no variant set concept |
| BOOLEAN properties | — | `BOOLEAN` component property (toggle visibility) | **Figma-only** |
| TEXT properties | — | `TEXT` component property (editable text) | **Figma-only** |
| INSTANCE_SWAP properties | — | `INSTANCE_SWAP` component property | **Figma-only** |
| Detach instance | — | `detach()` converts instance to frame | **Figma-only** |
| Reset overrides | — | `reset_overrides` | **Figma-only** |
| Swap component | — | `swap` to different component | **Figma-only** |

## 6. Variables & Theming

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Color variables | `type: "color"` | `COLOR` resolved type | Parity |
| Number variables | `type: "number"` | `FLOAT` resolved type | Parity |
| String variables | — | `STRING` resolved type | **Figma-only** |
| Boolean variables | — | `BOOLEAN` resolved type | **Figma-only** |
| Variable reference syntax | `$variable.name` prefix | Bound via `setBoundVariableForPaint()` / `bindings` | Partial — .pen uses inline `$` references; Figma uses explicit binding API |
| Variable collections | — | `VariableCollection` with modes | **Figma-only** — .pen has flat `variables` map |
| Variable scoping | — | `scopes` (restrict where variables appear in UI) | **Figma-only** |
| Variable aliases | — | `VARIABLE_ALIAS` (variable references another) | **Figma-only** |
| Multi-axis themes | `themes` with multiple axes (e.g. `mode` + `spacing`) | Modes within collections (single axis per collection) | **Pen-only** — .pen supports multi-dimensional themes natively; Figma requires multiple collections |
| Theme inheritance | `theme` property on objects propagates down | `explicitMode` pins mode on a frame | Partial — .pen's cascading `theme` is more flexible |
| Conditional variable values | Array of `{value, theme}` entries, last matching wins | One value per mode per variable | **Pen-only** — .pen's conditional resolution with "last match wins" is unique |
| Explicit mode pinning | Via `theme` property on objects | `explicitMode` with collection/mode names | Parity |

## 7. Styles (Reusable Style Definitions)

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Paint styles | — | Named paint styles with `paints[]` | **Figma-only** |
| Text styles | — | Named text styles (font, size, line-height, etc.) | **Figma-only** |
| Effect styles | — | Named effect styles with `effects[]` | **Figma-only** |
| Grid styles | — | Named grid styles with `layoutGrids[]` | **Figma-only** |

> **Note:** .pen uses variables for reusable values but does not have a separate "styles" concept. Variables serve a similar purpose for colors and numbers.

## 8. Document-Level Features

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Infinite canvas | Yes | Yes | Parity |
| Pages | — | Multiple pages per file | **Figma-only** |
| Export (PNG, JPG, SVG, PDF) | — | `exportAsync()` | **Figma-only** |
| Selection API | — | `currentPage.selection` | **Figma-only** |
| Viewport control | — | `viewport.scrollAndZoomIntoView()` | **Figma-only** |
| Plugin data | — | `getPluginData()` / `setPluginData()` | **Figma-only** |
| Node search | — | Search by name, type, parent | **Figma-only** |
| Clone / duplicate | — | `clone()` | **Figma-only** |
| Reparent / move | — | `reparent()` | **Figma-only** |
| Z-order control | — | `insertChild(index)` | **Figma-only** |

> **Note:** Many of these are runtime/API features rather than file-format features. The .pen format is a static document format, while Figma provides a runtime API.

## 9. Interactions & Prototyping

| Feature | .pen | Figma | Gap |
|---------|------|-------|-----|
| Click/hover triggers | — | Full prototyping (click, hover, drag, key press, delays) | **Figma-only** |
| Navigate actions | — | Navigate, swap overlay, open overlay, close overlay, etc. | **Figma-only** |
| Animations | — | Smart Animate, dissolve, push, slide | **Figma-only** |

## Summary: Key Gaps

### Features Figma has that .pen lacks:
1. **Blend modes** — full compositing mode set
2. **Constraints** — responsive resize behavior
3. **Variant system** — component sets with variant properties
4. **Component properties** — BOOLEAN, TEXT, INSTANCE_SWAP property types
5. **Advanced stroke** — per-side weight, alignment, cap, join, dash patterns
6. **Typography depth** — text alignment, line height, letter spacing, text case, decoration, paragraph settings, leading trim, rich text ranges
7. **Styles** — paint, text, effect, and grid styles as named reusable objects
8. **String/Boolean variables** — .pen only has color and number
9. **Variable scoping and aliases** — restricting variable applicability
10. **Multiple pages** — document-level page organization
11. **Prototyping/interactions** — triggers, actions, animations
12. **Rotation, visibility, locking** — node-level display controls
13. **Groups and sections** — non-layout containers and organizational sections
14. **Clip content** — overflow clipping control
15. **Diamond gradient** — fourth gradient type
16. **Individual fill/effect visibility** — toggling layers
17. **Min/max sizing** — responsive constraints for auto-layout
18. **Absolute positioning in auto-layout** — floating children

### Features .pen has that Figma lacks:
1. **Mesh gradients** — complex multi-point gradient type
2. **Multi-axis theming** — e.g. `mode: dark` + `spacing: condensed` simultaneously
3. **Conditional variable resolution** — array of `{value, theme}` with "last match wins"
4. **Slots** — mark frames as insertion points with suggested component types
5. **Object replacement in instances** — swap descendant for entirely different object type
6. **Children replacement in instances** — replace all children of a descendant
7. **Stroke with multiple fills** — single stroke painted with multiple fill layers
8. **Icon font node type** — native icon font rendering
9. **Connector node type** — native arrow/connector between objects
10. **Inline variable references** — `$var.name` syntax directly in properties
