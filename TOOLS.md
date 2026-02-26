# TalkToFigma MCP — Tool Reference

> 76 tools, 5 prompts

## Read / Query

### `get_document_info`

Get the document name, current page, and list of all pages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `get_current_page`

Get the current page info and its top-level children. Always safe — never touches unloaded pages.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `get_pages`

Get all pages in the document with their IDs, names, and child counts.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `get_selection`

Get information about the current selection in Figma

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `read_my_design`

Get detailed information about the current selection, including all node details. Use depth to control traversal.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `depth` | number | no | Levels of children to recurse. 0=selection only, -1 or omit for unlimited. |

### `get_node_info`

Get detailed information about one or more nodes. Always pass an array of IDs. Use `fields` to select only the properties you need (reduces context size).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeIds` | string[] | yes | Array of node IDs. Example: ["1:2","1:3"] |
| `depth` | number | no | Child recursion depth (default: unlimited). 0=stubs only. |
| `fields` | string[] | no | Whitelist of property names to include. Always includes id, name, type. Example: ["absoluteBoundingBox","layoutMode","fills"]. Omit to return all properties. |

### `get_node_css`

Get CSS properties for a node (useful for dev handoff)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | yes | The node ID to get CSS for |

### `get_available_fonts`

Get available fonts in Figma. Optionally filter by query string.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Filter fonts by name (case-insensitive). Omit to list all fonts. |

### `get_component_by_id`

Get detailed component info including property definitions and variants.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `componentId` | string | yes | Component node ID |
| `includeChildren` | boolean | no | For COMPONENT_SETs: include variant children (default false) |

### `get_instance_overrides`

Get override properties from a component instance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | no | Instance node ID (uses selection if omitted) |

### `get_styles`

List local styles (paint, text, effect, grid). Returns IDs and names only.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `get_style_by_id`

Get detailed style info by ID. Returns full paint/font/effect/grid details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `styleId` | string | yes | Style ID |

### `get_local_variables`

List local variables. Pass includeValues:true to get all mode values in bulk (avoids N separate get_variable_by_id calls).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | "COLOR" \| "FLOAT" \| "STRING" \| "BOOLEAN" | no | Filter by type |
| `collectionId` | string | no | Filter by collection. Omit for all collections. |
| `includeValues` | boolean | no | Include valuesByMode for each variable (default: false) |

### `get_local_variable_collections`

List all local variable collections.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|

### `get_variable_by_id`

Get detailed variable info including all mode values.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `variableId` | string | yes | Variable ID |

### `get_variable_collection_by_id`

Get detailed variable collection info including modes and variable IDs.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `collectionId` | string | yes | Collection ID |

## Modify / Set

### `set_current_page`

Switch to a different page. Provide either pageId or pageName.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `pageId` | string | no | The page ID to switch to |
| `pageName` | string | no | The page name (case-insensitive, partial match) |

### `rename_page`

Rename a page. Defaults to current page if no pageId given.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `newName` | string | yes | New name for the page |
| `pageId` | string | no | Page ID (default: current page) |

### `set_selection`

Set selection to nodes and scroll viewport to show them. Also works as focus (single node).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeIds` | string[] | yes | Array of node IDs to select. Example: ["1:2","1:3"] |

### `set_viewport`

Set viewport center position and/or zoom level

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `center` | {x, y} | no | Viewport center point. Omit to keep current center. |
| `zoom` | number | no | Zoom level (1 = 100%). Omit to keep current zoom. |

### `set_fill_color`

Set fill color on nodes. Use styleName to apply a paint style by name, or provide color directly. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, color, styleName}[] | yes | Array of {nodeId, color?, styleName?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_stroke_color`

Set stroke color on nodes. Use styleName to apply a paint style by name. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, color, strokeWeight, styleName}[] | yes | Array of {nodeId, color?, strokeWeight?, styleName?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_corner_radius`

Set corner radius on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, radius, corners}[] | yes | Array of {nodeId, radius, corners?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_opacity`

Set opacity on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, opacity}[] | yes | Array of {nodeId, opacity} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_layout_mode`

Set layout mode and wrap on frames. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, layoutMode, layoutWrap}[] | yes | Array of {nodeId, layoutMode, layoutWrap?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_padding`

Set padding on auto-layout frames. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, paddingTop, paddingRight, ...}[] | yes | Array of {nodeId, paddingTop?, paddingRight?, paddingBottom?, paddingLeft?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_axis_align`

Set primary/counter axis alignment on auto-layout frames. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, primaryAxisAlignItems, counterAxisAlignItems}[] | yes | Array of {nodeId, primaryAxisAlignItems?, counterAxisAlignItems?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_layout_sizing`

Set horizontal/vertical sizing modes on auto-layout nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, layoutSizingHorizontal, layoutSizingVertical}[] | yes | Array of {nodeId, layoutSizingHorizontal?, layoutSizingVertical?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_item_spacing`

Set spacing between children in auto-layout frames. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, itemSpacing, counterAxisSpacing}[] | yes | Array of {nodeId, itemSpacing?, counterAxisSpacing?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_effects`

Set effects (shadows, blurs) on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, effects}[] | yes | Array of {nodeId, effects} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_constraints`

Set constraints on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, horizontal, vertical}[] | yes | Array of {nodeId, horizontal, vertical} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_export_settings`

Set export settings on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, settings}[] | yes | Array of {nodeId, settings} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_node_properties`

