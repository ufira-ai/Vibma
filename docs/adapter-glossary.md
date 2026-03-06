# Adapter Glossary

Cross-platform design concept mapping for Vibma adapters.
Each section defines a concept, then maps it across platforms.

---

## 1. Document Structure

### File / Project / Site

The top-level container that holds all pages and assets.

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | File | Identified by file key in URL |
| **Penpot** | File | Has `id`, `name`, `revn` (revision number). Can export as `.penpot` or `.zip` |
| **Webflow** | Site | Identified by `siteId`. Contains pages, CMS, assets, settings |
| **Framer** | Project | Identified by project URL. Contains pages, components, code files |
| **Canva** | Design | Types: `doc`, `whiteboard`, `presentation`, or custom dimensions (40-8000px) |

### Page

A discrete canvas or screen within a file.

| Platform | Term | Creation | Notes |
|----------|------|----------|-------|
| **Figma** | Page | `figma.createPage()` | Infinite canvas. Multiple pages per file |
| **Penpot** | Page | Plugin API | Has `root` shape, ruler guides, flows. `findShapes()` for querying |
| **Webflow** | Page | `create_page` | Maps to a URL route. Has SEO properties, slug. Organized in folders |
| **Framer** | Page | `createPage` | Two types: **Web Page** (published URL) and **Design Page** (canvas only) |
| **Canva** | Page | `addPage()` | 1-based index. Has dimensions, background fill, elements list. Max 25M sq px |

---

## 2. Containers

### Frame / Board / Section

The primary layout container that holds child elements.

| Platform | Term | Key Properties |
|----------|------|----------------|
| **Figma** | Frame | Auto-layout, clip content, constraints, fills, strokes, effects |
| **Penpot** | Board | `clipContent`, `showInViewMode`, `grid`, `flex`, `horizontalSizing`, `verticalSizing` |
| **Webflow** | Section / DivBlock | `Section` = full-width page section. `DivBlock` = generic div. `BlockContainer` = max-width centered |
| **Framer** | FrameNode | Backgrounds, borders, layout (stack/grid), overflow, position |
| **Canva** | Group | 2+ child elements. Coordinates inside are **relative units**, not pixels |

### Section (organizational)

A higher-level grouping for canvas organization.

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | Section | Canvas-level organizer, distinct from Frame |
| **Penpot** | _(none)_ | Use named Boards for organization |
| **Webflow** | Section | HTML `<section>` element — structural, not just organizational |
| **Framer** | _(none)_ | Use Frames on canvas |
| **Canva** | _(none)_ | No equivalent |

### Group

A non-layout container that groups elements together.

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | Group | No layout properties. Children keep absolute positions |
| **Penpot** | Group | Has `isMask()`, `makeMask()`, `removeMask()`. Children array |
| **Webflow** | _(none)_ | Everything is a div — no pure grouping concept |
| **Framer** | _(none)_ | Not a distinct node type |
| **Canva** | Group | 2+ elements. Cannot contain tables, videos, or other groups |

---

## 3. Layout

### Auto Layout / Flex

One-dimensional flow layout (horizontal or vertical).

| Platform | Term | Direction | Alignment | Distribution | Gap | Wrap |
|----------|------|-----------|-----------|-------------|-----|------|
| **Figma** | Auto Layout | `HORIZONTAL` / `VERTICAL` | `MIN` / `CENTER` / `MAX` / `STRETCH` / `BASELINE` | `PACKED` / `SPACE_BETWEEN` | `itemSpacing` | `WRAP` / `NO_WRAP` |
| **Penpot** | Flex Layout | `row` / `row-reverse` / `column` / `column-reverse` | `start` / `center` / `end` / `stretch` | `start` / `center` / `end` / `space-between` / `space-around` / `space-evenly` / `stretch` | `rowGap` / `columnGap` | `wrap` / `nowrap` |
| **Webflow** | Flexbox | `row` / `column` / `row-reverse` / `column-reverse` | `flex-start` / `center` / `flex-end` / `stretch` / `baseline` | `flex-start` / `center` / `flex-end` / `space-between` / `space-around` / `space-evenly` | `gap` / `row-gap` / `column-gap` | `nowrap` / `wrap` / `wrap-reverse` |
| **Framer** | Stack | `vertical` / `horizontal` | Cross-axis alignment | `start` / `center` / `end` / `space-between` / `space-around` / `evenly` | `gap` | Yes |
| **Canva** | _(none)_ | Absolute positioning only | N/A | N/A | N/A | N/A |

