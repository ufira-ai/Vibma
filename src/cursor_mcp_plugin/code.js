// This is the main code file for the Cursor MCP Figma plugin
// It handles Figma API commands

// Plugin state
const state = {
  serverPort: 3055, // Default port
};


// Helper function for progress updates
function sendProgressUpdate(
  commandId,
  commandType,
  status,
  progress,
  totalItems,
  processedItems,
  message,
  payload = null
) {
  const update = {
    type: "command_progress",
    commandId,
    commandType,
    status,
    progress,
    totalItems,
    processedItems,
    message,
    timestamp: Date.now(),
  };

  // Add optional chunk information if present
  if (payload) {
    if (
      payload.currentChunk !== undefined &&
      payload.totalChunks !== undefined
    ) {
      update.currentChunk = payload.currentChunk;
      update.totalChunks = payload.totalChunks;
      update.chunkSize = payload.chunkSize;
    }
    update.payload = payload;
  }

  // Send to UI
  figma.ui.postMessage(update);
  console.log(`Progress update: ${status} - ${progress}% - ${message}`);

  return update;
}

// Show UI
figma.showUI(__html__, { width: 350, height: 600 });

// Plugin commands from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case "update-settings":
      updateSettings(msg);
      break;
    case "notify":
      figma.notify(msg.message);
      break;
    case "close-plugin":
      figma.closePlugin();
      break;
    case "execute-command":
      // Execute commands received from UI (which gets them from WebSocket)
      try {
        const result = await handleCommand(msg.command, msg.params);
        // Send result back to UI
        figma.ui.postMessage({
          type: "command-result",
          id: msg.id,
          result,
        });
      } catch (error) {
        figma.ui.postMessage({
          type: "command-error",
          id: msg.id,
          error: error.message || "Error executing command",
        });
      }
      break;
  }
};

// Listen for plugin commands from menu
figma.on("run", ({ command }) => {
  figma.ui.postMessage({ type: "auto-connect" });
});

// Update plugin settings
function updateSettings(settings) {
  if (settings.serverPort) {
    state.serverPort = settings.serverPort;
  }

  figma.clientStorage.setAsync("settings", {
    serverPort: state.serverPort,
  });
}

// Handle commands from UI
async function handleCommand(command, params) {
  switch (command) {
    case "get_document_info":
      return await getDocumentInfo(params ? params.depth : undefined);
    case "get_selection":
      return await getSelection();
    case "get_node_info":
      if (!params || !params.nodeId) {
        throw new Error("Missing nodeId parameter");
      }
      return await getNodeInfo(params.nodeId, params.depth);
    case "get_nodes_info":
      if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
        throw new Error("Missing or invalid nodeIds parameter");
      }
      return await getNodesInfo(params.nodeIds, params.depth);
    case "read_my_design":
      return await readMyDesign(params ? params.depth : undefined);
    case "create_rectangle":
      return await createRectangle(params);
    case "create_frame":
      return await createFrame(params);
    case "create_text":
      return await createText(params);
    case "set_fill_color":
      return await setFillColor(params);
    case "set_stroke_color":
      return await setStrokeColor(params);
    case "move_node":
      return await moveNode(params);
    case "resize_node":
      return await resizeNode(params);
    case "delete_node":
      return await deleteNode(params);
    case "delete_multiple_nodes":
      return await deleteMultipleNodes(params);
    case "get_styles":
      return await getStyles();
    case "get_local_components":
      return await getLocalComponents(params);
    // case "get_team_components":
    //   return await getTeamComponents();
    case "export_node_as_image":
      return await exportNodeAsImage(params);
    case "set_corner_radius":
      return await setCornerRadius(params);
    case "set_text_content":
      return await setTextContent(params);
    case "clone_node":
      return await cloneNode(params);
    case "scan_text_nodes":
      return await scanTextNodes(params);
    case "set_multiple_text_contents":
      return await setMultipleTextContents(params);
    case "get_instance_overrides":
      // Check if instanceNode parameter is provided
      if (params && params.instanceNodeId) {
        // Get the instance node by ID
        const instanceNode = await figma.getNodeByIdAsync(params.instanceNodeId);
        if (!instanceNode) {
          throw new Error(`Instance node not found with ID: ${params.instanceNodeId}`);
        }
        return await getInstanceOverrides(instanceNode);
      }
      // Call without instance node if not provided
      return await getInstanceOverrides();

    case "set_layout_mode":
      return await setLayoutMode(params);
    case "set_padding":
      return await setPadding(params);
    case "set_axis_align":
      return await setAxisAlign(params);
    case "set_layout_sizing":
      return await setLayoutSizing(params);
    case "set_item_spacing":
      return await setItemSpacing(params);
    case "set_focus":
      return await setFocus(params);
    case "set_selections":
      return await setSelections(params);
    case "create_component":
      return await createComponent(params);
    case "create_component_from_node":
      return await createComponentFromNode(params);
    case "combine_as_variants":
      return await combineAsVariants(params);
    case "add_component_property":
      return await addComponentProperty(params);
    case "create_instance_from_local":
      return await createInstanceFromLocal(params);
    case "create_variable_collection":
      return await createVariableCollection(params);
    case "create_variable":
      return await createVariable(params);
    case "set_variable_value":
      return await setVariableValue(params);
    case "get_local_variables":
      return await getLocalVariables(params);
    case "get_local_variable_collections":
      return await getLocalVariableCollections();
    case "set_variable_binding":
      return await setVariableBinding(params);
    case "create_paint_style":
      return await createPaintStyle(params);
    case "create_text_style":
      return await createTextStyleHandler(params);
    case "create_effect_style":
      return await createEffectStyle(params);
    case "apply_style_to_node":
      return await applyStyleToNode(params);
    case "create_ellipse":
      return await createEllipse(params);
    case "create_line":
      return await createLine(params);
    case "create_boolean_operation":
      return await createBooleanOperation(params);
    case "set_opacity":
      return await setOpacity(params);
    case "set_effects":
      return await setEffects(params);
    case "set_constraints":
      return await setConstraints(params);
    case "set_export_settings":
      return await setExportSettings(params);
    case "set_node_properties":
      return await setNodeProperties(params);
    case "get_style_by_id":
      if (!params || !params.styleId) throw new Error("Missing styleId parameter");
      return await getStyleById(params.styleId);
    case "remove_style":
      if (!params || !params.styleId) throw new Error("Missing styleId parameter");
      return await removeStyle(params.styleId);
    case "get_component_by_id":
      if (!params || !params.componentId) throw new Error("Missing componentId parameter");
      return await getComponentById(params.componentId, params.includeChildren);
    case "get_variable_by_id":
      if (!params || !params.variableId) throw new Error("Missing variableId parameter");
      return await getVariableById(params.variableId);
    case "get_variable_collection_by_id":
      if (!params || !params.collectionId) throw new Error("Missing collectionId parameter");
      return await getVariableCollectionById(params.collectionId);
    case "get_pages":
      return await getPages();
    case "set_current_page":
      if (!params || (!params.pageId && !params.pageName)) throw new Error("Missing pageId or pageName parameter");
      return await setCurrentPage(params);
    case "create_page":
      return await createPage(params);
    case "get_node_css":
      if (!params || !params.nodeId) throw new Error("Missing nodeId parameter");
      return await getNodeCss(params.nodeId);
    case "get_available_fonts":
      return await getAvailableFonts(params);
    case "create_section":
      return await createSection(params);
    case "insert_child":
      if (!params || !params.parentId || !params.childId) throw new Error("Missing parentId or childId parameter");
      return await insertChild(params);
    case "create_node_from_svg":
      if (!params || !params.svg) throw new Error("Missing svg parameter");
      return await createNodeFromSvg(params);
    case "get_current_page":
      return await getCurrentPage();
    case "search_nodes":
      return await searchNodes(params);
    case "add_mode":
      return await addMode(params);
    case "rename_mode":
      return await renameMode(params);
    case "remove_mode":
      return await removeMode(params);
    case "rename_page":
      return await renamePage(params);
    case "zoom_into_view":
      return await zoomIntoView(params);
    case "set_viewport":
      return await setViewport(params);
    case "create_auto_layout":
      return await createAutoLayout(params);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

// Command implementations

async function getDocumentInfo(depth) {
  await figma.currentPage.loadAsync();
  const page = figma.currentPage;

  var children;
  if (depth !== undefined && depth > 0) {
    // Return deeper child info using filterFigmaNode-style recursion
    children = page.children.map((node) => {
      var child = {
        id: node.id,
        name: node.name,
        type: node.type,
      };
      if (depth > 1 && "children" in node && node.children) {
        child.children = node.children.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));
      }
      return child;
    });
  } else {
    children = page.children.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    }));
  }

  // Get all pages - safely handle lazy-loaded pages
  var pages = figma.root.children.map((p) => {
    var pageInfo = {
      id: p.id,
      name: p.name,
      isCurrent: p.id === page.id,
    };
    try {
      pageInfo.childCount = p.children ? p.children.length : -1;
    } catch (e) {
      pageInfo.childCount = -1; // Page not loaded
    }
    return pageInfo;
  });

  return {
    name: figma.root.name,
    currentPage: {
      id: page.id,
      name: page.name,
      childCount: page.children.length,
    },
    pages: pages,
    children: children,
  };
}

async function getSelection() {
  return {
    selectionCount: figma.currentPage.selection.length,
    selection: figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
    })),
  };
}

function rgbaToHex(color) {
  var r = Math.round(color.r * 255);
  var g = Math.round(color.g * 255);
  var b = Math.round(color.b * 255);
  var a = color.a !== undefined ? Math.round(color.a * 255) : 255;

  if (a === 255) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          return x.toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  return (
    "#" +
    [r, g, b, a]
      .map((x) => {
        return x.toString(16).padStart(2, "0");
      })
      .join("")
  );
}

function filterFigmaNode(node, depth, currentDepth) {
  if (depth === undefined) depth = -1; // -1 means unlimited
  if (currentDepth === undefined) currentDepth = 0;

  if (node.type === "VECTOR") {
    return null;
  }

  var filtered = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  // Include parent reference at the root level of the response
  if (currentDepth === 0 && node.parentId) {
    filtered.parentId = node.parentId;
  }

  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill) => {
      var processedFill = Object.assign({}, fill);
      delete processedFill.boundVariables;
      delete processedFill.imageRef;

      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map(
          (stop) => {
            var processedStop = Object.assign({}, stop);
            if (processedStop.color) {
              processedStop.color = rgbaToHex(processedStop.color);
            }
            delete processedStop.boundVariables;
            return processedStop;
          }
        );
      }

      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color);
      }

      return processedFill;
    });
  }

  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke) => {
      var processedStroke = Object.assign({}, stroke);
      delete processedStroke.boundVariables;
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color);
      }
      return processedStroke;
    });
  }

  if (node.cornerRadius !== undefined) {
    filtered.cornerRadius = node.cornerRadius;
  }

  if (node.absoluteBoundingBox) {
    filtered.absoluteBoundingBox = node.absoluteBoundingBox;
  }

  if (node.characters) {
    filtered.characters = node.characters;
  }

  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx,
    };
  }

  // Effects
  if (node.effects && node.effects.length > 0) {
    filtered.effects = node.effects;
  }

  // Layout properties
  if (node.layoutMode !== undefined) {
    filtered.layoutMode = node.layoutMode;
  }
  if (node.itemSpacing !== undefined) {
    filtered.itemSpacing = node.itemSpacing;
  }
  if (node.paddingLeft !== undefined) {
    filtered.padding = {
      left: node.paddingLeft,
      right: node.paddingRight,
      top: node.paddingTop,
      bottom: node.paddingBottom,
    };
  }

  // Opacity and visibility
  if (node.opacity !== undefined && node.opacity !== 1) {
    filtered.opacity = node.opacity;
  }
  if (node.visible !== undefined && node.visible === false) {
    filtered.visible = false;
  }

  // Constraints
  if (node.constraints) {
    filtered.constraints = node.constraints;
  }

  if (node.children) {
    // If depth is limited and we've reached the limit, return child summaries only
    if (depth >= 0 && currentDepth >= depth) {
      filtered.children = node.children.map((child) => ({
        id: child.id,
        name: child.name,
        type: child.type,
      }));
    } else {
      filtered.children = node.children
        .map((child) => {
          return filterFigmaNode(child, depth, currentDepth + 1);
        })
        .filter((child) => {
          return child !== null;
        });
    }
  }

  return filtered;
}

async function getNodeInfo(nodeId, depth) {
  const node = await figma.getNodeByIdAsync(nodeId);

  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  const response = await node.exportAsync({
    format: "JSON_REST_V1",
  });

  var result = filterFigmaNode(response.document, depth !== undefined ? depth : -1);

  // Inject parent info from the live node (not available in JSON_REST_V1 export)
  if (result && node.parent) {
    result.parentId = node.parent.id;
    result.parentName = node.parent.name;
    result.parentType = node.parent.type;
  }

  return result;
}

async function getNodesInfo(nodeIds, depth) {
  try {
    // Load all nodes in parallel
    const nodes = await Promise.all(
      nodeIds.map((id) => figma.getNodeByIdAsync(id))
    );

    // Filter out any null values (nodes that weren't found)
    const validNodes = nodes.filter((node) => node !== null);

    // Export all valid nodes in parallel
    const responses = await Promise.all(
      validNodes.map(async (node) => {
        const response = await node.exportAsync({
          format: "JSON_REST_V1",
        });
        return {
          nodeId: node.id,
          document: filterFigmaNode(response.document, depth !== undefined ? depth : -1),
        };
      })
    );

    return responses;
  } catch (error) {
    throw new Error(`Error getting nodes info: ${error.message}`);
  }
}

