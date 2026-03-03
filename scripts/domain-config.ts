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
      "search_nodes",
      "export_node_as_image",
      "get_selection",
      "set_selection",
    ],
  },
  {
    id: "creation",
    label: "Creation",
    description: "Tools for creating shapes, frames, and text nodes",
    tools: [
      "create_section",
      "create_node_from_svg",
      "create_frame",
      "create_auto_layout",
      "create_text",
    ],
  },
  {
    id: "modification",
    label: "Modification",
    description: "Tools for patching, deleting, cloning, and reparenting nodes",
    tools: [
      "patch_nodes",
      "delete_node",
      "clone_node",
      "insert_child",
    ],
  },
  {
    id: "styles",
    label: "Styles",
    description: "Tools for creating and managing paint, text, and effect styles",
    tools: [
      "styles",
    ],
  },
  {
    id: "variables",
    label: "Variables",
    description: "Tools for creating and managing design variables and modes",
    tools: [
      "variable_collections",
      "variables",
      "set_variable_binding",
      "set_explicit_variable_mode",
      "get_node_variables",
    ],
  },
  {
    id: "components",
    label: "Components",
    description: "Tools for creating components, variants, and instances",
    tools: [
      "components",
      "instances",
    ],
  },
  {
    id: "text-fonts",
    label: "Text & Fonts",
    description: "Tools for modifying text content, properties, and fonts",
    tools: [
      "set_text_content",
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