### Grid Layout

Two-dimensional layout with rows and columns.

| Platform | Term | Tracks | Notes |
|----------|------|--------|-------|
| **Figma** | _(none)_ | Layout Grids are visual guides only, not structural | No CSS Grid equivalent |
| **Penpot** | Grid Layout | `rows: Track[]`, `columns: Track[]`. Types: `flex` / `fixed` / `percent` / `auto` | Full CSS Grid. `addRow()`, `addColumn()`, `appendChild(child, row, col)` |
| **Webflow** | Grid | CSS Grid. `grid-template-columns`, `grid-template-rows`, all standard properties | Also has QuickStack (hybrid grid+flex) |
| **Framer** | Grid Layout | Grid properties for rows/columns | Introduced in Plugins 3.6 |
| **Canva** | _(none)_ | No grid layout | Table element exists but is data-oriented, not layout |

### Padding

Internal spacing within a container.

| Platform | Properties |
|----------|-----------|
| **Figma** | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` (or symmetric `horizontalPadding`, `verticalPadding`) |
| **Penpot** | `topPadding`, `rightPadding`, `bottomPadding`, `leftPadding` (or `horizontalPadding`, `verticalPadding`) |
| **Webflow** | `padding-top`, `padding-right`, `padding-bottom`, `padding-left` (CSS longhand only, no shorthand) |
| **Framer** | `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` (or shorthand `padding`) |
| **Canva** | N/A — no layout system |

### Child Sizing

How a child element sizes itself within a layout.

| Platform | Fill Parent | Hug Content | Fixed |
|----------|------------|-------------|-------|
| **Figma** | `FILL` | `HUG` | `FIXED` |
| **Penpot** | `fill` | `fit-content` | `fix` (child) / `auto` (parent) |
| **Webflow** | `flex-grow: 1` or `width: 100%` | Default (content-driven) | Explicit pixel/rem values |
| **Framer** | `Fill` | `Fit Content` | `Fixed` (explicit px/rem) |
| **Canva** | N/A | N/A | Explicit pixel dimensions |

---

## 4. Positioning

### Coordinate System

| Platform | Origin | Units | Notes |
|----------|--------|-------|-------|
| **Figma** | Top-left of parent | Pixels (float) | Absolute within frame, relative in auto-layout |
| **Penpot** | Top-left of parent | Pixels. Also `boardX`/`boardY` (relative to containing board), `parentX`/`parentY` | |
| **Webflow** | CSS box model | `px`, `rem`, `em`, `vw`, `vh`, `%`, `auto` | Position: `static` / `relative` / `absolute` / `fixed` / `sticky` |
| **Framer** | Top-left of parent | Pixels/rem/vw/vh | Position: relative / absolute / fixed / sticky. Pin constraints |
| **Canva** | Top-left of page | Pixels (-32768 to 32767). Inside groups: **relative units** (not pixels) | |

### Constraints (Responsive Pinning)

How elements respond when their parent resizes.

| Platform | Horizontal | Vertical |
|----------|-----------|----------|
| **Figma** | `LEFT` / `RIGHT` / `LEFT_RIGHT` / `CENTER` / `SCALE` | `TOP` / `BOTTOM` / `TOP_BOTTOM` / `CENTER` / `SCALE` |
| **Penpot** | `left` / `right` / `leftright` / `center` / `scale` | `top` / `bottom` / `topbottom` / `center` / `scale` |
| **Webflow** | CSS positioning + responsive breakpoints | Same |
| **Framer** | Pin to edges (left/right/top/bottom). Absolute/fixed/sticky | Same |
| **Canva** | N/A | N/A |

---

## 5. Primitives

### Shape Types

| Shape | Figma | Penpot | Webflow | Framer | Canva |
|-------|-------|--------|---------|--------|-------|
| Rectangle | `RECTANGLE` | `rectangle` | DivBlock + style | FrameNode | `rect` (Design Editing API) |
| Ellipse | `ELLIPSE` | `ellipse` | DivBlock + `border-radius: 50%` | FrameNode + radius | Shape with SVG path |
| Path / Vector | `VECTOR` | `path` | _(none)_ | SVGNode | `shape` (SVG paths, max 30 paths) |
| Text | `TEXT` | `text` | Heading / Paragraph / TextBlock | TextNode | `text` (plain) / `richtext` (formatted) |
| Image | `IMAGE` (fill on rectangle) | `image` | Image element | FrameNode + `backgroundImage` | `rect` with ImageFill |
| SVG | `VECTOR` | `svg-raw` | HtmlEmbed | SVGNode via `addSvg()` | `shape` (limited SVG commands) |
| Boolean | `BOOLEAN_OPERATION` | `boolean` (union/difference/exclude/intersection) | _(none)_ | _(none)_ | _(none)_ |
| Line | `LINE` | Path with 2 points | DivBlock + border | FrameNode (1px height) | Shape with line path |

### Creation Methods

| Platform | Rectangle | Text | Image |
|----------|-----------|------|-------|
| **Figma** | `figma.createRectangle()` | `figma.createText()` | Set `fills` with image hash on any shape |
| **Penpot** | `penpot.createRectangle()` | `penpot.createText(value)` | Upload via `uploadMediaUrl()`, set as `fillImage` |
| **Webflow** | `element.append(webflow.elementPresets.DivBlock)` | `element.append(webflow.elementPresets.Paragraph)` + `setText()` | `element.append(webflow.elementPresets.Image)` + `setAsset()` |
| **Framer** | `createFrame` + dimensions | `addText` / `setText` | `addImageFromUrl(parentId, url, attrs, fit)` |
| **Canva** | `createRectElement()` | `createTextElement()` + `createRichtextRange()` | `addElementAtPoint({ type: 'image', ... })` |

---

## 6. Appearance

### Fill

| Platform | Solid Color | Gradient | Image Fill |
|----------|------------|----------|------------|
| **Figma** | `{ type: 'SOLID', color: {r,g,b}, opacity }` | `{ type: 'GRADIENT_LINEAR', gradientStops, gradientTransform }` | `{ type: 'IMAGE', imageHash, scaleMode }` |
| **Penpot** | `{ fillColor: '#FF5733', fillOpacity: 0.5 }` | `{ fillColorGradient: { type: 'linear'/'radial', startX, startY, endX, endY, stops } }` | `{ fillImage: ImageData }` |
| **Webflow** | CSS `background-color: #ff5733` | CSS `background-image: linear-gradient(...)` | CSS `background-image: url(...)` |
| **Framer** | `backgroundColor: 'rgba(242, 59, 57, 1)'` | `backgroundGradient` (linear/radial) | `backgroundImage` (asset reference) |
| **Canva** | `{ type: 'solid', color: '#ff0099' }` (6-char lowercase hex with `#`) | _(not exposed in API)_ | `{ type: 'image', imageRef }` |

