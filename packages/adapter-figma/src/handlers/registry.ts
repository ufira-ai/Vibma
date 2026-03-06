// Import all figma handler maps
import { figmaHandlers as connectionHandlers } from "./connection";
import { figmaHandlers as documentHandlers } from "./document";
import { figmaHandlers as selectionHandlers } from "./selection";
import { figmaHandlers as nodeInfoHandlers } from "./node-info";
import { figmaHandlers as createShapeHandlers } from "./create-shape";
import { figmaHandlers as createFrameHandlers } from "./create-frame";
import { figmaHandlers as createTextHandlers } from "./create-text";
import { figmaHandlers as modifyNodeHandlers } from "./modify-node";
import { figmaHandlers as patchNodesHandlers } from "./patch-nodes";
import { figmaHandlers as fillStrokeHandlers } from "./fill-stroke";
import { figmaHandlers as updateFrameHandlers } from "./update-frame";
import { figmaHandlers as effectsHandlers } from "./effects";
import { figmaHandlers as textHandlers } from "./text";
import { figmaHandlers as fontsHandlers } from "./fonts";
import { figmaHandlers as componentsHandlers } from "./components";
import { figmaHandlers as stylesHandlers } from "./styles";
import { figmaHandlers as variablesHandlers } from "./variables";
import { figmaHandlers as lintHandlers } from "./lint";