Set arbitrary properties on nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, properties}[] | yes | Array of {nodeId, properties} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_text_content`

Set text content on text nodes. Batch: pass multiple items to replace text in multiple nodes at once.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, text}[] | yes | Array of {nodeId, text} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_text_properties`

Set font properties on existing text nodes (fontSize, fontWeight, fontColor, textStyle). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, fontSize, fontWeight, ...}[] | yes | Array of {nodeId, fontSize?, fontWeight?, fontColor?, ...} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `combine_as_variants`

Combine components into variant sets. Name components with 'Property=Value' pattern (e.g. 'Style=Primary', 'Size=Large') BEFORE combining — Figma derives variant properties from component names. Avoid slashes in names. The resulting set is placed in the components' shared parent (or page root if parents differ). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {componentIds, name}[] | yes | Array of {componentIds, name?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `add_component_property`

Add properties to components. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {componentId, propertyName, type, ...}[] | yes | Array of {componentId, propertyName, type, defaultValue, preferredValues?} |

### `remove_style`

Delete a style by ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `styleId` | string | yes | Style ID to remove |

### `apply_style_to_node`

Apply a style to nodes by ID or name. Use styleName for convenience (case-insensitive). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, styleId, styleName, styleType}[] | yes | Array of {nodeId, styleId?, styleName?, styleType} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `set_variable_value`

Set variable values for modes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {variableId, modeId, value}[] | yes | Array of {variableId, modeId, value} |

### `set_variable_binding`

Bind variables to node properties. Common fields: 'fills/0/color', 'strokes/0/color', 'opacity', 'topLeftRadius', 'itemSpacing'. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, field, variableId}[] | yes | Array of {nodeId, field, variableId} |

### `add_mode`

Add modes to variable collections. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {collectionId, name}[] | yes | Array of {collectionId, name} |

### `rename_mode`

Rename modes in variable collections. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {collectionId, modeId, name}[] | yes | Array of {collectionId, modeId, name} |

### `remove_mode`

Remove modes from variable collections. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {collectionId, modeId}[] | yes | Array of {collectionId, modeId} |

## Create

### `create_page`

Create a new page in the document

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | no | Name for the new page (default: 'New Page') |

### `create_rectangle`

Create rectangles (leaf nodes — cannot have children). For containers/cards/panels, use create_frame instead. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of rectangles to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_ellipse`

Create ellipses (leaf nodes — cannot have children). For circular containers, use create_frame with cornerRadius instead. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of ellipses to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_line`

Create lines (leaf nodes — cannot have children). For dividers inside layouts, use create_frame with a thin height and fill color instead. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of lines to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_section`

Create section nodes to organize content on the canvas.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of sections to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_node_from_svg`

Create nodes from SVG strings.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {svg, name, x, ...}[] | yes | Array of SVG items to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_boolean_operation`

Create a boolean operation (union, intersect, subtract, exclude) from multiple nodes.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeIds, operation, name}[] | yes | Array of boolean operations to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_frame`

Create frames in Figma. Supports batch (multiple items). Default: transparent fill, no stroke, no auto-layout. Use fillStyleName/strokeStyleName to apply styles by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of frames to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_auto_layout`

Wrap existing nodes in an auto-layout frame. One call replaces create_frame + set_layout_mode + insert_child × N.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeIds, name, layoutMode, ...}[] | yes | Array of auto-layout wraps to perform |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_text`

Create text nodes in Figma. Uses Inter font. Max 5 items per batch. Use textStyleName to apply styles by name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {text, name, x, ...}[] | yes | Array of text nodes to create (max 5) |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_component`

Create components in Figma. Same layout params as create_frame. Name with 'Property=Value' pattern (e.g. 'Size=Small') if you plan to combine_as_variants later. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, x, y, ...}[] | yes | Array of components to create |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_component_from_node`