### Stroke

| Platform | Properties |
|----------|-----------|
| **Figma** | `strokes[]`, `strokeWeight`, `strokeAlign` (INSIDE/OUTSIDE/CENTER), `strokeCap`, `strokeJoin`, `dashPattern` |
| **Penpot** | `strokes[]` with `strokeColor`, `strokeWidth`, `strokeAlignment` (center/inner/outer), `strokeStyle` (solid/dotted/dashed/mixed/none/svg), `strokeCapStart`/`strokeCapEnd` |
| **Webflow** | CSS `border-*` properties (longhand only): `border-top-width`, `border-top-style`, `border-top-color`, etc. |
| **Framer** | `border` trait (added Plugins 3.6+) |
| **Canva** | `stroke.weight` (0-100), `stroke.colorContainer`, `strokeAlign: 'inset'` only |

### Corner Radius

| Platform | Uniform | Per-Corner |
|----------|---------|------------|
| **Figma** | `cornerRadius` | `topLeftRadius`, `topRightRadius`, `bottomLeftRadius`, `bottomRightRadius` |
| **Penpot** | `borderRadius` | `borderRadiusTopLeft`, `borderRadiusTopRight`, `borderRadiusBottomRight`, `borderRadiusBottomLeft` |
| **Webflow** | `border-radius` | `border-top-left-radius`, `border-top-right-radius`, `border-bottom-left-radius`, `border-bottom-right-radius` |
| **Framer** | `borderRadius` | Per-corner object |
| **Canva** | _(not exposed in API)_ | _(not exposed in API)_ |

### Opacity

| Platform | Property | Range |
|----------|---------|-------|
| **Figma** | `opacity` | 0-1 |
| **Penpot** | `opacity` | 0-1 |
| **Webflow** | CSS `opacity` | 0-1 |
| **Framer** | `opacity` | 0-1 |
| **Canva** | `transparency` | _(range not specified)_ |

