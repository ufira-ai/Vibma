import type { McpServer } from "./types";

export function registerPrompts(server: McpServer) {
  server.prompt(
    "design_strategy",
    "Best practices for working with Figma designs",
    () => ({
      messages: [{
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: `When working with Figma designs, follow these best practices:

1. Understand Before Creating:
   - Use get_document_info() to see pages and current page
   - Use get_styles() and get_local_variables() to discover existing design tokens
   - Plan layout hierarchy before creating elements

2. Use Design Tokens — Never Hardcode:
   - Colors: use fillStyleName/strokeStyleName (paint styles) or fillVariableId/strokeVariableId (variables)
   - Text: use textStyleName to apply text styles that control font size, weight, and line height together
   - Effects: use effectStyleName to apply shadow/blur styles
   - Only use raw fillColor/fontColor for one-off values not in the design system

3. Auto-Layout First:
   - Use create_frame() with layoutMode: "VERTICAL" or "HORIZONTAL" for every container
   - Set itemSpacing, padding, and alignment at creation time
   - Use layoutSizingHorizontal/Vertical: "FILL" for responsive children
   - Avoid absolute positioning — let auto-layout handle spacing

4. Naming Conventions:
   - Use descriptive, semantic names for all elements
   - Name components with Property=Value pattern (e.g. "Size=Small") before combine_as_variants

5. Variable Modes:
   - Use set_explicit_variable_mode() to pin a frame to a specific mode (e.g. Dark)
   - Use get_node_variables() to verify which variables are bound to a node

6. Quality Check — Run Lint:
   - After building a section, run lint_node() to catch common issues:
     * hardcoded-color: fills/strokes not using styles or variables
     * no-text-style: text without a text style applied
     * no-autolayout: frames with children but no auto-layout
     * default-name: nodes still named "Frame", "Rectangle", etc.
   - Use lint_fix_autolayout() and lint_fix_replace_shape_with_frame() to auto-fix
   - Lint early and often — it is cheaper to fix issues during creation than after`,
        },
      }],
      description: "Best practices for working with Figma designs",
    })
  );

  server.prompt(
    "read_design_strategy",
    "Best practices for reading Figma designs",
    () => ({
      messages: [{
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use read_my_design() to understand the current selection
   - If no selection ask user to select single or multiple nodes
`,
        },
      }],
      description: "Best practices for reading Figma designs",
    })
  );

  server.prompt(
    "text_replacement_strategy",
    "Systematic approach for replacing text in Figma designs",
    () => ({
      messages: [{
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: `# Intelligent Text Replacement Strategy

## 1. Analyze Design & Identify Structure
- Scan text nodes to understand the overall structure of the design
- Use AI pattern recognition to identify logical groupings:
  * Tables (rows, columns, headers, cells)
  * Lists (items, headers, nested lists)
  * Card groups (similar cards with recurring text fields)
  * Forms (labels, input fields, validation text)
  * Navigation (menu items, breadcrumbs)
\`\`\`
scan_text_nodes(nodeId: "node-id")
get_node_info(nodeId: "node-id")  // optional
\`\`\`

## 2. Strategic Chunking for Complex Designs
- Divide replacement tasks into logical content chunks based on design structure
- Use one of these chunking strategies that best fits the design:
  * **Structural Chunking**: Table rows/columns, list sections, card groups
  * **Spatial Chunking**: Top-to-bottom, left-to-right in screen areas
  * **Semantic Chunking**: Content related to the same topic or functionality
  * **Component-Based Chunking**: Process similar component instances together

## 3. Progressive Replacement with Verification
- Create a safe copy of the node for text replacement
- Replace text chunk by chunk with continuous progress updates
- After each chunk is processed:
  * Export that section as a small, manageable image
  * Verify text fits properly and maintain design integrity
  * Fix issues before proceeding to the next chunk

\`\`\`
// Clone the node to create a safe copy
clone_node(nodeId: "selected-node-id", x: [new-x], y: [new-y])

// Replace text chunk by chunk
set_text_content(
  items: [
    { nodeId: "node-id-1", text: "New text 1" },
    // More nodes in this chunk...
  ]
)

// Verify chunk with small, targeted image exports
export_node_as_image(nodeId: "chunk-node-id", format: "PNG", scale: 0.5)
\`\`\`

## 4. Intelligent Handling for Table Data
- For tabular content:
  * Process one row or column at a time
  * Maintain alignment and spacing between cells
  * Consider conditional formatting based on cell content
  * Preserve header/data relationships

## 5. Smart Text Adaptation
- Adaptively handle text based on container constraints:
  * Auto-detect space constraints and adjust text length
  * Apply line breaks at appropriate linguistic points
  * Maintain text hierarchy and emphasis
  * Consider font scaling for critical content that must fit

## 6. Progressive Feedback Loop
- Establish a continuous feedback loop during replacement:
  * Real-time progress updates (0-100%)
  * Small image exports after each chunk for verification
  * Issues identified early and resolved incrementally
  * Quick adjustments applied to subsequent chunks

## 7. Final Verification & Context-Aware QA
- After all chunks are processed:
  * Export the entire design at reduced scale for final verification
  * Check for cross-chunk consistency issues
  * Verify proper text flow between different sections
  * Ensure design harmony across the full composition

## 8. Chunk-Specific Export Scale Guidelines
- Scale exports appropriately based on chunk size:
  * Small chunks (1-5 elements): scale 1.0
  * Medium chunks (6-20 elements): scale 0.7
  * Large chunks (21-50 elements): scale 0.5
  * Very large chunks (50+ elements): scale 0.3
  * Full design verification: scale 0.2

## Sample Chunking Strategy for Common Design Types

### Tables
- Process by logical rows (5-10 rows per chunk)
- Alternative: Process by column for columnar analysis
- Tip: Always include header row in first chunk for reference

### Card Lists
- Group 3-5 similar cards per chunk
- Process entire cards to maintain internal consistency
- Verify text-to-image ratio within cards after each chunk

### Forms
- Group related fields (e.g., "Personal Information", "Payment Details")
- Process labels and input fields together
- Ensure validation messages and hints are updated with their fields

### Navigation & Menus
- Process hierarchical levels together (main menu, submenu)
- Respect information architecture relationships
- Verify menu fit and alignment after replacement

## Best Practices
- **Preserve Design Intent**: Always prioritize design integrity
- **Structural Consistency**: Maintain alignment, spacing, and hierarchy
- **Visual Feedback**: Verify each chunk visually before proceeding
- **Incremental Improvement**: Learn from each chunk to improve subsequent ones
- **Balance Automation & Control**: Let AI handle repetitive replacements but maintain oversight
- **Respect Content Relationships**: Keep related content consistent across chunks

Remember that text is never just text—it's a core design element that must work harmoniously with the overall composition. This chunk-based strategy allows you to methodically transform text while maintaining design integrity.`,
        },
      }],
      description: "Systematic approach for replacing text in Figma designs",
    })
  );

  server.prompt(
    "swap_overrides_instances",
    "Guide to swap instance overrides between instances",
    () => ({
      messages: [{
        role: "assistant" as const,
        content: {
          type: "text" as const,
          text: `# Swap Component Instance Overrides

## Overview
Transfer content overrides from a source instance to target instances.

## Process

### 1. Identify Instances
- Use \`get_selection()\` to identify selected instances
- Use \`search_nodes(types: ["INSTANCE"])\` to find instances on the page

### 2. Extract Source Overrides
- \`get_instance_overrides(nodeId: "source-instance-id")\`
- Returns mainComponentId and per-child override fields (characters, fills, fontSize, etc.)

### 3. Apply to Targets
- For text overrides: use \`set_text_content\` on matching child node IDs
- For style overrides: use \`set_fill_color\`, \`apply_style_to_node\`, etc.
- Match children by name path — source and target instances share the same internal structure

### 4. Verify
- \`get_node_info(nodeId, depth: 1)\` on target instances
- \`export_node_as_image\` for visual verification`,
        },
      }],
      description: "Strategy for transferring overrides between component instances in Figma",
    })
  );
}