async function readMyDesign(depth) {
  try {
    // Load all selected nodes in parallel
    const nodes = await Promise.all(
      figma.currentPage.selection.map((node) => figma.getNodeByIdAsync(node.id))
    );

    // Filter out any null values (nodes that weren't found)
    const validNodes = nodes.filter((node) => node !== null);

    // Export all valid nodes in parallel
    const responses = await Promise.all(
      validNodes.map(async (node) => {
        const response = await node.exportAsync({
          format: "JSON_REST_V1",
        });
        return {
          nodeId: node.id,
          document: filterFigmaNode(response.document, depth !== undefined ? depth : -1),
        };
      })
    );

    return responses;
  } catch (error) {
    throw new Error(`Error getting nodes info: ${error.message}`);
  }
}

async function createRectangle(params) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Rectangle",
    parentId,
  } = params || {};

  const rect = figma.createRectangle();
  rect.x = x;
  rect.y = y;
  rect.resize(width, height);
  rect.name = name;

  // If parentId is provided, append to that node, otherwise append to current page
  if (parentId) {
    const parentNode = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    if (!("appendChild" in parentNode)) {
      throw new Error(`Parent node does not support children: ${parentId}`);
    }
    parentNode.appendChild(rect);
  } else {
    figma.currentPage.appendChild(rect);
  }

  return {
    id: rect.id,
    name: rect.name,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    parentId: rect.parent ? rect.parent.id : undefined,
  };
}

async function createFrame(params) {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Frame",
    parentId,
    fillColor,
    strokeColor,
    strokeWeight,
    layoutMode = "NONE",
    layoutWrap = "NO_WRAP",
    paddingTop = 0,
    paddingRight = 0,
    paddingBottom = 0,
    paddingLeft = 0,
    primaryAxisAlignItems = "MIN",
    counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED",
    layoutSizingVertical = "FIXED",
    itemSpacing = 0,
  } = params || {};

  const frame = figma.createFrame();
  frame.x = x;
  frame.y = y;
  frame.resize(width, height);
  frame.name = name;
  frame.fills = []; // transparent by default

  // Track whether we need to defer FILL sizing until after appendChild
  const deferHorizontalFill = parentId && layoutSizingHorizontal === "FILL";
  const deferVerticalFill = parentId && layoutSizingVertical === "FILL";

  // Set layout mode if provided
  if (layoutMode !== "NONE") {
    frame.layoutMode = layoutMode;
    frame.layoutWrap = layoutWrap;

    // Set padding values only when layoutMode is not NONE
    frame.paddingTop = paddingTop;
    frame.paddingRight = paddingRight;
    frame.paddingBottom = paddingBottom;
    frame.paddingLeft = paddingLeft;

    // Set axis alignment only when layoutMode is not NONE
    frame.primaryAxisAlignItems = primaryAxisAlignItems;
    frame.counterAxisAlignItems = counterAxisAlignItems;

    // Set layout sizing — defer FILL until after appendChild (FILL requires auto-layout parent)
    frame.layoutSizingHorizontal = deferHorizontalFill ? "FIXED" : layoutSizingHorizontal;
    frame.layoutSizingVertical = deferVerticalFill ? "FIXED" : layoutSizingVertical;

    // Set item spacing only when layoutMode is not NONE
    frame.itemSpacing = itemSpacing;
  }

  // Set fill color if provided
  if (fillColor) {
    const paintStyle = {
      type: "SOLID",
      color: {
        r: fillColor.r !== undefined ? fillColor.r : 0,
        g: fillColor.g !== undefined ? fillColor.g : 0,
        b: fillColor.b !== undefined ? fillColor.b : 0,
      },
      opacity: fillColor.a !== undefined ? fillColor.a : 1,
    };
    frame.fills = [paintStyle];
  }

  // Set stroke color and weight if provided
  if (strokeColor) {
    const strokeStyle = {
      type: "SOLID",
      color: {
        r: strokeColor.r !== undefined ? strokeColor.r : 0,
        g: strokeColor.g !== undefined ? strokeColor.g : 0,
        b: strokeColor.b !== undefined ? strokeColor.b : 0,
      },
      opacity: strokeColor.a !== undefined ? strokeColor.a : 1,
    };
    frame.strokes = [strokeStyle];
  }

  // Set stroke weight if provided
  if (strokeWeight !== undefined) {
    frame.strokeWeight = strokeWeight;
  }

  // If parentId is provided, append to that node, otherwise append to current page
  if (parentId) {
    const parentNode = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    if (!("appendChild" in parentNode)) {
      throw new Error(`Parent node does not support children: ${parentId}`);
    }
    parentNode.appendChild(frame);

    // Apply deferred FILL sizing now that node is a child of the parent
    if (deferHorizontalFill) {
      try { frame.layoutSizingHorizontal = "FILL"; } catch (_) {}
    }
    if (deferVerticalFill) {
      try { frame.layoutSizingVertical = "FILL"; } catch (_) {}
    }
  } else {
    figma.currentPage.appendChild(frame);
  }

  return {
    id: frame.id,
    name: frame.name,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    fills: frame.fills,
    strokes: frame.strokes,
    strokeWeight: frame.strokeWeight,
    layoutMode: frame.layoutMode,
    layoutWrap: frame.layoutWrap,
    parentId: frame.parent ? frame.parent.id : undefined,
  };
}

async function createText(params) {
  const {
    x = 0,
    y = 0,
    text = "Text",
    fontSize = 14,
    fontWeight = 400,
    fontColor = { r: 0, g: 0, b: 0, a: 1 }, // Default to black
    name = "",
    parentId,
    textStyleId,
    layoutSizingHorizontal,
    layoutSizingVertical,
    textAutoResize,
  } = params || {};

  // Map common font weights to Figma font styles
  const getFontStyle = (weight) => {
    switch (weight) {
      case 100:
        return "Thin";
      case 200:
        return "Extra Light";
      case 300:
        return "Light";
      case 400:
        return "Regular";
      case 500:
        return "Medium";
      case 600:
        return "Semi Bold";
      case 700:
        return "Bold";
      case 800:
        return "Extra Bold";
      case 900:
        return "Black";
      default:
        return "Regular";
    }
  };

  const textNode = figma.createText();
  textNode.x = x;
  textNode.y = y;
  textNode.name = name || text;
  try {
    await figma.loadFontAsync({
      family: "Inter",
      style: getFontStyle(fontWeight),
    });
    textNode.fontName = { family: "Inter", style: getFontStyle(fontWeight) };
    textNode.fontSize = parseInt(fontSize);
  } catch (error) {
    console.error("Error setting font size", error);
  }
  setCharacters(textNode, text);

  // Set text color
  const paintStyle = {
    type: "SOLID",
    color: {
      r: fontColor.r !== undefined ? fontColor.r : 0,
      g: fontColor.g !== undefined ? fontColor.g : 0,
      b: fontColor.b !== undefined ? fontColor.b : 0,
    },
    opacity: fontColor.a !== undefined ? fontColor.a : 1,
  };
  textNode.fills = [paintStyle];

  // Apply text style if provided
  if (textStyleId) {
    try {
      const style = await figma.getStyleByIdAsync(textStyleId);
      if (style && style.type === "TEXT") {
        await textNode.setTextStyleIdAsync(style.id);
      }
    } catch (e) {
      console.error("Error applying text style:", e);
    }
  }

  // If parentId is provided, append to that node, otherwise append to current page
  if (parentId) {
    const parentNode = await figma.getNodeByIdAsync(parentId);
    if (!parentNode) {
      throw new Error(`Parent node not found with ID: ${parentId}`);
    }
    if (!("appendChild" in parentNode)) {
      throw new Error(`Parent node does not support children: ${parentId}`);
    }
    parentNode.appendChild(textNode);
  } else {
    figma.currentPage.appendChild(textNode);
  }

  // Set textAutoResize BEFORE layout sizing — critical for FILL to work.
  // Default is "WIDTH_AND_HEIGHT" (shrink to fit), which fights with FILL.
  // When FILL is requested, switch to "HEIGHT" so width is layout-controlled.
  if (textAutoResize) {
    textNode.textAutoResize = textAutoResize;
  } else if (layoutSizingHorizontal === "FILL") {
    textNode.textAutoResize = "HEIGHT";
  } else if (layoutSizingHorizontal === "FIXED") {
    textNode.textAutoResize = "HEIGHT";
  }

  // Apply layout sizing after appendChild (FILL requires auto-layout parent)
  if (layoutSizingHorizontal) {
    try { textNode.layoutSizingHorizontal = layoutSizingHorizontal; } catch (e) {
      console.error("Error setting layoutSizingHorizontal:", e);
    }
  }
  if (layoutSizingVertical) {
    try { textNode.layoutSizingVertical = layoutSizingVertical; } catch (e) {
      console.error("Error setting layoutSizingVertical:", e);
    }
  }

  return {
    id: textNode.id,
    name: textNode.name,
    x: textNode.x,
    y: textNode.y,
    width: textNode.width,
    height: textNode.height,
    characters: textNode.characters,
    fontSize: textNode.fontSize,
    fontWeight: fontWeight,
    fontColor: fontColor,
    fontName: textNode.fontName,
    fills: textNode.fills,
    parentId: textNode.parent ? textNode.parent.id : undefined,
  };
}

async function setFillColor(params) {
  console.log("setFillColor", params);
  const {
    nodeId,
    color: { r, g, b, a },
  } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("fills" in node)) {
    throw new Error(`Node does not support fills: ${nodeId}`);
  }

  // Create RGBA color
  const rgbColor = {
    r: r !== undefined ? r : 0,
    g: g !== undefined ? g : 0,
    b: b !== undefined ? b : 0,
    a: a !== undefined ? a : 1,
  };

  // Set fill
  const paintStyle = {
    type: "SOLID",
    color: {
      r: parseFloat(rgbColor.r),
      g: parseFloat(rgbColor.g),
      b: parseFloat(rgbColor.b),
    },
    opacity: parseFloat(rgbColor.a),
  };

  console.log("paintStyle", paintStyle);

  node.fills = [paintStyle];

  return {
    id: node.id,
    name: node.name,
    fills: [paintStyle],
  };
}

async function setStrokeColor(params) {
  const {
    nodeId,
    color: { r, g, b, a },
    weight = 1,
  } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("strokes" in node)) {
    throw new Error(`Node does not support strokes: ${nodeId}`);
  }

  // Create RGBA color
  const rgbColor = {
    r: r !== undefined ? r : 0,
    g: g !== undefined ? g : 0,
    b: b !== undefined ? b : 0,
    a: a !== undefined ? a : 1,
  };

  // Set stroke
  const paintStyle = {
    type: "SOLID",
    color: {
      r: rgbColor.r,
      g: rgbColor.g,
      b: rgbColor.b,
    },
    opacity: rgbColor.a,
  };

  node.strokes = [paintStyle];

  // Set stroke weight if available
  if ("strokeWeight" in node) {
    node.strokeWeight = weight;
  }

  return {
    id: node.id,
    name: node.name,
    strokes: node.strokes,
    strokeWeight: "strokeWeight" in node ? node.strokeWeight : undefined,
  };
}

async function moveNode(params) {
  const { nodeId, x, y } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (x === undefined || y === undefined) {
    throw new Error("Missing x or y parameters");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("x" in node) || !("y" in node)) {
    throw new Error(`Node does not support position: ${nodeId}`);
  }

  node.x = x;
  node.y = y;

  return {
    id: node.id,
    name: node.name,
    x: node.x,
    y: node.y,
  };
}

async function resizeNode(params) {
  const { nodeId, width, height } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (width === undefined || height === undefined) {
    throw new Error("Missing width or height parameters");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("resize" in node) && !("resizeWithoutConstraints" in node)) {
    throw new Error(`Node does not support resizing: ${nodeId}`);
  }

  // Sections and some node types only support resizeWithoutConstraints
  if ("resize" in node) {
    node.resize(width, height);
  } else {
    node.resizeWithoutConstraints(width, height);
  }

  return {
    id: node.id,
    name: node.name,
    width: node.width,
    height: node.height,
  };
}

async function deleteNode(params) {
  const { nodeId } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Save node info before deleting
  const nodeInfo = {
    id: node.id,
    name: node.name,
    type: node.type,
  };

  node.remove();

  return nodeInfo;
}

async function getStyles() {
  const styles = {
    colors: await figma.getLocalPaintStylesAsync(),
    texts: await figma.getLocalTextStylesAsync(),
    effects: await figma.getLocalEffectStylesAsync(),
    grids: await figma.getLocalGridStylesAsync(),
  };

  return {
    colors: styles.colors.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    texts: styles.texts.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    effects: styles.effects.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    grids: styles.grids.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
  };
}

async function getLocalComponents(params) {
  await figma.loadAllPagesAsync();

  var types = ["COMPONENT"];
  var setsOnly = params && params.setsOnly;
  if (setsOnly) {
    types = ["COMPONENT_SET"];
  }

  var components = figma.root.findAllWithCriteria({ types: types });

  // Name filter
  if (params && params.nameFilter) {
    var filter = params.nameFilter.toLowerCase();
    components = components.filter((c) => c.name.toLowerCase().includes(filter));
  }

  var totalCount = components.length;

  // Pagination
  var limit = (params && params.limit) || 100;
  var offset = (params && params.offset) || 0;
  components = components.slice(offset, offset + limit);

  return {
    totalCount: totalCount,
    returned: components.length,
    offset: offset,
    limit: limit,
    components: components.map((component) => {
      var entry = {
        id: component.id,
        name: component.name,
        key: "key" in component ? component.key : null,
        type: component.type,
      };
      if (component.type === "COMPONENT_SET" && "children" in component) {
        entry.variantCount = component.children.length;
      }
      if (component.parent) {
        entry.parentId = component.parent.id;
        entry.parentName = component.parent.name;
      }
      if (component.description) {
        entry.description = component.description;
      }
      return entry;
    }),
  };
}