### Blend Mode

| Platform | Property | Values |
|----------|---------|--------|
| **Figma** | `blendMode` | `NORMAL`, `DARKEN`, `MULTIPLY`, `COLOR_BURN`, `LIGHTEN`, `SCREEN`, `COLOR_DODGE`, `OVERLAY`, `SOFT_LIGHT`, `HARD_LIGHT`, `DIFFERENCE`, `EXCLUSION`, `HUE`, `SATURATION`, `COLOR`, `LUMINOSITY` |
| **Penpot** | `blendMode` | `normal`, `darken`, `multiply`, `color-burn`, `lighten`, `screen`, `color-dodge`, `overlay`, `soft-light`, `hard-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity` |
| **Webflow** | CSS `mix-blend-mode` | Standard CSS values |
| **Framer** | _(not documented in Plugin API)_ | |
| **Canva** | _(not exposed in API)_ | |

---

## 7. Effects

### Shadow

| Platform | Property | Model |
|----------|---------|-------|
| **Figma** | `effects[]` | `{ type: 'DROP_SHADOW'/'INNER_SHADOW', color, offset, radius, spread, visible }` |
| **Penpot** | `shadows[]` | `{ style: 'drop-shadow'/'inner-shadow', offsetX, offsetY, blur, spread, color, hidden }` |
| **Webflow** | CSS `box-shadow` | Standard CSS box-shadow values |
| **Framer** | Box Shadow | Via UI effects panel. Programmatic via Code Components only |
| **Canva** | _(not exposed in API)_ | |

### Blur

| Platform | Property | Model |
|----------|---------|-------|
| **Figma** | `effects[]` | `{ type: 'LAYER_BLUR'/'BACKGROUND_BLUR', radius }` |
| **Penpot** | `blur` | `{ type: 'layer-blur', value, hidden }` (single blur per shape) |
| **Webflow** | CSS `filter: blur()` / `backdrop-filter: blur()` | Standard CSS |
| **Framer** | Blur filter | Via UI or Code Components |
| **Canva** | _(not exposed in API)_ | |

---

## 8. Typography

### Text Properties

| Property | Figma | Penpot | Webflow | Framer | Canva |
|----------|-------|--------|---------|--------|-------|
| Font family | `fontName.family` | `fontFamily` / `fontId` | CSS `font-family` | Font via `searchFonts()` | `fontRef` (paragraph-level only) |
| Font size | `fontSize` | `fontSize` | CSS `font-size` | `fontSize` | `fontSize` (1-100px, shown as pt in UI) |
| Font weight | `fontName.style` | `fontWeight` | CSS `font-weight` (100-900) | `fontWeight` | `fontWeight` (named: thin/light/normal/medium/semibold/bold/ultrabold/heavy) |
| Font style | Part of `fontName.style` | `fontStyle` (normal/italic) | CSS `font-style` | _(via font variant)_ | `fontStyle` (normal/italic) |
| Line height | `lineHeight` | `lineHeight` | CSS `line-height` | `lineHeight` | _(not exposed)_ |
| Letter spacing | `letterSpacing` | `letterSpacing` | CSS `letter-spacing` | `letterSpacing` | _(not exposed)_ |
| Text align | `textAlignHorizontal` | `align` | CSS `text-align` | `textAlign` | `textAlign` (start/center/end/justify) |
| Text transform | `textCase` | `textTransform` (uppercase/capitalize/lowercase) | CSS `text-transform` | `textTransform` | _(not exposed)_ |
| Text decoration | `textDecoration` | `textDecoration` | CSS `text-decoration` | `textDecoration` | `decoration` (none/underline), `strikethrough` |
| Vertical align | `textAlignVertical` | `verticalAlign` | N/A (CSS) | _(not documented)_ | _(not exposed)_ |
| Text sizing | `textAutoResize` (WIDTH_AND_HEIGHT / HEIGHT / NONE) | `growType` (fixed / auto-width / auto-height) | CSS `width`/`height` | _(not documented)_ | _(not exposed)_ |

### Rich Text / Text Ranges

| Platform | Approach |
|----------|---------|
| **Figma** | `node.getStyledTextSegments()` returns segments with individual formatting. `node.setRangeFontSize(start, end, size)` etc. |
| **Penpot** | `text.getRange(start?, end?)` returns `TextRange` with per-range formatting methods |
| **Webflow** | Rich Text element with HTML. Heading levels via `setHeadingLevel(1-6)` |
| **Framer** | `setText()` on TextNode. Rich formatting via Text Styles |
| **Canva** | `createRichtextRange()` with `appendText(chars, formatting)`, `formatText(bounds, formatting)`, `formatParagraph(bounds, formatting)` |