Convert existing nodes into components. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId}[] | yes | Array of {nodeId} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_instance_from_local`

Create instances of local components. For COMPONENT_SET, use variantProperties to pick a specific variant (e.g. {"Style":"Secondary"}). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {componentId, variantProperties, x, ...}[] | yes | Array of {componentId, x?, y?, parentId?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `create_paint_style`

Create color/paint styles. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, color}[] | yes | Array of {name, color} |

### `create_text_style`

Create text styles. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, fontFamily, fontStyle, ...}[] | yes | Array of text style definitions |

### `create_effect_style`

Create effect styles (shadows, blurs). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name, effects}[] | yes | Array of {name, effects} |

### `create_variable_collection`

Create variable collections. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {name}[] | yes | Array of {name} |

### `create_variable`

Create variables in a collection. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {collectionId, name, resolvedType}[] | yes | Array of {collectionId, name, resolvedType} |

## Navigation

### `zoom_into_view`

Zoom the viewport to fit specific nodes (like pressing Shift+1)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeIds` | string[] | yes | Array of node IDs to zoom into |

### `join_channel`

REQUIRED FIRST STEP: Join a channel before using any other tool. The channel name is shown in the Figma plugin UI. All subsequent commands are sent through this channel.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `channel` | string | no | The channel name displayed in the Figma plugin panel (e.g. 'channel-abc-123') |

## Search / Export

### `search_nodes`

Search for nodes by layer name and/or type. Searches current page only — use set_current_page to switch pages first. Matches layer names (text nodes are often auto-named from their content). Returns paginated results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Name search (case-insensitive substring). Omit to match all names. |
| `types` | string[] | no | Filter by types. Example: ["FRAME","TEXT"]. Omit to match all types. |
| `scopeNodeId` | string | no | Node ID to search within (defaults to current page) |
| `caseSensitive` | boolean | no | Case-sensitive name match (default false) |
| `limit` | number | no | Max results (default 50) |
| `offset` | number | no | Skip N results for pagination (default 0) |

### `export_node_as_image`

Export a node as an image from Figma

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | yes | The node ID to export |
| `format` | "PNG" \| "JPG" \| "SVG" \| "PDF" | no | Export format (default: PNG) |
| `scale` | number | no | Export scale (default: 1) |

### `scan_text_nodes`

Scan all text nodes within a node tree. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, limit, includePath, includeGeometry}[] | yes | Array of {nodeId} |

### `search_components`

Search local components and component sets across all pages. Returns component id, name, and which page it lives on.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Filter by name (case-insensitive substring). Omit to list all. |
| `setsOnly` | boolean | no | If true, return only COMPONENT_SET nodes |
| `limit` | number | no | Max results (default 100) |
| `offset` | number | no | Skip N results (default 0) |

## Transform

### `move_node`

Move nodes to new positions. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, x, y}[] | yes | Array of {nodeId, x, y} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `resize_node`

Resize nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, width, height}[] | yes | Array of {nodeId, width, height} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `delete_node`

Delete nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId}[] | yes | Array of {nodeId} |

### `clone_node`

Clone nodes. Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, x, y}[] | yes | Array of {nodeId, x?, y?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `insert_child`

Move nodes into a parent at a specific index (reorder/reparent). Batch: pass multiple items.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {parentId, childId, index}[] | yes | Array of {parentId, childId, index?} |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

## Lint

### `lint_node`

Run design linter on a node tree. Returns issues grouped by category with affected node IDs and fix instructions. Lint child nodes individually for large trees.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `nodeId` | string | no | Node ID to lint. Omit to lint current selection. |
| `rules` | "no-autolayout" \| "shape-instead-of-frame" \| "hardcoded-color" \| "no-text-style" \| "fixed-in-autolayout" \| "default-name" \| "empty-container" \| "stale-text-name" \| "all"[] | no | Rules to run. Default: ["all"]. Options: no-autolayout, shape-instead-of-frame, hardcoded-color, no-text-style, fixed-in-autolayout, default-name, empty-container, stale-text-name, all |
| `maxDepth` | number | no | Max depth to recurse (default: 10) |
| `maxFindings` | number | no | Stop after N findings (default: 50) |

### `lint_fix_autolayout`

Auto-fix: convert frames with multiple children to auto-layout. Takes node IDs from lint_node 'no-autolayout' results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, layoutMode, itemSpacing}[] | yes | Array of frames to convert to auto-layout |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

### `lint_fix_replace_shape_with_frame`

Auto-fix: replace shapes with frames preserving visual properties. Overlapping siblings are re-parented into the new frame. Use after lint_node 'shape-instead-of-frame' results.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `items` | {nodeId, adoptChildren}[] | yes | Array of shapes to convert to frames |
| `depth` | number | no | Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited. |

## Prompts

### `design_strategy`

Best practices for working with Figma designs

### `read_design_strategy`

Best practices for reading Figma designs

### `text_replacement_strategy`

Systematic approach for replacing text in Figma designs

### `annotation_conversion_strategy`

Strategy for converting manual annotations to Figma's native annotations

### `swap_overrides_instances`

Guide to swap instance overrides between instances