// async function getTeamComponents() {
//   try {
//     const teamComponents =
//       await figma.teamLibrary.getAvailableComponentsAsync();

//     return {
//       count: teamComponents.length,
//       components: teamComponents.map((component) => ({
//         key: component.key,
//         name: component.name,
//         description: component.description,
//         libraryName: component.libraryName,
//       })),
//     };
//   } catch (error) {
//     throw new Error(`Error getting team components: ${error.message}`);
//   }
// }

async function exportNodeAsImage(params) {
  const { nodeId, scale = 1 } = params || {};

  const format = params.format || "PNG";

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (!("exportAsync" in node)) {
    throw new Error(`Node does not support exporting: ${nodeId}`);
  }

  try {
    const settings = {
      format: format,
      constraint: { type: "SCALE", value: scale },
    };

    const bytes = await node.exportAsync(settings);

    let mimeType;
    switch (format) {
      case "PNG":
        mimeType = "image/png";
        break;
      case "JPG":
        mimeType = "image/jpeg";
        break;
      case "SVG":
        mimeType = "image/svg+xml";
        break;
      case "PDF":
        mimeType = "application/pdf";
        break;
      default:
        mimeType = "application/octet-stream";
    }

    // Proper way to convert Uint8Array to base64
    const base64 = customBase64Encode(bytes);
    // const imageData = `data:${mimeType};base64,${base64}`;

    return {
      nodeId,
      format,
      scale,
      mimeType,
      imageData: base64,
    };
  } catch (error) {
    throw new Error(`Error exporting node as image: ${error.message}`);
  }
}
function customBase64Encode(bytes) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";

  const byteLength = bytes.byteLength;
  const byteRemainder = byteLength % 3;
  const mainLength = byteLength - byteRemainder;

  let a, b, c, d;
  let chunk;

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12; // 258048 = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6; // 4032 = (2^6 - 1) << 6
    d = chunk & 63; // 63 = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += chars[a] + chars[b] + chars[c] + chars[d];
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength];

    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4; // 3 = 2^2 - 1

    base64 += chars[a] + chars[b] + "==";
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4; // 1008 = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2; // 15 = 2^4 - 1

    base64 += chars[a] + chars[b] + chars[c] + "=";
  }

  return base64;
}

async function setCornerRadius(params) {
  const { nodeId, radius, corners } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (radius === undefined) {
    throw new Error("Missing radius parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Check if node supports corner radius
  if (!("cornerRadius" in node)) {
    throw new Error(`Node does not support corner radius: ${nodeId}`);
  }

  // If corners array is provided, set individual corner radii
  if (corners && Array.isArray(corners) && corners.length === 4) {
    if ("topLeftRadius" in node) {
      // Node supports individual corner radii
      if (corners[0]) node.topLeftRadius = radius;
      if (corners[1]) node.topRightRadius = radius;
      if (corners[2]) node.bottomRightRadius = radius;
      if (corners[3]) node.bottomLeftRadius = radius;
    } else {
      // Node only supports uniform corner radius
      node.cornerRadius = radius;
    }
  } else {
    // Set uniform corner radius
    node.cornerRadius = radius;
  }

  return {
    id: node.id,
    name: node.name,
    cornerRadius: "cornerRadius" in node ? node.cornerRadius : undefined,
    topLeftRadius: "topLeftRadius" in node ? node.topLeftRadius : undefined,
    topRightRadius: "topRightRadius" in node ? node.topRightRadius : undefined,
    bottomRightRadius:
      "bottomRightRadius" in node ? node.bottomRightRadius : undefined,
    bottomLeftRadius:
      "bottomLeftRadius" in node ? node.bottomLeftRadius : undefined,
  };
}

async function setTextContent(params) {
  const { nodeId, text } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  if (text === undefined) {
    throw new Error("Missing text parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  if (node.type !== "TEXT") {
    throw new Error(`Node is not a text node: ${nodeId}`);
  }

  try {
    await figma.loadFontAsync(node.fontName);

    await setCharacters(node, text);

    return {
      id: node.id,
      name: node.name,
      characters: node.characters,
      fontName: node.fontName,
    };
  } catch (error) {
    throw new Error(`Error setting text content: ${error.message}`);
  }
}

// Initialize settings on load
(async function initializePlugin() {
  try {
    const savedSettings = await figma.clientStorage.getAsync("settings");
    if (savedSettings) {
      if (savedSettings.serverPort) {
        state.serverPort = savedSettings.serverPort;
      }
    }

    // Send initial settings to UI
    figma.ui.postMessage({
      type: "init-settings",
      settings: {
        serverPort: state.serverPort,
      },
    });
  } catch (error) {
    console.error("Error loading settings:", error);
  }
})();

function uniqBy(arr, predicate) {
  const cb = typeof predicate === "function" ? predicate : (o) => o[predicate];
  return [
    ...arr
      .reduce((map, item) => {
        const key = item === null || item === undefined ? item : cb(item);

        map.has(key) || map.set(key, item);

        return map;
      }, new Map())
      .values(),
  ];
}
const setCharacters = async (node, characters, options) => {
  const fallbackFont = (options && options.fallbackFont) || {
    family: "Inter",
    style: "Regular",
  };
  try {
    if (node.fontName === figma.mixed) {
      if (options && options.smartStrategy === "prevail") {
        const fontHashTree = {};
        for (let i = 1; i < node.characters.length; i++) {
          const charFont = node.getRangeFontName(i - 1, i);
          const key = `${charFont.family}::${charFont.style}`;
          fontHashTree[key] = fontHashTree[key] ? fontHashTree[key] + 1 : 1;
        }
        const prevailedTreeItem = Object.entries(fontHashTree).sort(
          (a, b) => b[1] - a[1]
        )[0];
        const [family, style] = prevailedTreeItem[0].split("::");
        const prevailedFont = {
          family,
          style,
        };
        await figma.loadFontAsync(prevailedFont);
        node.fontName = prevailedFont;
      } else if (options && options.smartStrategy === "strict") {
        return setCharactersWithStrictMatchFont(node, characters, fallbackFont);
      } else if (options && options.smartStrategy === "experimental") {
        return setCharactersWithSmartMatchFont(node, characters, fallbackFont);
      } else {
        const firstCharFont = node.getRangeFontName(0, 1);
        await figma.loadFontAsync(firstCharFont);
        node.fontName = firstCharFont;
      }
    } else {
      await figma.loadFontAsync({
        family: node.fontName.family,
        style: node.fontName.style,
      });
    }
  } catch (err) {
    console.warn(
      `Failed to load "${node.fontName["family"]} ${node.fontName["style"]}" font and replaced with fallback "${fallbackFont.family} ${fallbackFont.style}"`,
      err
    );
    await figma.loadFontAsync(fallbackFont);
    node.fontName = fallbackFont;
  }
  try {
    node.characters = characters;
    return true;
  } catch (err) {
    console.warn(`Failed to set characters. Skipped.`, err);
    return false;
  }
};

const setCharactersWithStrictMatchFont = async (
  node,
  characters,
  fallbackFont
) => {
  const fontHashTree = {};
  for (let i = 1; i < node.characters.length; i++) {
    const startIdx = i - 1;
    const startCharFont = node.getRangeFontName(startIdx, i);
    const startCharFontVal = `${startCharFont.family}::${startCharFont.style}`;
    while (i < node.characters.length) {
      i++;
      const charFont = node.getRangeFontName(i - 1, i);
      if (startCharFontVal !== `${charFont.family}::${charFont.style}`) {
        break;
      }
    }
    fontHashTree[`${startIdx}_${i}`] = startCharFontVal;
  }
  await figma.loadFontAsync(fallbackFont);
  node.fontName = fallbackFont;
  node.characters = characters;
  console.log(fontHashTree);
  await Promise.all(
    Object.keys(fontHashTree).map(async (range) => {
      console.log(range, fontHashTree[range]);
      const [start, end] = range.split("_");
      const [family, style] = fontHashTree[range].split("::");
      const matchedFont = {
        family,
        style,
      };
      await figma.loadFontAsync(matchedFont);
      return node.setRangeFontName(Number(start), Number(end), matchedFont);
    })
  );
  return true;
};

const getDelimiterPos = (str, delimiter, startIdx = 0, endIdx = str.length) => {
  const indices = [];
  let temp = startIdx;
  for (let i = startIdx; i < endIdx; i++) {
    if (
      str[i] === delimiter &&
      i + startIdx !== endIdx &&
      temp !== i + startIdx
    ) {
      indices.push([temp, i + startIdx]);
      temp = i + startIdx + 1;
    }
  }
  temp !== endIdx && indices.push([temp, endIdx]);
  return indices.filter(Boolean);
};

const buildLinearOrder = (node) => {
  const fontTree = [];
  const newLinesPos = getDelimiterPos(node.characters, "\n");
  newLinesPos.forEach(([newLinesRangeStart, newLinesRangeEnd], n) => {
    const newLinesRangeFont = node.getRangeFontName(
      newLinesRangeStart,
      newLinesRangeEnd
    );
    if (newLinesRangeFont === figma.mixed) {
      const spacesPos = getDelimiterPos(
        node.characters,
        " ",
        newLinesRangeStart,
        newLinesRangeEnd
      );
      spacesPos.forEach(([spacesRangeStart, spacesRangeEnd], s) => {
        const spacesRangeFont = node.getRangeFontName(
          spacesRangeStart,
          spacesRangeEnd
        );
        if (spacesRangeFont === figma.mixed) {
          const spacesRangeFont = node.getRangeFontName(
            spacesRangeStart,
            spacesRangeStart[0]
          );
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        } else {
          fontTree.push({
            start: spacesRangeStart,
            delimiter: " ",
            family: spacesRangeFont.family,
            style: spacesRangeFont.style,
          });
        }
      });
    } else {
      fontTree.push({
        start: newLinesRangeStart,
        delimiter: "\n",
        family: newLinesRangeFont.family,
        style: newLinesRangeFont.style,
      });
    }
  });
  return fontTree
    .sort((a, b) => +a.start - +b.start)
    .map(({ family, style, delimiter }) => ({ family, style, delimiter }));
};

const setCharactersWithSmartMatchFont = async (
  node,
  characters,
  fallbackFont
) => {
  const rangeTree = buildLinearOrder(node);
  const fontsToLoad = uniqBy(
    rangeTree,
    ({ family, style }) => `${family}::${style}`
  ).map(({ family, style }) => ({
    family,
    style,
  }));

  await Promise.all([...fontsToLoad, fallbackFont].map(figma.loadFontAsync));

  node.fontName = fallbackFont;
  node.characters = characters;

  let prevPos = 0;
  rangeTree.forEach(({ family, style, delimiter }) => {
    if (prevPos < node.characters.length) {
      const delimeterPos = node.characters.indexOf(delimiter, prevPos);
      const endPos =
        delimeterPos > prevPos ? delimeterPos : node.characters.length;
      const matchedFont = {
        family,
        style,
      };
      node.setRangeFontName(prevPos, endPos, matchedFont);
      prevPos = endPos + 1;
    }
  });
  return true;
};

// Add the cloneNode function implementation
async function cloneNode(params) {
  const { nodeId, x, y } = params || {};

  if (!nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`);
  }

  // Clone the node
  const clone = node.clone();

  // If x and y are provided, move the clone to that position
  if (x !== undefined && y !== undefined) {
    if (!("x" in clone) || !("y" in clone)) {
      throw new Error(`Cloned node does not support position: ${nodeId}`);
    }
    clone.x = x;
    clone.y = y;
  }

  // Add the clone to the same parent as the original node
  if (node.parent) {
    node.parent.appendChild(clone);
  } else {
    figma.currentPage.appendChild(clone);
  }

  return {
    id: clone.id,
    name: clone.name,
    x: "x" in clone ? clone.x : undefined,
    y: "y" in clone ? clone.y : undefined,
    width: "width" in clone ? clone.width : undefined,
    height: "height" in clone ? clone.height : undefined,
  };
}

async function scanTextNodes(params) {
  console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`);
  const {
    nodeId,
    useChunking = true,
    chunkSize = 10,
    commandId = generateCommandId(),
  } = params || {};

  const node = await figma.getNodeByIdAsync(nodeId);

  if (!node) {
    console.error(`Node with ID ${nodeId} not found`);
    // Send error progress update
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "error",
      0,
      0,
      0,
      `Node with ID ${nodeId} not found`,
      { error: `Node not found: ${nodeId}` }
    );
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // If chunking is not enabled, use the original implementation
  if (!useChunking) {
    const textNodes = [];
    try {
      // Send started progress update
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "started",
        0,
        1, // Not known yet how many nodes there are
        0,
        `Starting scan of node "${node.name || nodeId}" without chunking`,
        null
      );

      await findTextNodes(node, [], 0, textNodes);

      // Send completed progress update
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "completed",
        100,
        textNodes.length,
        textNodes.length,
        `Scan complete. Found ${textNodes.length} text nodes.`,
        { textNodes }
      );

      return {
        success: true,
        message: `Scanned ${textNodes.length} text nodes.`,
        count: textNodes.length,
        textNodes: textNodes,
        commandId,
      };
    } catch (error) {
      console.error("Error scanning text nodes:", error);

      // Send error progress update
      sendProgressUpdate(
        commandId,
        "scan_text_nodes",
        "error",
        0,
        0,
        0,
        `Error scanning text nodes: ${error.message}`,
        { error: error.message }
      );

      throw new Error(`Error scanning text nodes: ${error.message}`);
    }
  }

  // Chunked implementation
  console.log(`Using chunked scanning with chunk size: ${chunkSize}`);

  // First, collect all nodes to process (without processing them yet)
  const nodesToProcess = [];

  // Send started progress update
  sendProgressUpdate(
    commandId,
    "scan_text_nodes",
    "started",
    0,
    0, // Not known yet how many nodes there are
    0,
    `Starting chunked scan of node "${node.name || nodeId}"`,
    { chunkSize }
  );

  await collectNodesToProcess(node, [], 0, nodesToProcess);

  const totalNodes = nodesToProcess.length;
  console.log(`Found ${totalNodes} total nodes to process`);

  // Calculate number of chunks needed
  const totalChunks = Math.ceil(totalNodes / chunkSize);
  console.log(`Will process in ${totalChunks} chunks`);

  // Send update after node collection
  sendProgressUpdate(
    commandId,
    "scan_text_nodes",
    "in_progress",
    5, // 5% progress for collection phase
    totalNodes,
    0,
    `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
    {
      totalNodes,
      totalChunks,
      chunkSize,
    }
  );

  // Process nodes in chunks
  const allTextNodes = [];
  let processedNodes = 0;
  let chunksProcessed = 0;

  for (let i = 0; i < totalNodes; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, totalNodes);
    console.log(
      `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1
      })`
    );

    // Send update before processing chunk
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
      {
        currentChunk: chunksProcessed + 1,
        totalChunks,
        textNodesFound: allTextNodes.length,
      }
    );

    const chunkNodes = nodesToProcess.slice(i, chunkEnd);
    const chunkTextNodes = [];

    // Process each node in this chunk
    for (const nodeInfo of chunkNodes) {
      if (nodeInfo.node.type === "TEXT") {
        try {
          const textNodeInfo = await processTextNode(
            nodeInfo.node,
            nodeInfo.parentPath,
            nodeInfo.depth
          );
          if (textNodeInfo) {
            chunkTextNodes.push(textNodeInfo);
          }
        } catch (error) {
          console.error(`Error processing text node: ${error.message}`);
          // Continue with other nodes
        }
      }

      // Brief delay to allow UI updates and prevent freezing
      await delay(5);
    }

    // Add results from this chunk
    allTextNodes.push(...chunkTextNodes);
    processedNodes += chunkNodes.length;
    chunksProcessed++;

    // Send update after processing chunk
    sendProgressUpdate(
      commandId,
      "scan_text_nodes",
      "in_progress",
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
      {
        currentChunk: chunksProcessed,
        totalChunks,
        processedNodes,
        textNodesFound: allTextNodes.length,
        chunkResult: chunkTextNodes,
      }
    );

    // Small delay between chunks to prevent UI freezing
    if (i + chunkSize < totalNodes) {
      await delay(50);
    }
  }

  // Send completed progress update
  sendProgressUpdate(
    commandId,
    "scan_text_nodes",
    "completed",
    100,
    totalNodes,
    processedNodes,
    `Scan complete. Found ${allTextNodes.length} text nodes.`,
    {
      textNodes: allTextNodes,
      processedNodes,
      chunks: chunksProcessed,
    }
  );

  return {
    success: true,
    message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
    totalNodes: allTextNodes.length,
    processedNodes: processedNodes,
    chunks: chunksProcessed,
    textNodes: allTextNodes,
    commandId,
  };
}

// Helper function to collect all nodes that need to be processed
async function collectNodesToProcess(
  node,
  parentPath = [],
  depth = 0,
  nodesToProcess = []
) {
  // Skip invisible nodes
  if (node.visible === false) return;

  // Get the path to this node
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

  // Add this node to the processing list
  nodesToProcess.push({
    node: node,
    parentPath: nodePath,
    depth: depth,
  });

  // Recursively add children
  if ("children" in node) {
    for (const child of node.children) {
      await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess);
    }
  }
}

// Process a single text node
async function processTextNode(node, parentPath, depth) {
  if (node.type !== "TEXT") return null;

  try {
    // Safely extract font information
    let fontFamily = "";
    let fontStyle = "";

    if (node.fontName) {
      if (typeof node.fontName === "object") {
        if ("family" in node.fontName) fontFamily = node.fontName.family;
        if ("style" in node.fontName) fontStyle = node.fontName.style;
      }
    }

    // Create a safe representation of the text node
    const safeTextNode = {
      id: node.id,
      name: node.name || "Text",
      type: node.type,
      characters: node.characters,
      fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
      fontFamily: fontFamily,
      fontStyle: fontStyle,
      x: typeof node.x === "number" ? node.x : 0,
      y: typeof node.y === "number" ? node.y : 0,
      width: typeof node.width === "number" ? node.width : 0,
      height: typeof node.height === "number" ? node.height : 0,
      path: parentPath.join(" > "),
      depth: depth,
    };

    // Highlight the node briefly (optional visual feedback)
    try {
      const originalFills = JSON.parse(JSON.stringify(node.fills));
      node.fills = [
        {
          type: "SOLID",
          color: { r: 1, g: 0.5, b: 0 },
          opacity: 0.3,
        },
      ];

      // Brief delay for the highlight to be visible
      await delay(100);

      try {
        node.fills = originalFills;
      } catch (err) {
        console.error("Error resetting fills:", err);
      }
    } catch (highlightErr) {
      console.error("Error highlighting text node:", highlightErr);
      // Continue anyway, highlighting is just visual feedback
    }

    return safeTextNode;
  } catch (nodeErr) {
    console.error("Error processing text node:", nodeErr);
    return null;
  }
}

// A delay function that returns a promise
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Keep the original findTextNodes for backward compatibility
async function findTextNodes(node, parentPath = [], depth = 0, textNodes = []) {
  // Skip invisible nodes
  if (node.visible === false) return;

  // Get the path to this node including its name
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`];

  if (node.type === "TEXT") {
    try {
      // Safely extract font information to avoid Symbol serialization issues
      let fontFamily = "";
      let fontStyle = "";

      if (node.fontName) {
        if (typeof node.fontName === "object") {
          if ("family" in node.fontName) fontFamily = node.fontName.family;
          if ("style" in node.fontName) fontStyle = node.fontName.style;
        }
      }

      // Create a safe representation of the text node with only serializable properties
      const safeTextNode = {
        id: node.id,
        name: node.name || "Text",
        type: node.type,
        characters: node.characters,
        fontSize: typeof node.fontSize === "number" ? node.fontSize : 0,
        fontFamily: fontFamily,
        fontStyle: fontStyle,
        x: typeof node.x === "number" ? node.x : 0,
        y: typeof node.y === "number" ? node.y : 0,
        width: typeof node.width === "number" ? node.width : 0,
        height: typeof node.height === "number" ? node.height : 0,
        path: nodePath.join(" > "),
        depth: depth,
      };

      // Only highlight the node if it's not being done via API
      try {
        // Safe way to create a temporary highlight without causing serialization issues
        const originalFills = JSON.parse(JSON.stringify(node.fills));
        node.fills = [
          {
            type: "SOLID",
            color: { r: 1, g: 0.5, b: 0 },
            opacity: 0.3,
          },
        ];

        // Promise-based delay instead of setTimeout
        await delay(500);

        try {
          node.fills = originalFills;
        } catch (err) {
          console.error("Error resetting fills:", err);
        }
      } catch (highlightErr) {
        console.error("Error highlighting text node:", highlightErr);
        // Continue anyway, highlighting is just visual feedback
      }

      textNodes.push(safeTextNode);
    } catch (nodeErr) {
      console.error("Error processing text node:", nodeErr);
      // Skip this node but continue with others
    }
  }

  // Recursively process children of container nodes
  if ("children" in node) {
    for (const child of node.children) {
      await findTextNodes(child, nodePath, depth + 1, textNodes);
    }
  }
}