---

## 9. Components

### Component Definition

The source of truth / master component.

| Platform | Term | Creation |
|----------|------|----------|
| **Figma** | Component | `figma.createComponent()` or convert existing frame |
| **Penpot** | Main Component | `penpot.library.local.createComponent(shapes)` returns `LibraryComponent` |
| **Webflow** | Component (formerly Symbol) | `webflow.registerComponent(rootElement)` |
| **Framer** | Design Component / Code Component | Design: visual on canvas. Code: React component with Property Controls |
| **Canva** | _(none)_ | No component system. App Elements are closest (locked groups with metadata) |

### Component Instance

A linked copy of a component definition.

| Platform | Term | Creation | Override Mechanism |
|----------|------|----------|-------------------|
| **Figma** | Instance | `component.createInstance()` | Component properties (TEXT/BOOLEAN/VARIANT/INSTANCE_SWAP), nested overrides |
| **Penpot** | Component Copy | `libraryComponent.instance()` | Overrides on copy. `detach()` to unlink. `swapComponent()` to switch |
| **Webflow** | Component Instance | `webflow.createInstance(definition)` | Component Properties (text, images, links — API not yet supported) |
| **Framer** | Instance | `components.insertByName(name, parentId, attrs, props)` | Props via Property Controls. Variants for states |
| **Canva** | _(none)_ | App Elements have re-edit capability but are app-scoped | Metadata-driven re-rendering |

### Variants

Multiple states/configurations of a component.

| Platform | Term | Naming Convention | Selection |
|----------|------|-------------------|-----------|
| **Figma** | Variants (in Component Set) | `Property=Value` (e.g. `Size=Small, State=Active`) | Set via `variantProperties` |
| **Penpot** | Variants (in VariantContainer) | `property=value, property=value` (comma-separated) | `switchVariant(pos, value)`. `combineAsVariants(ids)` to create |
| **Webflow** | _(none)_ | No variant system | Use combo classes for state variations |
| **Framer** | Variants | Visual states on the canvas | Linked to interactions (hover, pressed) |
| **Canva** | _(none)_ | No variant system | |

---

## 10. Styles

### Paint / Color Style

Reusable color definitions.

| Platform | Term | Model |
|----------|------|-------|
| **Figma** | Paint Style | Named. Contains `paints[]` array (solid, gradient, image). Applied via style ID |
| **Penpot** | Library Color | Named. Has `color`, `opacity`, `gradient`, `image`. Methods: `asFill()`, `asStroke()` |
| **Webflow** | Color Variable | `ColorVariable` in a Variable Collection. Hex format. Used in style PropertyMaps |
| **Framer** | Color Style | Named. Has `light` and `dark` values (RGBA). Folders via `/` separator |
| **Canva** | _(none)_ | No reusable color system in design API. Brand Kit (Enterprise) for brand colors |

### Text Style / Typography

Reusable text formatting definitions.

| Platform | Term | Properties |
|----------|------|-----------|
| **Figma** | Text Style | Font family, size, weight, style, line height, letter spacing, paragraph spacing, text case, text decoration |
| **Penpot** | Library Typography | `fontId`, `fontFamily`, `fontVariantId`, `fontSize`, `fontWeight`, `fontStyle`, `lineHeight`, `letterSpacing`, `textTransform`. Applied via `applyToText(shape)` or `applyToTextRange(range)` |
| **Webflow** | Style (class) | CSS class with typography properties. No separate text style abstraction |
| **Framer** | Text Style | `tag`, `fontSize`, `lineHeight`, `fontWeight`, `fontStyle`, `letterSpacing`, `textAlign`, `textTransform`, `textDecoration`. Supports responsive breakpoints (up to 4) |
| **Canva** | _(none)_ | No reusable text style system |

### Effect Style

Reusable effect definitions (shadows, blur).

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | Effect Style | Contains `effects[]` array (shadows, blurs). Applied via style ID |
| **Penpot** | _(none)_ | No effect style abstraction. Effects set directly on shapes |
| **Webflow** | Style (class) | CSS class with `box-shadow`, `filter`, etc. |
| **Framer** | _(none)_ | Effects via UI or Code Components |
| **Canva** | _(none)_ | No effect system in API |

