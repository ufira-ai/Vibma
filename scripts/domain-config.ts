/** Tool-to-domain mapping for the docs site */

export interface DomainConfig {
  id: string;
  label: string;
  description: string;
  tools: string[];
}

export const domains: DomainConfig[] = [
  {
    id: "connection",
    label: "Connection",
    description: "Tools for establishing and managing the Figma connection",
    tools: [
      "join_channel",
      "channel_info",
      "reset_tunnel",
      "ping",
    ],
  },
  {
    id: "document",
    label: "Document & Navigation",
    description: "Tools for inspecting and navigating documents and pages",
    tools: [
      "get_document_info",
      "get_current_page",
      "get_pages",
      "set_current_page",
      "create_page",
      "rename_page",
    ],
  },
  {
    id: "node-inspection",
    label: "Node Inspection",
    description: "Tools for reading node data, searching, and exporting",
    tools: [
      "get_node_info",
      "get_node_css",
      "search_nodes",
      "export_node_as_image",
      "get_selection",
      "read_my_design",
      "set_selection",
      "zoom_into_view",
      "set_viewport",
    ],
  },
  {
    id: "creation",
    label: "Creation",
    description: "Tools for creating shapes, frames, and text nodes",
    tools: [
      "create_rectangle",
      "create_ellipse",
      "create_line",
      "create_section",
      "create_node_from_svg",
      "create_boolean_operation",
      "create_frame",
      "create_auto_layout",
      "create_text",
    ],
  },
  {
    id: "modification",
    label: "Modification",
    description: "Tools for moving, resizing, deleting, and reparenting nodes",
    tools: [
      "move_node",
      "resize_node",
      "delete_node",
      "clone_node",
      "insert_child",
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Tools for fills, strokes, corners, opacity, effects, and constraints",
    tools: [
      "set_fill_color",
      "set_stroke_color",
      "set_corner_radius",
      "set_opacity",
      "set_effects",
      "set_constraints",
      "set_export_settings",
      "set_node_properties",
    ],
  },
  {
    id: "layout",
    label: "Layout",
    description: "Tools for updating auto-layout and frame properties",
    tools: [
      "update_frame",
    ],
  },
  {
    id: "styles",
    label: "Styles",
    description: "Tools for creating, applying, and managing paint, text, and effect styles",
    tools: [
      "get_styles",
      "get_style_by_id",
      "remove_style",
      "create_paint_style",
      "create_text_style",
      "create_effect_style",
      "apply_style_to_node",
      "update_paint_style",
      "update_text_style",
    ],
  },
  {
    id: "variables",
    label: "Variables",
    description: "Tools for creating and managing design variables and modes",
    tools: [
      "create_variable_collection",
      "create_variable",
      "set_variable_value",
      "get_local_variables",
      "get_local_variable_collections",
      "get_variable_by_id",
      "get_variable_collection_by_id",
      "set_variable_binding",
      "add_mode",
      "rename_mode",
      "remove_mode",
      "set_explicit_variable_mode",
      "get_node_variables",
      "delete_variable_collection",
    ],
  },
  {
    id: "components",
    label: "Components",
    description: "Tools for creating components, variants, and instances",
    tools: [
      "create_component",
      "create_component_from_node",
      "combine_as_variants",
      "add_component_property",
      "create_instance_from_local",
      "search_components",
      "get_component_by_id",
      "get_instance_overrides",
      "set_instance_properties",
    ],
  },
  {
    id: "text-fonts",
    label: "Text & Fonts",
    description: "Tools for modifying text content, properties, and fonts",
    tools: [
      "set_text_content",
      "set_text_properties",
      "scan_text_nodes",
      "get_available_fonts",
    ],
  },
  {
    id: "lint-export",
    label: "Lint & Export",
    description: "Tools for linting designs and auto-fixing issues",
    tools: [
      "lint_node",
      "lint_fix_autolayout",
      "lint_fix_replace_shape_with_frame",
    ],
  },
];

/** Lookup: tool name → domain id */
export const toolToDomain = new Map<string, string>();
for (const domain of domains) {
  for (const tool of domain.tools) {
    toolToDomain.set(tool, domain.id);
  }
}