// Replace text in a specific node
async function setMultipleTextContents(params) {
  const { nodeId, text } = params || {};
  const commandId = params.commandId || generateCommandId();

  if (!nodeId || !text || !Array.isArray(text)) {
    const errorMsg = "Missing required parameters: nodeId and text array";

    // Send error progress update
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "error",
      0,
      0,
      0,
      errorMsg,
      { error: errorMsg }
    );

    throw new Error(errorMsg);
  }

  console.log(
    `Starting text replacement for node: ${nodeId} with ${text.length} text replacements`
  );

  // Send started progress update
  sendProgressUpdate(
    commandId,
    "set_multiple_text_contents",
    "started",
    0,
    text.length,
    0,
    `Starting text replacement for ${text.length} nodes`,
    { totalReplacements: text.length }
  );

  // Define the results array and counters
  const results = [];
  let successCount = 0;
  let failureCount = 0;

  // Split text replacements into chunks of 5
  const CHUNK_SIZE = 5;
  const chunks = [];

  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Split ${text.length} replacements into ${chunks.length} chunks`);

  // Send chunking info update
  sendProgressUpdate(
    commandId,
    "set_multiple_text_contents",
    "in_progress",
    5, // 5% progress for planning phase
    text.length,
    0,
    `Preparing to replace text in ${text.length} nodes using ${chunks.length} chunks`,
    {
      totalReplacements: text.length,
      chunks: chunks.length,
      chunkSize: CHUNK_SIZE,
    }
  );

  // Process each chunk sequentially
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(
      `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length
      } replacements`
    );

    // Send chunk processing start update
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      Math.round(5 + (chunkIndex / chunks.length) * 90), // 5-95% for processing
      text.length,
      successCount + failureCount,
      `Processing text replacements chunk ${chunkIndex + 1}/${chunks.length}`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
      }
    );

    // Process replacements within a chunk in parallel
    const chunkPromises = chunk.map(async (replacement) => {
      if (!replacement.nodeId || replacement.text === undefined) {
        console.error(`Missing nodeId or text for replacement`);
        return {
          success: false,
          nodeId: replacement.nodeId || "unknown",
          error: "Missing nodeId or text in replacement entry",
        };
      }

      try {
        console.log(
          `Attempting to replace text in node: ${replacement.nodeId}`
        );

        // Get the text node to update (just to check it exists and get original text)
        const textNode = await figma.getNodeByIdAsync(replacement.nodeId);

        if (!textNode) {
          console.error(`Text node not found: ${replacement.nodeId}`);
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Node not found: ${replacement.nodeId}`,
          };
        }

        if (textNode.type !== "TEXT") {
          console.error(
            `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`
          );
          return {
            success: false,
            nodeId: replacement.nodeId,
            error: `Node is not a text node: ${replacement.nodeId} (type: ${textNode.type})`,
          };
        }

        // Save original text for the result
        const originalText = textNode.characters;
        console.log(`Original text: "${originalText}"`);
        console.log(`Will translate to: "${replacement.text}"`);

        // Highlight the node before changing text
        let originalFills;
        try {
          // Save original fills for restoration later
          originalFills = JSON.parse(JSON.stringify(textNode.fills));
          // Apply highlight color (orange with 30% opacity)
          textNode.fills = [
            {
              type: "SOLID",
              color: { r: 1, g: 0.5, b: 0 },
              opacity: 0.3,
            },
          ];
        } catch (highlightErr) {
          console.error(
            `Error highlighting text node: ${highlightErr.message}`
          );
          // Continue anyway, highlighting is just visual feedback
        }

        // Use the existing setTextContent function to handle font loading and text setting
        await setTextContent({
          nodeId: replacement.nodeId,
          text: replacement.text,
        });

        // Keep highlight for a moment after text change, then restore original fills
        if (originalFills) {
          try {
            // Use delay function for consistent timing
            await delay(500);
            textNode.fills = originalFills;
          } catch (restoreErr) {
            console.error(`Error restoring fills: ${restoreErr.message}`);
          }
        }

        console.log(
          `Successfully replaced text in node: ${replacement.nodeId}`
        );
        return {
          success: true,
          nodeId: replacement.nodeId,
          originalText: originalText,
          translatedText: replacement.text,
        };
      } catch (error) {
        console.error(
          `Error replacing text in node ${replacement.nodeId}: ${error.message}`
        );
        return {
          success: false,
          nodeId: replacement.nodeId,
          error: `Error applying replacement: ${error.message}`,
        };
      }
    });

    // Wait for all replacements in this chunk to complete
    const chunkResults = await Promise.all(chunkPromises);

    // Process results for this chunk
    chunkResults.forEach((result) => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      results.push(result);
    });

    // Send chunk processing complete update with partial results
    sendProgressUpdate(
      commandId,
      "set_multiple_text_contents",
      "in_progress",
      Math.round(5 + ((chunkIndex + 1) / chunks.length) * 90), // 5-95% for processing
      text.length,
      successCount + failureCount,
      `Completed chunk ${chunkIndex + 1}/${chunks.length
      }. ${successCount} successful, ${failureCount} failed so far.`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
        chunkResults: chunkResults,
      }
    );

    // Add a small delay between chunks to avoid overloading Figma
    if (chunkIndex < chunks.length - 1) {
      console.log("Pausing between chunks to avoid overloading Figma...");
      await delay(1000); // 1 second delay between chunks
    }
  }

  console.log(
    `Replacement complete: ${successCount} successful, ${failureCount} failed`
  );

  // Send completed progress update
  sendProgressUpdate(
    commandId,
    "set_multiple_text_contents",
    "completed",
    100,
    text.length,
    successCount + failureCount,
    `Text replacement complete: ${successCount} successful, ${failureCount} failed`,
    {
      totalReplacements: text.length,
      replacementsApplied: successCount,
      replacementsFailed: failureCount,
      completedInChunks: chunks.length,
      results: results,
    }
  );

  return {
    success: successCount > 0,
    nodeId: nodeId,
    replacementsApplied: successCount,
    replacementsFailed: failureCount,
    totalReplacements: text.length,
    results: results,
    completedInChunks: chunks.length,
    commandId,
  };
}