---

## 11. Design Tokens / Variables

### Variable Types

| Type | Figma | Penpot | Webflow | Framer | Canva |
|------|-------|--------|---------|--------|-------|
| Color | `COLOR` | W3C: Color | `ColorVariable` | Color Style (light/dark) | _(none)_ |
| Number | `FLOAT` | W3C: Number | `NumberVariable` (0-100) | _(none)_ | _(none)_ |
| String | `STRING` | _(via token)_ | _(none)_ | _(none)_ | _(none)_ |
| Boolean | `BOOLEAN` | _(via token)_ | _(none)_ | _(none)_ | _(none)_ |
| Size/Dimension | _(use FLOAT)_ | W3C: Dimension, Sizing, Spacing | `SizeVariable` (px/rem/em/vw/vh/svh/svw/ch) | _(none)_ | _(none)_ |
| Percentage | _(use FLOAT)_ | _(via token)_ | `PercentageVariable` (0-100) | _(none)_ | _(none)_ |
| Font Family | _(none)_ | W3C: Typography (composite) | `FontFamilyVariable` | _(none)_ | _(none)_ |
| Border Radius | _(use FLOAT)_ | W3C: Border Radius | _(use SizeVariable)_ | _(none)_ | _(none)_ |
| Stroke Width | _(use FLOAT)_ | W3C: Stroke Width | _(use SizeVariable)_ | _(none)_ | _(none)_ |
| Opacity | _(use FLOAT)_ | W3C: Opacity | _(use NumberVariable)_ | _(none)_ | _(none)_ |
| Shadow | _(none)_ | W3C: Shadow (composite) | _(none)_ | _(none)_ | _(none)_ |

### Variable Collections / Grouping

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | Variable Collection | Contains variables. Has modes. One default mode |
| **Penpot** | Token Set | W3C DTCG format. Sets grouped into Themes, Themes into Theme Groups (Mode/Brand/Contrast/Platform). **No plugin API yet** |
| **Webflow** | Variable Collection | Contains variables. Has modes. `createVariableCollection(name)` |
| **Framer** | _(none)_ | Color Styles and Text Styles serve as tokens. Figma variable sync available |
| **Canva** | _(none)_ | No variable system for design canvas |

### Variable Modes

Multiple values for the same variable in different contexts (e.g. light/dark theme).

| Platform | Term | Notes |
|----------|------|-------|
| **Figma** | Mode | Per-collection. Set explicit mode on frames to pin them |
| **Penpot** | Theme | Multidimensional — multiple themes can be active simultaneously across different groups |
| **Webflow** | Variable Mode | `createVariableMode()`. Can set mode on styles |
| **Framer** | Light / Dark | Built into Color Styles (two values: `light` and `dark`) |
| **Canva** | _(none)_ | |

### Variable Binding

Connecting a variable/token to a node property.

| Platform | Mechanism |
|----------|----------|
| **Figma** | `figma.variables.setBoundVariableForPaint()`, node `.boundVariables` property |
| **Penpot** | Tokens apply via UI (no plugin API yet). Fill/stroke ref via `fillColorRefId`/`fillColorRefFile` |
| **Webflow** | Use variable as value in `PropertyMap` when setting style properties |
| **Framer** | Apply Color Style to `backgroundColor`. Text Style to text nodes |
| **Canva** | N/A |

---

## 12. Selection & Navigation

### Selection

| Platform | Get | Set |
|----------|-----|-----|
| **Figma** | `figma.currentPage.selection` | `figma.currentPage.selection = [nodes]` |
| **Penpot** | `penpot.selection` | `penpot.selection = shapes` |
| **Webflow** | `webflow.getSelectedElement()` | `webflow.setSelectedElement(element)` |
| **Framer** | `selection.get()` / subscribe to selection | `selection.set([nodeId])` |
| **Canva** | _(not directly exposed)_ | _(not directly exposed)_ |

### Viewport / Navigation

| Platform | Method |
|----------|--------|
| **Figma** | `figma.viewport.scrollAndZoomIntoView(nodes)`, `figma.viewport.center`, `figma.viewport.zoom` |
| **Penpot** | `penpot.viewport` (read-only info) |
| **Webflow** | `webflow.switchPage(pageId)` |
| **Framer** | Page navigation, `getProjectXml` for full project tree |
| **Canva** | `addPage()`, page index navigation |

---

## 13. Export