/** Merged dispatch map: command name → handler function */
export const allFigmaHandlers: Record<string, (params: any) => Promise<any>> = {
  ...connectionHandlers,
  ...documentHandlers,
  ...selectionHandlers,
  ...nodeInfoHandlers,
  ...createShapeHandlers,
  ...createFrameHandlers,
  ...createTextHandlers,
  ...modifyNodeHandlers,
  ...patchNodesHandlers,
  ...fillStrokeHandlers,
  ...updateFrameHandlers,
  ...effectsHandlers,
  ...textHandlers,
  ...fontsHandlers,
  ...componentsHandlers,
  ...stylesHandlers,
  ...variablesHandlers,
  ...lintHandlers,

  // ─── Endpoint-style command aliases (generated endpoints use {endpoint}.{method}) ───
  // connection endpoint
  "connection.get": connectionHandlers.ping,

  // selection endpoint
  "selection.get": selectionHandlers.get_selection,
  "selection.update": selectionHandlers.set_selection,

  // frames endpoint — own methods
  "frames.create": async (params: any) => {
    const type = params.type;
    if (type === "frame") return createFrameHandlers.create_frame(params);
    if (type === "auto_layout") return createFrameHandlers.create_auto_layout(params);
    if (type === "section") return createShapeHandlers.create_section(params);
    if (type === "rectangle") return createShapeHandlers.create_rectangle(params);
    if (type === "ellipse") return createShapeHandlers.create_ellipse(params);
    if (type === "line") return createShapeHandlers.create_line(params);
    if (type === "group") return createShapeHandlers.create_group(params);
    if (type === "boolean_operation") return createShapeHandlers.create_boolean_operation(params);
    if (type === "svg") return createShapeHandlers.create_node_from_svg(params);
    throw new Error(`frames.create: unknown type "${type}". Expected: frame, auto_layout, section, rectangle, ellipse, line, group, boolean_operation, svg`);
  },

  // frames endpoint — inherited node base methods (translate endpoint params → legacy handler params)
  "frames.get": (p: any) => nodeInfoHandlers.get_node_info({ ...p, nodeIds: p.id ? [p.id] : p.nodeIds }),
  "frames.list": (p: any) => nodeInfoHandlers.search_nodes({ ...p, scopeNodeId: p.parentId }),
  "frames.update": (p: any) => patchNodesHandlers.patch_nodes({
    ...p,
    items: p.items?.map((i: any) => ({ ...i, nodeId: i.nodeId ?? i.id })),
  }),
  "frames.delete": (p: any) => {
    const items = p.items
      ? p.items.map((i: any) => ({ ...i, nodeId: i.nodeId ?? i.id }))
      : p.id ? [{ nodeId: p.id }] : [];
    return modifyNodeHandlers.delete_node({ ...p, items });
  },
  "frames.clone": (p: any) => modifyNodeHandlers.clone_node({
    ...p,
    items: p.items ?? [{ nodeId: p.id, parentId: p.parentId, x: p.x, y: p.y }],
  }),
  "frames.reparent": (p: any) => modifyNodeHandlers.insert_child({
    ...p,
    items: (p.items || []).map((i: any) => ({ childId: i.id, parentId: i.parentId, index: i.index })),
  }),
  "frames.export": nodeInfoHandlers.export_node_as_image,

  // ─── pages endpoint ───
  "pages.get": documentHandlers.get_current_page,
  "pages.list": documentHandlers.get_document_info,
  "pages.set": documentHandlers.set_current_page,
  "pages.create": documentHandlers.create_page,
  "pages.update": documentHandlers.rename_page,

  // ─── text endpoint — own methods ───
  "text.create": createTextHandlers.create_text,
  "text.set_content": textHandlers.set_text_content,
  "text.scan": textHandlers.scan_text_nodes,

  // text endpoint — inherited node base methods
  "text.get": (p: any) => nodeInfoHandlers.get_node_info({ ...p, nodeIds: p.id ? [p.id] : p.nodeIds }),
  "text.list": (p: any) => nodeInfoHandlers.search_nodes({ ...p, scopeNodeId: p.parentId }),
  "text.update": (p: any) => patchNodesHandlers.patch_nodes({
    ...p,
    items: p.items?.map((i: any) => ({ ...i, nodeId: i.nodeId ?? i.id })),
  }),
  "text.delete": (p: any) => {
    const items = p.items
      ? p.items.map((i: any) => ({ ...i, nodeId: i.nodeId ?? i.id }))
      : p.id ? [{ nodeId: p.id }] : [];
    return modifyNodeHandlers.delete_node({ ...p, items });
  },
  "text.clone": (p: any) => modifyNodeHandlers.clone_node({
    ...p,
    items: p.items ?? [{ nodeId: p.id, parentId: p.parentId, x: p.x, y: p.y }],
  }),
  "text.reparent": (p: any) => modifyNodeHandlers.insert_child({
    ...p,
    items: (p.items || []).map((i: any) => ({ childId: i.id, parentId: i.parentId, index: i.index })),
  }),

  // ─── fonts endpoint ───
  "fonts.list": fontsHandlers.get_available_fonts,

  // ─── lint endpoint ───
  "lint.check": lintHandlers.lint_node,
  "lint.fix": lintHandlers.lint_fix_autolayout,

  // ─── styles endpoint ───
  "styles.list": stylesHandlers.styles,
  "styles.get": stylesHandlers.styles,
  "styles.create": stylesHandlers.styles,
  "styles.update": stylesHandlers.styles,
  "styles.delete": stylesHandlers.styles,

  // ─── components endpoint ───
  "components.list": componentsHandlers.components,
  "components.get": componentsHandlers.components,
  "components.create": componentsHandlers.components,
  "components.update": componentsHandlers.components,

  // ─── instances endpoint ───
  "instances.get": componentsHandlers.instances,
  "instances.create": componentsHandlers.instances,
  "instances.update": componentsHandlers.instances,
  "instances.swap": componentsHandlers.instances,
  "instances.detach": componentsHandlers.instances,
  "instances.reset_overrides": componentsHandlers.instances,

  // ─── variable_collections endpoint ───
  "variable_collections.list": variablesHandlers.variable_collections,
  "variable_collections.get": variablesHandlers.variable_collections,
  "variable_collections.create": variablesHandlers.variable_collections,
  "variable_collections.update": variablesHandlers.variable_collections,
  "variable_collections.delete": variablesHandlers.variable_collections,
  "variable_collections.add_mode": variablesHandlers.variable_collections,
  "variable_collections.rename_mode": variablesHandlers.variable_collections,
  "variable_collections.remove_mode": variablesHandlers.variable_collections,

  // ─── variables endpoint ───
  "variables.list": variablesHandlers.variables,
  "variables.get": variablesHandlers.variables,
  "variables.create": variablesHandlers.variables,
  "variables.update": variablesHandlers.variables,
  "variables.delete": variablesHandlers.variables,
};