// Function to generate simple UUIDs for command IDs
function generateCommandId() {
  return (
    "cmd_" +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

async function deleteMultipleNodes(params) {
  const { nodeIds } = params || {};
  const commandId = generateCommandId();

  if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
    const errorMsg = "Missing or invalid nodeIds parameter";
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "error",
      0,
      0,
      0,
      errorMsg,
      { error: errorMsg }
    );
    throw new Error(errorMsg);
  }

  console.log(`Starting deletion of ${nodeIds.length} nodes`);

  // Send started progress update
  sendProgressUpdate(
    commandId,
    "delete_multiple_nodes",
    "started",
    0,
    nodeIds.length,
    0,
    `Starting deletion of ${nodeIds.length} nodes`,
    { totalNodes: nodeIds.length }
  );

  const results = [];
  let successCount = 0;
  let failureCount = 0;

  // Process nodes in chunks of 5 to avoid overwhelming Figma
  const CHUNK_SIZE = 5;
  const chunks = [];

  for (let i = 0; i < nodeIds.length; i += CHUNK_SIZE) {
    chunks.push(nodeIds.slice(i, i + CHUNK_SIZE));
  }

  console.log(`Split ${nodeIds.length} deletions into ${chunks.length} chunks`);

  // Send chunking info update
  sendProgressUpdate(
    commandId,
    "delete_multiple_nodes",
    "in_progress",
    5,
    nodeIds.length,
    0,
    `Preparing to delete ${nodeIds.length} nodes using ${chunks.length} chunks`,
    {
      totalNodes: nodeIds.length,
      chunks: chunks.length,
      chunkSize: CHUNK_SIZE,
    }
  );

  // Process each chunk sequentially
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    console.log(
      `Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length
      } nodes`
    );

    // Send chunk processing start update
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      Math.round(5 + (chunkIndex / chunks.length) * 90),
      nodeIds.length,
      successCount + failureCount,
      `Processing deletion chunk ${chunkIndex + 1}/${chunks.length}`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
      }
    );

    // Process deletions within a chunk in parallel
    const chunkPromises = chunk.map(async (nodeId) => {
      try {
        const node = await figma.getNodeByIdAsync(nodeId);

        if (!node) {
          console.error(`Node not found: ${nodeId}`);
          return {
            success: false,
            nodeId: nodeId,
            error: `Node not found: ${nodeId}`,
          };
        }

        // Save node info before deleting
        const nodeInfo = {
          id: node.id,
          name: node.name,
          type: node.type,
        };

        // Delete the node
        node.remove();

        console.log(`Successfully deleted node: ${nodeId}`);
        return {
          success: true,
          nodeId: nodeId,
          nodeInfo: nodeInfo,
        };
      } catch (error) {
        console.error(`Error deleting node ${nodeId}: ${error.message}`);
        return {
          success: false,
          nodeId: nodeId,
          error: error.message,
        };
      }
    });

    // Wait for all deletions in this chunk to complete
    const chunkResults = await Promise.all(chunkPromises);

    // Process results for this chunk
    chunkResults.forEach((result) => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
      results.push(result);
    });

    // Send chunk processing complete update
    sendProgressUpdate(
      commandId,
      "delete_multiple_nodes",
      "in_progress",
      Math.round(5 + ((chunkIndex + 1) / chunks.length) * 90),
      nodeIds.length,
      successCount + failureCount,
      `Completed chunk ${chunkIndex + 1}/${chunks.length
      }. ${successCount} successful, ${failureCount} failed so far.`,
      {
        currentChunk: chunkIndex + 1,
        totalChunks: chunks.length,
        successCount,
        failureCount,
        chunkResults: chunkResults,
      }
    );

    // Add a small delay between chunks
    if (chunkIndex < chunks.length - 1) {
      console.log("Pausing between chunks...");
      await delay(1000);
    }
  }

  console.log(
    `Deletion complete: ${successCount} successful, ${failureCount} failed`
  );

  // Send completed progress update
  sendProgressUpdate(
    commandId,
    "delete_multiple_nodes",
    "completed",
    100,
    nodeIds.length,
    successCount + failureCount,
    `Node deletion complete: ${successCount} successful, ${failureCount} failed`,
    {
      totalNodes: nodeIds.length,
      nodesDeleted: successCount,
      nodesFailed: failureCount,
      completedInChunks: chunks.length,
      results: results,
    }
  );

  return {
    success: successCount > 0,
    nodesDeleted: successCount,
    nodesFailed: failureCount,
    totalNodes: nodeIds.length,
    results: results,
    completedInChunks: chunks.length,
    commandId,
  };
}

// Implementation for getInstanceOverrides function
async function getInstanceOverrides(instanceNode = null) {
  console.log("=== getInstanceOverrides called ===");

  let sourceInstance = null;

  // Check if an instance node was passed directly
  if (instanceNode) {
    console.log("Using provided instance node");

    // Validate that the provided node is an instance
    if (instanceNode.type !== "INSTANCE") {
      console.error("Provided node is not an instance");
      figma.notify("Provided node is not a component instance");
      return { success: false, message: "Provided node is not a component instance" };
    }

    sourceInstance = instanceNode;
  } else {
    // No node provided, use selection
    console.log("No node provided, using current selection");

    // Get the current selection
    const selection = figma.currentPage.selection;

    // Check if there's anything selected
    if (selection.length === 0) {
      console.log("No nodes selected");
      figma.notify("Please select at least one instance");
      return { success: false, message: "No nodes selected" };
    }

    // Filter for instances in the selection
    const instances = selection.filter(node => node.type === "INSTANCE");

    if (instances.length === 0) {
      console.log("No instances found in selection");
      figma.notify("Please select at least one component instance");
      return { success: false, message: "No instances found in selection" };
    }

    // Take the first instance from the selection
    sourceInstance = instances[0];
  }

  try {
    console.log(`Getting instance information:`);
    console.log(sourceInstance);

    // Get component overrides and main component
    const overrides = sourceInstance.overrides || [];
    console.log(`  Raw Overrides:`, overrides);

    // Get main component
    const mainComponent = await sourceInstance.getMainComponentAsync();
    if (!mainComponent) {
      console.error("Failed to get main component");
      figma.notify("Failed to get main component");
      return { success: false, message: "Failed to get main component" };
    }

    // return data to MCP server
    const returnData = {
      success: true,
      message: `Got component information from "${sourceInstance.name}" for overrides.length: ${overrides.length}`,
      sourceInstanceId: sourceInstance.id,
      mainComponentId: mainComponent.id,
      overridesCount: overrides.length
    };

    console.log("Data to return to MCP server:", returnData);
    figma.notify(`Got component information from "${sourceInstance.name}"`);

    return returnData;
  } catch (error) {
    console.error("Error in getInstanceOverrides:", error);
    figma.notify(`Error: ${error.message}`);
    return {
      success: false,
      message: `Error: ${error.message}`
    };
  }
}

async function setLayoutMode(params) {
  const { nodeId, layoutMode = "NONE", layoutWrap = "NO_WRAP" } = params || {};

  // Get the target node
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // Check if node is a frame or component that supports layoutMode
  if (
    node.type !== "FRAME" &&
    node.type !== "COMPONENT" &&
    node.type !== "COMPONENT_SET" &&
    node.type !== "INSTANCE"
  ) {
    throw new Error(`Node type ${node.type} does not support layoutMode`);
  }

  // Set layout mode
  node.layoutMode = layoutMode;

  // Set layoutWrap if applicable
  if (layoutMode !== "NONE") {
    node.layoutWrap = layoutWrap;
  }

  return {
    id: node.id,
    name: node.name,
    layoutMode: node.layoutMode,
    layoutWrap: node.layoutWrap,
  };
}

async function setPadding(params) {
  const { nodeId, paddingTop, paddingRight, paddingBottom, paddingLeft } =
    params || {};

  // Get the target node
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // Check if node is a frame or component that supports padding
  if (
    node.type !== "FRAME" &&
    node.type !== "COMPONENT" &&
    node.type !== "COMPONENT_SET" &&
    node.type !== "INSTANCE"
  ) {
    throw new Error(`Node type ${node.type} does not support padding`);
  }

  // Check if the node has auto-layout enabled
  if (node.layoutMode === "NONE") {
    throw new Error(
      "Padding can only be set on auto-layout frames (layoutMode must not be NONE)"
    );
  }

  // Set padding values if provided
  if (paddingTop !== undefined) node.paddingTop = paddingTop;
  if (paddingRight !== undefined) node.paddingRight = paddingRight;
  if (paddingBottom !== undefined) node.paddingBottom = paddingBottom;
  if (paddingLeft !== undefined) node.paddingLeft = paddingLeft;

  return {
    id: node.id,
    name: node.name,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
  };
}

async function setAxisAlign(params) {
  const { nodeId, primaryAxisAlignItems, counterAxisAlignItems } = params || {};

  // Get the target node
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // Check if node is a frame or component that supports axis alignment
  if (
    node.type !== "FRAME" &&
    node.type !== "COMPONENT" &&
    node.type !== "COMPONENT_SET" &&
    node.type !== "INSTANCE"
  ) {
    throw new Error(`Node type ${node.type} does not support axis alignment`);
  }

  // Check if the node has auto-layout enabled
  if (node.layoutMode === "NONE") {
    throw new Error(
      "Axis alignment can only be set on auto-layout frames (layoutMode must not be NONE)"
    );
  }

  // Validate and set primaryAxisAlignItems if provided
  if (primaryAxisAlignItems !== undefined) {
    if (
      !["MIN", "MAX", "CENTER", "SPACE_BETWEEN"].includes(primaryAxisAlignItems)
    ) {
      throw new Error(
        "Invalid primaryAxisAlignItems value. Must be one of: MIN, MAX, CENTER, SPACE_BETWEEN"
      );
    }
    node.primaryAxisAlignItems = primaryAxisAlignItems;
  }

  // Validate and set counterAxisAlignItems if provided
  if (counterAxisAlignItems !== undefined) {
    if (!["MIN", "MAX", "CENTER", "BASELINE"].includes(counterAxisAlignItems)) {
      throw new Error(
        "Invalid counterAxisAlignItems value. Must be one of: MIN, MAX, CENTER, BASELINE"
      );
    }
    // BASELINE is only valid for horizontal layout
    if (
      counterAxisAlignItems === "BASELINE" &&
      node.layoutMode !== "HORIZONTAL"
    ) {
      throw new Error(
        "BASELINE alignment is only valid for horizontal auto-layout frames"
      );
    }
    node.counterAxisAlignItems = counterAxisAlignItems;
  }

  return {
    id: node.id,
    name: node.name,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,
    layoutMode: node.layoutMode,
  };
}

async function setLayoutSizing(params) {
  const { nodeId, layoutSizingHorizontal, layoutSizingVertical } = params || {};

  // Get the target node
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // Check if node supports layout sizing
  var isAutoLayoutContainer = ["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE"].includes(node.type);
  var isAutoLayoutChild = node.parent && node.parent.layoutMode && node.parent.layoutMode !== "NONE";

  if (!isAutoLayoutContainer && !isAutoLayoutChild) {
    throw new Error(`Node type ${node.type} does not support layout sizing (must be an auto-layout container or child of one)`);
  }

  // For containers, check if auto-layout is enabled (children don't need this check)
  if (isAutoLayoutContainer && node.layoutMode === "NONE") {
    throw new Error(
      "Layout sizing can only be set on auto-layout frames (layoutMode must not be NONE)"
    );
  }

  // Validate and set layoutSizingHorizontal if provided
  if (layoutSizingHorizontal !== undefined) {
    if (!["FIXED", "HUG", "FILL"].includes(layoutSizingHorizontal)) {
      throw new Error(
        "Invalid layoutSizingHorizontal value. Must be one of: FIXED, HUG, FILL"
      );
    }
    // HUG is only valid on auto-layout frames, components, and text nodes
    if (
      layoutSizingHorizontal === "HUG" &&
      !["FRAME", "COMPONENT", "COMPONENT_SET", "TEXT"].includes(node.type)
    ) {
      throw new Error(
        "HUG sizing is only valid on auto-layout frames, components, and text nodes"
      );
    }
    // FILL is only valid on auto-layout children
    if (
      layoutSizingHorizontal === "FILL" &&
      (!node.parent || node.parent.layoutMode === "NONE")
    ) {
      throw new Error("FILL sizing is only valid on auto-layout children");
    }
    node.layoutSizingHorizontal = layoutSizingHorizontal;
  }

  // Validate and set layoutSizingVertical if provided
  if (layoutSizingVertical !== undefined) {
    if (!["FIXED", "HUG", "FILL"].includes(layoutSizingVertical)) {
      throw new Error(
        "Invalid layoutSizingVertical value. Must be one of: FIXED, HUG, FILL"
      );
    }
    // HUG is only valid on auto-layout frames, components, and text nodes
    if (
      layoutSizingVertical === "HUG" &&
      !["FRAME", "COMPONENT", "COMPONENT_SET", "TEXT"].includes(node.type)
    ) {
      throw new Error(
        "HUG sizing is only valid on auto-layout frames, components, and text nodes"
      );
    }
    // FILL is only valid on auto-layout children
    if (
      layoutSizingVertical === "FILL" &&
      (!node.parent || node.parent.layoutMode === "NONE")
    ) {
      throw new Error("FILL sizing is only valid on auto-layout children");
    }
    node.layoutSizingVertical = layoutSizingVertical;
  }

  return {
    id: node.id,
    name: node.name,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    layoutMode: node.layoutMode,
  };
}