| Platform | Formats | Method |
|----------|---------|--------|
| **Figma** | PNG, JPG, SVG, PDF | `node.exportAsync({ format, settings })` |
| **Penpot** | PNG, JPEG, SVG, PDF | `shape.export({ type, scale, suffix })` returns `Uint8Array`. Also `file.export('penpot'/'zip')`. Code gen: `generateMarkup()`, `generateStyle()` |
| **Webflow** | PNG (snapshot) | `element_snapshot_tool` captures base64 PNG. Publishing = live website |
| **Framer** | React code, images | `exportReactComponents`. Publishing via `publish()` + `deploy()` |
| **Canva** | PDF, JPG, PNG, GIF, PPTX, MP4 | `requestExport()` (Apps SDK) or REST export jobs. Download URLs expire in 24h |

---

## 14. Responsive Design / Breakpoints

| Platform | Approach | Breakpoints |
|----------|---------|-------------|
| **Figma** | Constraints + resize behavior | No breakpoints. Single canvas, constraints handle resize |
| **Penpot** | Constraints + responsive preview | Grid layout enables responsive. Constraints on shapes |
| **Webflow** | CSS breakpoints (cascade) | 7 breakpoints: `xxl` (1920+), `xl` (1440+), `large` (1280+), **`main`** (992+ base), `medium` (≤991), `small` (≤767), `tiny` (≤478). Base cascades both up and down |
| **Framer** | Desktop-first cascade | Desktop (1200px base), Tablet (810px), Mobile (390px). Customizable. Text Styles support per-breakpoint values |
| **Canva** | Fixed dimensions | No responsive. Each design has fixed dimensions |

---

## 15. Interactions & Prototyping

| Platform | Triggers | Actions | Animation |
|----------|---------|---------|-----------|
| **Figma** | Click, hover, drag, key press, mouse enter/leave, after delay, while pressing | Navigate, swap overlay, open overlay, close overlay, back, scroll to, open link, set variable | Smart Animate, dissolve, move in/out, push, slide |
| **Penpot** | `click`, `mouse-enter`, `mouse-leave`, `after-delay` | `navigate-to`, `open-overlay`, `toggle-overlay`, `close-overlay`, `previous-screen`, `open-url` | `dissolve`, `slide` (in/out + direction), `push` (direction). Easing: linear/ease/ease-in/ease-out/ease-in-out |
| **Webflow** | Mouse hover, click, scroll into view, page load, page scroll | CSS transitions + GSAP animations | Timeline-based custom animations. Pre-built: fade, slide, grow, spin, bounce, etc. **Not available via API** |
| **Framer** | Appear, hover, press/tap, scroll, loop, drag | Variant transitions, page transitions | Motion for React (code). UI effects panel (visual). Gesture props: `whileHover`, `whileTap`, `whileInView` |
| **Canva** | _(limited)_ | _(limited)_ | _(not exposed in API)_ |

---

## 16. CMS / Dynamic Content

Only applicable to web-oriented platforms.

| Platform | Has CMS | Structure | Field Types |
|----------|---------|-----------|-------------|
| **Figma** | No | | |
| **Penpot** | No | | |
| **Webflow** | Yes | Collection → Items → Fields | Plain Text, Rich Text, Image, Multi-Image, Video, Link, Email, Phone, Number, Date, Switch, Color, Option, File, Reference, Multi-Reference |
| **Framer** | Yes | Collection → Items → Fields. Managed (API-controlled) or Unmanaged (user). | `string`, `formattedText`, `number`, `boolean`, `date`, `image`, `file`, `link`, `color`, `enum`, `collectionReference`, `multiCollectionReference`, `array` |
| **Canva** | No | Brand Templates with Autofill datasets | `text`, `image`, `chart` (via Autofill API, Enterprise only) |

---

## 17. Publishing

| Platform | Publishes To | Method |
|----------|-------------|--------|
| **Figma** | N/A (design tool) | Shares via link, exports assets |
| **Penpot** | N/A (design tool) | View mode for prototypes. Exports as code (HTML/CSS/SVG) |
| **Webflow** | Live website | Built-in hosting. Custom domains. API-triggered publishing |
| **Framer** | Live website | `publish()` → staging, `deploy()` → production. `*.framer.app` subdomain or custom domain |
| **Canva** | Exports/downloads | Export as PDF/PNG/JPG/MP4/PPTX. Canva Websites (limited) |

---

## 18. Plugin Data / Storage

Per-plugin persistent data attached to design elements.

| Platform | Scoped Storage | Shared Storage | Global Storage |
|----------|---------------|----------------|----------------|
| **Figma** | `node.getPluginData(key)` / `setPluginData(key, value)` | `node.getSharedPluginData(namespace, key)` | `figma.root.getPluginData()` |
| **Penpot** | `shape.getPluginData(key)` / `setPluginData(key, value)` | `shape.getSharedPluginData(namespace, key)` | `penpot.localStorage.getItem(key)` (requires `allow:localstorage` permission) |
| **Webflow** | _(not documented)_ | _(not documented)_ | _(not documented)_ |
| **Framer** | Plugin data via CMS ManagedCollections | _(not documented)_ | _(not documented)_ |
| **Canva** | App Element metadata (max 5 KB) | _(none)_ | _(none)_ |

---

## 19. Events

| Event | Figma | Penpot | Webflow | Framer | Canva |
|-------|-------|--------|---------|--------|-------|
| Selection change | `figma.on('selectionchange')` | `penpot.on('selectionchange')` | `webflow.subscribe('selectedelement')` | Subscribe to selection | _(none)_ |
| Page change | `figma.on('currentpagechange')` | `penpot.on('pagechange')` | _(not documented)_ | _(not documented)_ | _(none)_ |
| Document change | `figma.on('documentchange')` | `penpot.on('contentsave')` | _(not documented)_ | _(not documented)_ | _(none)_ |
| Shape change | _(via documentchange)_ | `penpot.on('shapechange', cb, { shapeId })` | _(not documented)_ | _(not documented)_ | `registerOnElementChange` (App Elements only) |
| Theme change | _(none)_ | `penpot.on('themechange')` | _(none)_ | _(none)_ | _(none)_ |
| Breakpoint change | _(none)_ | _(none)_ | `webflow.subscribe('breakpointchange')` | _(not documented)_ | _(none)_ |

---

## 20. Color Formats

| Platform | Primary Format | Other Accepted Formats |
|----------|---------------|----------------------|
| **Figma** | `{ r: 0-1, g: 0-1, b: 0-1 }` + separate `opacity` | |
| **Penpot** | Hex string `'#FF5733'` + separate `opacity` (0-1) | |
| **Webflow** | Any CSS color: hex, rgb, rgba, hsl, hsla, named | Variables use hex `#ffcc11` or 8-digit hex with alpha |
| **Framer** | RGBA string `'rgba(242, 59, 57, 1)'` | Hex, RGB, HSL, CSS named |
| **Canva** | 6-char lowercase hex with `#`: `'#ff0099'` | No other formats accepted |

---

## 21. Z-Order / Layering

| Platform | Methods |
|----------|---------|
| **Figma** | `parent.insertChild(index, node)`. Lower index = further back |
| **Penpot** | `shape.bringToFront()`, `bringForward()`, `sendToBack()`, `sendBackward()`, `setParentIndex(index)` |
| **Webflow** | CSS `z-index`. DOM order determines render order |
| **Framer** | DOM/layer order in the canvas |
| **Canva** | `insertAfter()`, `insertBefore()`, `moveBefore()`, `moveAfter()` on element Lists |

---

## Platform API Access Summary

| Capability | Figma | Penpot | Webflow | Framer | Canva |
|-----------|-------|--------|---------|--------|-------|
| **Transport to tool** | Plugin (WebSocket bridge) | Plugin (WebSocket bridge) | Designer API (SSE/HTTP) | Server API (WebSocket) | Apps SDK (iframe) / REST |
| **Auth** | _(plugin, no auth)_ | _(plugin, no auth)_ | OAuth | API Key (site settings) | OAuth |
| **Read design** | Full | Full | Full | Full (XML representation) | Limited (pages, elements, text) |
| **Write design** | Full | Full | Full | Full | Limited (no layout, no effects, no gradients, no radius) |
| **Variables/Tokens** | Full CRUD | No plugin API yet | Full CRUD | Color/Text Styles only | None |
| **Components** | Full | Full | Full (properties API coming) | Full (design + code) | App Elements only |
| **CMS** | N/A | N/A | Full CRUD | Full (managed collections) | Autofill (Enterprise) |
| **Publish** | N/A | N/A | Yes | Yes (`publish` + `deploy`) | Export only |
| **Responsive** | Constraints only | Constraints + Grid | 7 breakpoints + cascade | 3+ breakpoints + cascade | Fixed dimensions |