async function setItemSpacing(params) {
  const { nodeId, itemSpacing, counterAxisSpacing } = params || {};

  // Validate that at least one spacing parameter is provided
  if (itemSpacing === undefined && counterAxisSpacing === undefined) {
    throw new Error("At least one of itemSpacing or counterAxisSpacing must be provided");
  }

  // Get the target node
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`);
  }

  // Check if node is a frame or component that supports item spacing
  if (
    node.type !== "FRAME" &&
    node.type !== "COMPONENT" &&
    node.type !== "COMPONENT_SET" &&
    node.type !== "INSTANCE"
  ) {
    throw new Error(`Node type ${node.type} does not support item spacing`);
  }

  // Check if the node has auto-layout enabled
  if (node.layoutMode === "NONE") {
    throw new Error(
      "Item spacing can only be set on auto-layout frames (layoutMode must not be NONE)"
    );
  }

  // Set item spacing if provided
  if (itemSpacing !== undefined) {
    if (typeof itemSpacing !== "number") {
      throw new Error("Item spacing must be a number");
    }
    node.itemSpacing = itemSpacing;
  }

  // Set counter axis spacing if provided
  if (counterAxisSpacing !== undefined) {
    if (typeof counterAxisSpacing !== "number") {
      throw new Error("Counter axis spacing must be a number");
    }
    // counterAxisSpacing only applies when layoutWrap is WRAP
    if (node.layoutWrap !== "WRAP") {
      throw new Error(
        "Counter axis spacing can only be set on frames with layoutWrap set to WRAP"
      );
    }
    node.counterAxisSpacing = counterAxisSpacing;
  }

  return {
    id: node.id,
    name: node.name,
    itemSpacing: node.itemSpacing,
    counterAxisSpacing: node.counterAxisSpacing,
    layoutMode: node.layoutMode,
    layoutWrap: node.layoutWrap,
  };
}

// Set focus on a specific node
async function setFocus(params) {
  if (!params || !params.nodeId) {
    throw new Error("Missing nodeId parameter");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) {
    throw new Error(`Node with ID ${params.nodeId} not found`);
  }

  // Set selection to the node
  figma.currentPage.selection = [node];
  
  // Scroll and zoom to show the node in viewport
  figma.viewport.scrollAndZoomIntoView([node]);

  return {
    success: true,
    name: node.name,
    id: node.id,
    message: `Focused on node "${node.name}"`
  };
}

// Set selection to multiple nodes
async function setSelections(params) {
  if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
    throw new Error("Missing or invalid nodeIds parameter");
  }

  if (params.nodeIds.length === 0) {
    throw new Error("nodeIds array cannot be empty");
  }

  // Get all valid nodes
  const nodes = [];
  const notFoundIds = [];
  
  for (const nodeId of params.nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (node) {
      nodes.push(node);
    } else {
      notFoundIds.push(nodeId);
    }
  }

  if (nodes.length === 0) {
    throw new Error(`No valid nodes found for the provided IDs: ${params.nodeIds.join(', ')}`);
  }

  // Set selection to the nodes
  figma.currentPage.selection = nodes;
  
  // Scroll and zoom to show all nodes in viewport
  figma.viewport.scrollAndZoomIntoView(nodes);

  const selectedNodes = nodes.map(node => ({
    name: node.name,
    id: node.id
  }));

  return {
    success: true,
    count: nodes.length,
    selectedNodes: selectedNodes,
    notFoundIds: notFoundIds,
    message: `Selected ${nodes.length} nodes${notFoundIds.length > 0 ? ` (${notFoundIds.length} not found)` : ''}`
  };
}

// Create a new component
async function createComponent(params) {
  const {
    name, x = 0, y = 0, width = 100, height = 100, parentId,
    fillColor, strokeColor, strokeWeight, cornerRadius,
    layoutMode = "NONE", layoutWrap = "NO_WRAP",
    paddingTop = 0, paddingRight = 0, paddingBottom = 0, paddingLeft = 0,
    primaryAxisAlignItems = "MIN", counterAxisAlignItems = "MIN",
    layoutSizingHorizontal = "FIXED", layoutSizingVertical = "FIXED",
    itemSpacing = 0,
  } = params || {};
  if (!name) throw new Error("Missing name parameter");

  // Track whether we need to defer FILL sizing until after appendChild
  const deferHorizontalFill = parentId && layoutSizingHorizontal === "FILL";
  const deferVerticalFill = parentId && layoutSizingVertical === "FILL";

  const component = figma.createComponent();
  component.name = name;
  component.x = x;
  component.y = y;
  component.resize(width, height);
  component.fills = []; // transparent by default

  // Set layout mode if provided
  if (layoutMode !== "NONE") {
    component.layoutMode = layoutMode;
    component.layoutWrap = layoutWrap;
    component.paddingTop = paddingTop;
    component.paddingRight = paddingRight;
    component.paddingBottom = paddingBottom;
    component.paddingLeft = paddingLeft;
    component.primaryAxisAlignItems = primaryAxisAlignItems;
    component.counterAxisAlignItems = counterAxisAlignItems;
    // Defer FILL until after appendChild (FILL requires auto-layout parent)
    component.layoutSizingHorizontal = deferHorizontalFill ? "FIXED" : layoutSizingHorizontal;
    component.layoutSizingVertical = deferVerticalFill ? "FIXED" : layoutSizingVertical;
    component.itemSpacing = itemSpacing;
  }

  // Set fill color if provided
  if (fillColor) {
    component.fills = [{
      type: "SOLID",
      color: { r: fillColor.r !== undefined ? fillColor.r : 0, g: fillColor.g !== undefined ? fillColor.g : 0, b: fillColor.b !== undefined ? fillColor.b : 0 },
      opacity: fillColor.a !== undefined ? fillColor.a : 1,
    }];
  }

  // Set stroke if provided
  if (strokeColor) {
    component.strokes = [{
      type: "SOLID",
      color: { r: strokeColor.r !== undefined ? strokeColor.r : 0, g: strokeColor.g !== undefined ? strokeColor.g : 0, b: strokeColor.b !== undefined ? strokeColor.b : 0 },
      opacity: strokeColor.a !== undefined ? strokeColor.a : 1,
    }];
  }
  if (strokeWeight !== undefined) component.strokeWeight = strokeWeight;

  // Set corner radius if provided
  if (cornerRadius !== undefined) component.cornerRadius = cornerRadius;

  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (parent && "appendChild" in parent) {
      parent.appendChild(component);

      // Apply deferred FILL sizing now that node is a child of the parent
      if (deferHorizontalFill) {
        try { component.layoutSizingHorizontal = "FILL"; } catch (_) {}
      }
      if (deferVerticalFill) {
        try { component.layoutSizingVertical = "FILL"; } catch (_) {}
      }
    }
  }

  return {
    id: component.id,
    key: component.key,
    name: component.name,
    width: component.width,
    height: component.height,
  };
}

// Convert an existing node into a component
async function createComponentFromNode(params) {
  if (!params || !params.nodeId) throw new Error("Missing nodeId parameter");

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("parent" in node) || !node.parent) throw new Error("Node has no parent");

  const parent = node.parent;
  const index = parent.children.indexOf(node);
  const component = figma.createComponent();
  component.name = node.name;

  if ("width" in node && "height" in node) {
    component.resize(node.width, node.height);
  }
  if ("x" in node && "y" in node) {
    component.x = node.x;
    component.y = node.y;
  }

  // Move children from clone into the component
  const clone = node.clone();
  clone.x = 0;
  clone.y = 0;
  component.appendChild(clone);

  // Insert component at original position and remove original
  parent.insertChild(index, component);
  node.remove();

  return {
    id: component.id,
    key: component.key,
    name: component.name,
  };
}

// Combine multiple components into a variant set
async function combineAsVariants(params) {
  if (!params || !params.componentIds || !Array.isArray(params.componentIds)) {
    throw new Error("Missing or invalid componentIds parameter");
  }
  if (params.componentIds.length < 2) {
    throw new Error("Need at least 2 components to combine as variants");
  }

  const components = [];
  for (const id of params.componentIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Component not found: ${id}`);
    if (node.type !== "COMPONENT") throw new Error(`Node ${id} is not a component (type: ${node.type})`);
    components.push(node);
  }

  const componentSet = figma.combineAsVariants(components, figma.currentPage);
  if (params.name) {
    componentSet.name = params.name;
  }

  return {
    id: componentSet.id,
    key: componentSet.key,
    name: componentSet.name,
    variantCount: componentSet.children.length,
  };
}

// Add a property to a component
async function addComponentProperty(params) {
  if (!params || !params.componentId || !params.propertyName || !params.type) {
    throw new Error("Missing required parameters: componentId, propertyName, type");
  }

  const node = await figma.getNodeByIdAsync(params.componentId);
  if (!node) throw new Error(`Node not found: ${params.componentId}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new Error(`Node is not a component or component set (type: ${node.type})`);
  }

  const options = { type: params.type, defaultValue: params.defaultValue };
  if (params.preferredValues) {
    options.preferredValues = params.preferredValues;
  }

  const propertyName = node.addComponentProperty(params.propertyName, params.type, params.defaultValue);

  return {
    id: node.id,
    name: node.name,
    propertyName: propertyName,
    componentPropertyDefinitions: node.componentPropertyDefinitions,
  };
}

// Create an instance of a local component by node ID
async function createInstanceFromLocal(params) {
  if (!params || !params.componentId) throw new Error("Missing componentId parameter");

  var node = await figma.getNodeByIdAsync(params.componentId);
  if (!node) throw new Error(`Component not found: ${params.componentId}`);

  // If a COMPONENT_SET is given, pick the default variant (first child)
  if (node.type === "COMPONENT_SET") {
    if (!node.children || node.children.length === 0) {
      throw new Error("Component set has no variants");
    }
    node = node.defaultVariant || node.children[0];
  }

  if (node.type !== "COMPONENT") throw new Error(`Node is not a component or component set (type: ${node.type})`);

  const instance = node.createInstance();
  if (params.x !== undefined) instance.x = params.x;
  if (params.y !== undefined) instance.y = params.y;

  if (params.parentId) {
    const parent = await figma.getNodeByIdAsync(params.parentId);
    if (parent && "appendChild" in parent) {
      parent.appendChild(instance);
    }
  }

  return {
    id: instance.id,
    name: instance.name,
    componentId: node.id,
    width: instance.width,
    height: instance.height,
  };
}

// Create a new variable collection
async function createVariableCollection(params) {
  if (!params || !params.name) throw new Error("Missing name parameter");

  const collection = figma.variables.createVariableCollection(params.name);

  return {
    id: collection.id,
    name: collection.name,
    modes: collection.modes,
    defaultModeId: collection.defaultModeId,
  };
}

// Add a mode to a variable collection
async function addMode(params) {
  if (!params || !params.collectionId || !params.name) {
    throw new Error("Missing required parameters: collectionId, name");
  }
  const collection = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
  if (!collection) throw new Error(`Collection not found: ${params.collectionId}`);

  const modeId = collection.addMode(params.name);
  return {
    collectionId: collection.id,
    modeId: modeId,
    name: params.name,
    modes: collection.modes,
  };
}

// Rename a mode in a variable collection
async function renameMode(params) {
  if (!params || !params.collectionId || !params.modeId || !params.name) {
    throw new Error("Missing required parameters: collectionId, modeId, name");
  }
  const collection = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
  if (!collection) throw new Error(`Collection not found: ${params.collectionId}`);

  collection.renameMode(params.modeId, params.name);
  return {
    collectionId: collection.id,
    modeId: params.modeId,
    name: params.name,
    modes: collection.modes,
  };
}

// Remove a mode from a variable collection
async function removeMode(params) {
  if (!params || !params.collectionId || !params.modeId) {
    throw new Error("Missing required parameters: collectionId, modeId");
  }
  const collection = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
  if (!collection) throw new Error(`Collection not found: ${params.collectionId}`);

  collection.removeMode(params.modeId);
  return {
    collectionId: collection.id,
    removedModeId: params.modeId,
    modes: collection.modes,
  };
}

// Rename a page
async function renamePage(params) {
  if (!params || !params.newName) throw new Error("Missing newName parameter");

  var page;
  if (params.pageId) {
    page = await figma.getNodeByIdAsync(params.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
  } else {
    page = figma.currentPage;
  }

  var oldName = page.name;
  page.name = params.newName;
  return { id: page.id, oldName: oldName, newName: page.name };
}

// Zoom viewport to fit specific nodes (like pressing Shift+1)
async function zoomIntoView(params) {
  if (!params || !params.nodeIds || !Array.isArray(params.nodeIds) || params.nodeIds.length === 0) {
    throw new Error("Missing nodeIds parameter (array of node IDs)");
  }

  var nodes = [];
  var notFound = [];
  for (var i = 0; i < params.nodeIds.length; i++) {
    var node = await figma.getNodeByIdAsync(params.nodeIds[i]);
    if (node) {
      nodes.push(node);
    } else {
      notFound.push(params.nodeIds[i]);
    }
  }

  if (nodes.length === 0) throw new Error("None of the specified nodes were found");

  figma.viewport.scrollAndZoomIntoView(nodes);

  return {
    viewportCenter: figma.viewport.center,
    viewportZoom: figma.viewport.zoom,
    nodeCount: nodes.length,
    notFound: notFound.length > 0 ? notFound : undefined,
  };
}

// Set viewport center and/or zoom level
async function setViewport(params) {
  if (!params) throw new Error("Missing parameters");

  if (params.center) {
    figma.viewport.center = { x: params.center.x, y: params.center.y };
  }
  if (params.zoom !== undefined) {
    figma.viewport.zoom = params.zoom;
  }

  return {
    center: figma.viewport.center,
    zoom: figma.viewport.zoom,
    bounds: figma.viewport.bounds,
  };
}

// Create a new variable in a collection
async function createVariable(params) {
  if (!params || !params.collectionId || !params.name || !params.resolvedType) {
    throw new Error("Missing required parameters: collectionId, name, resolvedType");
  }

  // Must pass collection node (not ID string) in incremental mode
  const collection = await figma.variables.getVariableCollectionByIdAsync(params.collectionId);
  if (!collection) throw new Error(`Variable collection not found: ${params.collectionId}`);

  const variable = figma.variables.createVariable(params.name, collection, params.resolvedType);

  return {
    id: variable.id,
    name: variable.name,
    key: variable.key,
    resolvedType: variable.resolvedType,
    variableCollectionId: variable.variableCollectionId,
  };
}

// Set a variable's value for a specific mode
async function setVariableValue(params) {
  if (!params || !params.variableId || !params.modeId || params.value === undefined) {
    throw new Error("Missing required parameters: variableId, modeId, value");
  }

  const variable = await figma.variables.getVariableByIdAsync(params.variableId);
  if (!variable) throw new Error(`Variable not found: ${params.variableId}`);

  let value = params.value;
  // Convert color object to Figma RGBA if needed
  if (typeof value === "object" && value !== null && "r" in value) {
    value = { r: value.r, g: value.g, b: value.b, a: value.a !== undefined ? value.a : 1 };
  }

  variable.setValueForMode(params.modeId, value);

  return {
    id: variable.id,
    name: variable.name,
    modeId: params.modeId,
    value: value,
  };
}

// Get local variables with optional type/collection filter
async function getLocalVariables(params) {
  let variables;
  if (params && params.type) {
    variables = await figma.variables.getLocalVariablesAsync(params.type);
  } else {
    variables = await figma.variables.getLocalVariablesAsync();
  }

  // Filter by collection ID
  if (params && params.collectionId) {
    variables = variables.filter(v => v.variableCollectionId === params.collectionId);
  }

  return {
    count: variables.length,
    variables: variables.map(v => ({
      id: v.id,
      name: v.name,
      key: v.key,
      resolvedType: v.resolvedType,
      variableCollectionId: v.variableCollectionId,
    })),
  };
}

// Get all local variable collections
async function getLocalVariableCollections() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  return {
    count: collections.length,
    collections: collections.map(c => ({
      id: c.id,
      name: c.name,
      key: c.key,
      modes: c.modes,
      defaultModeId: c.defaultModeId,
      variableIds: c.variableIds,
    })),
  };
}

// Bind a variable to a node property
async function setVariableBinding(params) {
  if (!params || !params.nodeId || !params.field || !params.variableId) {
    throw new Error("Missing required parameters: nodeId, field, variableId");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  const variable = await figma.variables.getVariableByIdAsync(params.variableId);
  if (!variable) throw new Error(`Variable not found: ${params.variableId}`);

  // Paint-level binding: fills or strokes + color variable
  // Uses figma.variables.setBoundVariableForPaint() which returns a new paint
  var paintMatch = params.field.match(/^(fills|strokes)\/(\d+)\/color$/);
  if (paintMatch) {
    var prop = paintMatch[1]; // "fills" or "strokes"
    var index = parseInt(paintMatch[2], 10);

    if (!(prop in node)) throw new Error(`Node does not have ${prop}`);
    var paints = node[prop].slice(); // clone array
    if (index >= paints.length) throw new Error(`${prop} index ${index} out of range (has ${paints.length})`);

    var newPaint = figma.variables.setBoundVariableForPaint(paints[index], "color", variable);
    paints[index] = newPaint;
    node[prop] = paints;

    return {
      id: node.id,
      name: node.name,
      field: params.field,
      variableId: variable.id,
      variableName: variable.name,
    };
  }

  // Scalar node-level binding (opacity, width, padding, etc.)
  if ("setBoundVariable" in node) {
    node.setBoundVariable(params.field, variable);
  } else {
    throw new Error("Node does not support variable binding");
  }

  return {
    id: node.id,
    name: node.name,
    field: params.field,
    variableId: variable.id,
    variableName: variable.name,
  };
}

// Create a paint/color style
async function createPaintStyle(params) {
  if (!params || !params.name || !params.color) {
    throw new Error("Missing required parameters: name, color");
  }

  const style = figma.createPaintStyle();
  style.name = params.name;

  const { r, g, b, a = 1 } = params.color;
  style.paints = [{ type: "SOLID", color: { r, g, b }, opacity: a }];

  return {
    id: style.id,
    key: style.key,
    name: style.name,
  };
}

// Create a text style with font properties
async function createTextStyleHandler(params) {
  if (!params || !params.name || !params.fontFamily || !params.fontSize) {
    throw new Error("Missing required parameters: name, fontFamily, fontSize");
  }

  const style = figma.createTextStyle();
  style.name = params.name;

  const fontStyle = params.fontStyle || "Regular";
  await figma.loadFontAsync({ family: params.fontFamily, style: fontStyle });

  style.fontName = { family: params.fontFamily, style: fontStyle };
  style.fontSize = params.fontSize;

  if (params.lineHeight !== undefined) {
    if (typeof params.lineHeight === "number") {
      style.lineHeight = { value: params.lineHeight, unit: "PIXELS" };
    } else if (params.lineHeight.unit === "AUTO") {
      style.lineHeight = { unit: "AUTO" };
    } else {
      style.lineHeight = { value: params.lineHeight.value, unit: params.lineHeight.unit };
    }
  }

  if (params.letterSpacing !== undefined) {
    if (typeof params.letterSpacing === "number") {
      style.letterSpacing = { value: params.letterSpacing, unit: "PIXELS" };
    } else {
      style.letterSpacing = { value: params.letterSpacing.value, unit: params.letterSpacing.unit };
    }
  }

  if (params.textCase) style.textCase = params.textCase;
  if (params.textDecoration) style.textDecoration = params.textDecoration;

  return {
    id: style.id,
    key: style.key,
    name: style.name,
  };
}

// Create an effect style (shadows, blurs)
async function createEffectStyle(params) {
  if (!params || !params.name || !params.effects) {
    throw new Error("Missing required parameters: name, effects");
  }

  const style = figma.createEffectStyle();
  style.name = params.name;

  style.effects = params.effects.map(e => {
    const effect = {
      type: e.type,
      radius: e.radius,
      visible: e.visible !== undefined ? e.visible : true,
    };
    // Shadows require blendMode — default to NORMAL
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      effect.blendMode = e.blendMode || "NORMAL";
    }
    if (e.color) {
      effect.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a !== undefined ? e.color.a : 1 };
    }
    if (e.offset) {
      effect.offset = { x: e.offset.x, y: e.offset.y };
    }
    if (e.spread !== undefined) {
      effect.spread = e.spread;
    }
    return effect;
  });

  return {
    id: style.id,
    key: style.key,
    name: style.name,
  };
}

// Apply a style to a node
async function applyStyleToNode(params) {
  if (!params || !params.nodeId || !params.styleType) {
    throw new Error("Missing required parameters: nodeId, styleType");
  }
  if (!params.styleId && !params.styleName) {
    throw new Error("Must provide either styleId or styleName");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  // Resolve style by name if no ID provided
  let styleId = params.styleId;
  if (!styleId && params.styleName) {
    const allStyles = await figma.getLocalPaintStylesAsync();
    const allTextStyles = await figma.getLocalTextStylesAsync();
    const allEffectStyles = await figma.getLocalEffectStylesAsync();
    const all = [...allStyles, ...allTextStyles, ...allEffectStyles];
    const match = all.find(s => s.name === params.styleName);
    if (!match) {
      // Try case-insensitive substring match
      const fuzzy = all.find(s => s.name.toLowerCase().includes(params.styleName.toLowerCase()));
      if (!fuzzy) throw new Error(`Style not found: "${params.styleName}". Use get_styles to list available styles.`);
      styleId = fuzzy.id;
    } else {
      styleId = match.id;
    }
  }

  switch (params.styleType) {
    case "fill":
      if ("setFillStyleIdAsync" in node) await node.setFillStyleIdAsync(styleId);
      else throw new Error("Node does not support fill styles");
      break;
    case "stroke":
      if ("setStrokeStyleIdAsync" in node) await node.setStrokeStyleIdAsync(styleId);
      else throw new Error("Node does not support stroke styles");
      break;
    case "text":
      if ("setTextStyleIdAsync" in node) await node.setTextStyleIdAsync(styleId);
      else throw new Error("Node does not support text styles");
      break;
    case "effect":
      if ("setEffectStyleIdAsync" in node) await node.setEffectStyleIdAsync(styleId);
      else throw new Error("Node does not support effect styles");
      break;
    default:
      throw new Error(`Unknown style type: ${params.styleType}`);
  }

  return {
    id: node.id,
    name: node.name,
    styleType: params.styleType,
    styleId: styleId,
  };
}

// Create an ellipse
async function createEllipse(params) {
  if (!params) throw new Error("Missing parameters");

  const ellipse = figma.createEllipse();
  ellipse.x = params.x !== undefined ? params.x : 0;
  ellipse.y = params.y !== undefined ? params.y : 0;
  ellipse.resize(params.width !== undefined ? params.width : 100, params.height !== undefined ? params.height : 100);
  if (params.name) ellipse.name = params.name;

  if (params.parentId) {
    const parent = await figma.getNodeByIdAsync(params.parentId);
    if (parent && "appendChild" in parent) parent.appendChild(ellipse);
  }

  return {
    id: ellipse.id,
    name: ellipse.name,
    width: ellipse.width,
    height: ellipse.height,
  };
}

// Create a line
async function createLine(params) {
  if (!params) throw new Error("Missing parameters");

  const line = figma.createLine();
  line.x = params.x !== undefined ? params.x : 0;
  line.y = params.y !== undefined ? params.y : 0;
  line.resize(params.length !== undefined ? params.length : 100, 0);
  if (params.rotation) line.rotation = params.rotation;
  if (params.name) line.name = params.name;

  // Give it a visible stroke by default
  line.strokes = [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }];

  if (params.parentId) {
    const parent = await figma.getNodeByIdAsync(params.parentId);
    if (parent && "appendChild" in parent) parent.appendChild(line);
  }

  return {
    id: line.id,
    name: line.name,
    length: params.length !== undefined ? params.length : 100,
  };
}

// Create a boolean operation from multiple nodes
async function createBooleanOperation(params) {
  if (!params || !params.nodeIds || !Array.isArray(params.nodeIds) || !params.operation) {
    throw new Error("Missing required parameters: nodeIds, operation");
  }
  if (params.nodeIds.length < 2) {
    throw new Error("Need at least 2 nodes for a boolean operation");
  }

  const nodes = [];
  for (const id of params.nodeIds) {
    const node = await figma.getNodeByIdAsync(id);
    if (!node) throw new Error(`Node not found: ${id}`);
    nodes.push(node);
  }

  const boolOp = figma.createBooleanOperation();
  boolOp.booleanOperation = params.operation;

  // Clone nodes into the boolean operation
  for (const node of nodes) {
    const clone = node.clone();
    boolOp.appendChild(clone);
  }

  if (params.name) boolOp.name = params.name;

  return {
    id: boolOp.id,
    name: boolOp.name,
    operation: boolOp.booleanOperation,
    childCount: boolOp.children.length,
  };
}

// Set opacity on a node
async function setOpacity(params) {
  if (!params || !params.nodeId || params.opacity === undefined) {
    throw new Error("Missing required parameters: nodeId, opacity");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("opacity" in node)) throw new Error("Node does not support opacity");

  node.opacity = params.opacity;

  return {
    id: node.id,
    name: node.name,
    opacity: node.opacity,
  };
}

// Set effects (shadows, blurs) on a node
async function setEffects(params) {
  if (!params || !params.nodeId || !params.effects) {
    throw new Error("Missing required parameters: nodeId, effects");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("effects" in node)) throw new Error("Node does not support effects");

  node.effects = params.effects.map(e => {
    const effect = {
      type: e.type,
      radius: e.radius,
      visible: e.visible !== undefined ? e.visible : true,
    };
    // Shadows require blendMode — default to NORMAL
    if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") {
      effect.blendMode = e.blendMode || "NORMAL";
    }
    if (e.color) {
      effect.color = { r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a !== undefined ? e.color.a : 1 };
    }
    if (e.offset) {
      effect.offset = { x: e.offset.x, y: e.offset.y };
    }
    if (e.spread !== undefined) {
      effect.spread = e.spread;
    }
    return effect;
  });

  return {
    id: node.id,
    name: node.name,
    effectCount: node.effects.length,
  };
}

// Set layout constraints on a node
async function setConstraints(params) {
  if (!params || !params.nodeId || !params.horizontal || !params.vertical) {
    throw new Error("Missing required parameters: nodeId, horizontal, vertical");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("constraints" in node)) throw new Error("Node does not support constraints");

  node.constraints = {
    horizontal: params.horizontal,
    vertical: params.vertical,
  };

  return {
    id: node.id,
    name: node.name,
    constraints: node.constraints,
  };
}

// Set export settings on a node
async function setExportSettings(params) {
  if (!params || !params.nodeId || !params.settings) {
    throw new Error("Missing required parameters: nodeId, settings");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);
  if (!("exportSettings" in node)) throw new Error("Node does not support export settings");

  node.exportSettings = params.settings.map(s => {
    const setting = { format: s.format };
    if (s.suffix) setting.suffix = s.suffix;
    if (s.contentsOnly !== undefined) setting.contentsOnly = s.contentsOnly;
    if (s.constraint) setting.constraint = s.constraint;
    return setting;
  });

  return {
    id: node.id,
    name: node.name,
    exportSettings: node.exportSettings,
  };
}

// Batch-set multiple properties on a node
async function setNodeProperties(params) {
  if (!params || !params.nodeId || !params.properties) {
    throw new Error("Missing required parameters: nodeId, properties");
  }

  const node = await figma.getNodeByIdAsync(params.nodeId);
  if (!node) throw new Error(`Node not found: ${params.nodeId}`);

  const applied = {};
  const errors = {};

  // Properties that require async setters in dynamic-page mode
  const asyncSetters = {
    fillStyleId: "setFillStyleIdAsync",
    strokeStyleId: "setStrokeStyleIdAsync",
    textStyleId: "setTextStyleIdAsync",
    effectStyleId: "setEffectStyleIdAsync",
  };

  for (const [key, value] of Object.entries(params.properties)) {
    try {
      if (asyncSetters[key] && asyncSetters[key] in node) {
        await node[asyncSetters[key]](value);
        applied[key] = value;
      } else if (key in node) {
        node[key] = value;
        applied[key] = value;
      } else {
        errors[key] = `Property "${key}" does not exist on node type ${node.type}`;
      }
    } catch (e) {
      errors[key] = e.message || String(e);
    }
  }

  return {
    id: node.id,
    name: node.name,
    applied: applied,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

// Get detailed style info by ID
async function getStyleById(styleId) {
  const style = await figma.getStyleByIdAsync(styleId);
  if (!style) throw new Error(`Style not found: ${styleId}`);

  var result = {
    id: style.id,
    name: style.name,
    key: style.key,
    type: style.type,
    description: style.description,
    remote: style.remote,
  };

  if (style.type === "PAINT") {
    result.paints = style.paints.map((p) => {
      var paint = Object.assign({}, p);
      if (paint.color) paint.color = rgbaToHex(paint.color);
      return paint;
    });
  } else if (style.type === "TEXT") {
    result.fontSize = style.fontSize;
    result.fontName = style.fontName;
    result.letterSpacing = style.letterSpacing;
    result.lineHeight = style.lineHeight;
    result.paragraphIndent = style.paragraphIndent;
    result.paragraphSpacing = style.paragraphSpacing;
    result.textCase = style.textCase;
    result.textDecoration = style.textDecoration;
  } else if (style.type === "EFFECT") {
    result.effects = style.effects;
  } else if (style.type === "GRID") {
    result.layoutGrids = style.layoutGrids;
  }

  return result;
}

// Remove/delete a style by ID
async function removeStyle(styleId) {
  const style = await figma.getStyleByIdAsync(styleId);
  if (!style) throw new Error(`Style not found: ${styleId}`);

  var info = {
    id: style.id,
    name: style.name,
    type: style.type,
  };

  style.remove();

  return { removed: true, style: info };
}

// Get detailed component info by ID
async function getComponentById(componentId, includeChildren) {
  const node = await figma.getNodeByIdAsync(componentId);
  if (!node) throw new Error(`Component not found: ${componentId}`);
  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new Error(`Node is not a component: ${node.type}`);
  }

  var result = {
    id: node.id,
    name: node.name,
    type: node.type,
    key: "key" in node ? node.key : null,
    description: "description" in node ? node.description : null,
    width: node.width,
    height: node.height,
  };

  if (node.parent) {
    result.parentId = node.parent.id;
    result.parentName = node.parent.name;
  }

  if ("componentPropertyDefinitions" in node && node.componentPropertyDefinitions) {
    result.propertyDefinitions = node.componentPropertyDefinitions;
  }

  if (node.type === "COMPONENT_SET" && "variantGroupProperties" in node) {
    result.variantGroupProperties = node.variantGroupProperties;
  }

  if (node.type === "COMPONENT" && "variantProperties" in node && node.variantProperties) {
    result.variantProperties = node.variantProperties;
  }

  // For COMPONENT_SETs, omit children by default (propertyDefinitions describes the variant space).
  // For plain COMPONENTs, always include children (they're the component's layers).
  if ("children" in node && node.children) {
    if (node.type === "COMPONENT_SET") {
      result.variantCount = node.children.length;
      if (includeChildren) {
        result.children = node.children.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));
      }
    } else {
      result.children = node.children.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      }));
    }
  }

  return result;
}

// Get detailed variable info by ID
async function getVariableById(variableId) {
  const variable = await figma.variables.getVariableByIdAsync(variableId);
  if (!variable) throw new Error(`Variable not found: ${variableId}`);

  return {
    id: variable.id,
    name: variable.name,
    key: variable.key,
    resolvedType: variable.resolvedType,
    variableCollectionId: variable.variableCollectionId,
    valuesByMode: variable.valuesByMode,
    remote: variable.remote,
    description: variable.description,
    scopes: variable.scopes,
  };
}

// Get detailed variable collection info by ID
async function getVariableCollectionById(collectionId) {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  if (!collection) throw new Error(`Variable collection not found: ${collectionId}`);

  return {
    id: collection.id,
    name: collection.name,
    key: collection.key,
    modes: collection.modes,
    defaultModeId: collection.defaultModeId,
    variableIds: collection.variableIds,
    remote: collection.remote,
  };
}

// Get all pages in the document - safe for lazy-loaded files
async function getPages() {
  return {
    currentPageId: figma.currentPage.id,
    pages: figma.root.children.map((p) => {
      var pageInfo = {
        id: p.id,
        name: p.name,
        isCurrent: p.id === figma.currentPage.id,
      };
      try {
        pageInfo.childCount = p.children ? p.children.length : -1;
      } catch (e) {
        pageInfo.childCount = -1; // Page not loaded
      }
      return pageInfo;
    }),
  };
}

// Set the current page by ID or name
async function setCurrentPage(params) {
  var page;
  if (params.pageId) {
    page = await figma.getNodeByIdAsync(params.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
  } else if (params.pageName) {
    var pageName = params.pageName.toLowerCase();
    page = figma.root.children.find((p) => p.name.toLowerCase() === pageName);
    if (!page) {
      // Try partial match
      page = figma.root.children.find((p) => p.name.toLowerCase().includes(pageName));
    }
    if (!page) throw new Error(`Page not found with name: ${params.pageName}`);
  }

  await figma.setCurrentPageAsync(page);

  return {
    id: page.id,
    name: page.name,
  };
}

// Create a new page
async function createPage(params) {
  const name = (params && params.name) || "New Page";
  const page = figma.createPage();
  page.name = name;

  return {
    id: page.id,
    name: page.name,
  };
}

// Get CSS properties for a node
async function getNodeCss(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  if (!("getCSSAsync" in node)) throw new Error("Node does not support CSS export");

  const css = await node.getCSSAsync();

  return {
    id: node.id,
    name: node.name,
    css: css,
  };
}

// Get available fonts
async function getAvailableFonts(params) {
  const fonts = await figma.listAvailableFontsAsync();

  // Filter by query if provided
  var filtered = fonts;
  if (params && params.query) {
    var q = params.query.toLowerCase();
    filtered = fonts.filter(f => f.fontName.family.toLowerCase().includes(q));
  }

  // Group by family to reduce output
  var families = {};
  for (var i = 0; i < filtered.length; i++) {
    var f = filtered[i];
    if (!families[f.fontName.family]) {
      families[f.fontName.family] = [];
    }
    families[f.fontName.family].push(f.fontName.style);
  }

  var result = Object.keys(families).map(family => ({
    family: family,
    styles: families[family],
  }));

  return {
    familyCount: result.length,
    totalStyleCount: filtered.length,
    fonts: result,
  };
}

// Create a section node
async function createSection(params) {
  const {
    x = 0,
    y = 0,
    width = 500,
    height = 500,
    name = "Section",
    parentId,
  } = params || {};

  const section = figma.createSection();
  section.x = x;
  section.y = y;
  section.resizeWithoutConstraints(width, height);
  section.name = name;

  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (parent && "appendChild" in parent) parent.appendChild(section);
  }

  return {
    id: section.id,
    name: section.name,
    width: section.width,
    height: section.height,
  };
}

// Insert child at specific index or move between parents
async function insertChild(params) {
  const { parentId, childId, index } = params;

  const parent = await figma.getNodeByIdAsync(parentId);
  if (!parent) throw new Error(`Parent not found: ${parentId}`);
  if (!("insertChild" in parent)) throw new Error("Parent does not support children");

  const child = await figma.getNodeByIdAsync(childId);
  if (!child) throw new Error(`Child not found: ${childId}`);

  if (index !== undefined) {
    parent.insertChild(index, child);
  } else {
    parent.appendChild(child);
  }

  return {
    parentId: parent.id,
    childId: child.id,
    index: index,
  };
}

// Wrap existing nodes in an auto-layout frame
async function createAutoLayout(params) {
  if (!params || !params.nodeIds || !Array.isArray(params.nodeIds) || params.nodeIds.length === 0) {
    throw new Error("Missing nodeIds parameter (array of node IDs to wrap)");
  }

  var nodes = [];
  for (var i = 0; i < params.nodeIds.length; i++) {
    var node = await figma.getNodeByIdAsync(params.nodeIds[i]);
    if (!node) throw new Error(`Node not found: ${params.nodeIds[i]}`);
    nodes.push(node);
  }

  // Determine parent — use the first node's parent
  var originalParent = nodes[0].parent || figma.currentPage;

  // Calculate bounding box of all nodes to position the frame
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    if ("absoluteBoundingBox" in n && n.absoluteBoundingBox) {
      var bb = n.absoluteBoundingBox;
      if (bb.x < minX) minX = bb.x;
      if (bb.y < minY) minY = bb.y;
      if (bb.x + bb.width > maxX) maxX = bb.x + bb.width;
      if (bb.y + bb.height > maxY) maxY = bb.y + bb.height;
    } else if ("x" in n && "y" in n && "width" in n && "height" in n) {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x + n.width > maxX) maxX = n.x + n.width;
      if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
  }

  // Create the frame
  var frame = figma.createFrame();
  frame.name = params.name || "Auto Layout";
  frame.fills = [];

  // Position at the bounding box origin
  if (minX !== Infinity) {
    frame.x = minX;
    frame.y = minY;
    frame.resize(maxX - minX, maxY - minY);
  }

  // Insert frame into the same parent
  if ("appendChild" in originalParent) {
    originalParent.appendChild(frame);
  }

  // Move children into the frame
  for (var i = 0; i < nodes.length; i++) {
    frame.appendChild(nodes[i]);
  }

  // Set auto-layout properties
  var layoutMode = params.layoutMode || "VERTICAL";
  frame.layoutMode = layoutMode;
  frame.itemSpacing = params.itemSpacing !== undefined ? params.itemSpacing : 0;
  frame.paddingTop = params.paddingTop || 0;
  frame.paddingRight = params.paddingRight || 0;
  frame.paddingBottom = params.paddingBottom || 0;
  frame.paddingLeft = params.paddingLeft || 0;
  if (params.primaryAxisAlignItems) frame.primaryAxisAlignItems = params.primaryAxisAlignItems;
  if (params.counterAxisAlignItems) frame.counterAxisAlignItems = params.counterAxisAlignItems;
  frame.layoutSizingHorizontal = params.layoutSizingHorizontal || "HUG";
  frame.layoutSizingVertical = params.layoutSizingVertical || "HUG";
  if (params.layoutWrap) frame.layoutWrap = params.layoutWrap;

  return {
    id: frame.id,
    name: frame.name,
    layoutMode: frame.layoutMode,
    childCount: frame.children.length,
    width: frame.width,
    height: frame.height,
  };
}

// Create a node from SVG string
async function createNodeFromSvg(params) {
  const { svg, x = 0, y = 0, name, parentId } = params;

  const node = figma.createNodeFromSvg(svg);
  node.x = x;
  node.y = y;
  if (name) node.name = name;

  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (parent && "appendChild" in parent) parent.appendChild(node);
  }

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width: node.width,
    height: node.height,
  };
}

// Get current page info - always safe, never touches other pages
async function getCurrentPage() {
  await figma.currentPage.loadAsync();
  const page = figma.currentPage;

  return {
    id: page.id,
    name: page.name,
    childCount: page.children.length,
    children: page.children.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    })),
  };
}

// Search for nodes by name and/or type within a scope
async function searchNodes(params) {
  if (!params) throw new Error("Missing parameters");

  var scopeNode;
  if (params.scopeNodeId) {
    scopeNode = await figma.getNodeByIdAsync(params.scopeNodeId);
    if (!scopeNode) throw new Error(`Scope node not found: ${params.scopeNodeId}`);
  } else {
    await figma.currentPage.loadAsync();
    scopeNode = figma.currentPage;
  }

  if (!("findAll" in scopeNode)) {
    throw new Error("Scope node does not support searching children");
  }

  var results;

  // If only filtering by types, use the faster findAllWithCriteria
  if (params.types && !params.query) {
    results = scopeNode.findAllWithCriteria({ types: params.types });
  } else {
    results = scopeNode.findAll((node) => {
      // Type filter
      if (params.types && params.types.length > 0) {
        if (!params.types.includes(node.type)) return false;
      }
      // Name filter
      if (params.query) {
        var query = params.query.toLowerCase();
        if (params.caseSensitive) {
          if (!node.name.includes(params.query)) return false;
        } else {
          if (!node.name.toLowerCase().includes(query)) return false;
        }
      }
      return true;
    });
  }

  var totalCount = results.length;
  var limit = params.limit || 50;
  var offset = params.offset || 0;
  results = results.slice(offset, offset + limit);

  return {
    totalCount: totalCount,
    returned: results.length,
    offset: offset,
    limit: limit,
    results: results.map((node) => {
      var entry = {
        id: node.id,
        name: node.name,
        type: node.type,
      };
      if (node.parent) {
        entry.parentId = node.parent.id;
        entry.parentName = node.parent.name;
      }
      if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
        entry.bounds = node.absoluteBoundingBox;
      } else if ("absoluteTransform" in node) {
        entry.x = node.x;
        entry.y = node.y;
        if ("width" in node) {
          entry.width = node.width;
          entry.height = node.height;
        }
      }
      return entry;
    }),
  };
}
