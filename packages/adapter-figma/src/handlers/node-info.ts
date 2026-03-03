import { serializeNode, DEFAULT_NODE_BUDGET } from "../utils/serialize-node";

// ─── Figma Handlers ──────────────────────────────────────────────

/**
 * Recursively strip keys from a filtered node, keeping only `fields` + identity keys.
 * Stubs (objects with only id/name/type) are left untouched.
 */
function pickFields(node: any, keep: Set<string>): any {
  if (!node || typeof node !== "object") return node;
  const out: any = {};
  for (const key of Object.keys(node)) {
    if (keep.has(key) || key.startsWith("_")) {
      out[key] = key === "children" && Array.isArray(node.children)
        ? node.children.map((c: any) => pickFields(c, keep))
        : node[key];
    }
  }
  return out;
}

async function getNodeInfo(params: any) {
  const nodeIds: string[] = params.nodeIds || (params.nodeId ? [params.nodeId] : []);
  const depth = params.depth;
  const fields = params.fields;

  // Build fields whitelist (always include identity keys)
  const keep = fields?.length
    ? new Set<string>([...fields, "id", "name", "type", "children"])
    : null;

  // Shared budget across all requested nodes -- sequential to keep counter deterministic
  const budget = { remaining: DEFAULT_NODE_BUDGET };
  const results: any[] = [];

  for (const nodeId of nodeIds) {
    const node = await figma.getNodeByIdAsync(nodeId);
    if (!node) { results.push({ nodeId, error: `Node not found: ${nodeId}` }); continue; }

    let serialized = await serializeNode(node, depth !== undefined ? depth : -1, 0, budget);

    if (keep && serialized) serialized = pickFields(serialized, keep);

    results.push(serialized);
  }

  const out: any = { results };

  if (budget.remaining <= 0) {
    out._truncated = true;
    out._notice = "Result was truncated (node budget exceeded). Nodes with _truncated: true are stubs. "
      + "To inspect them, call get_node_info with their IDs directly, or use a shallower depth.";
  }

  return out;
}

async function searchNodes(params: any) {
  if (!params) throw new Error("Missing parameters");

  let scopeNode: any;
  if (params.scopeNodeId) {
    scopeNode = await figma.getNodeByIdAsync(params.scopeNodeId);
    if (!scopeNode) throw new Error(`Scope node not found: ${params.scopeNodeId}`);
  } else {
    await figma.currentPage.loadAsync();
    scopeNode = figma.currentPage;
  }
  if (!("findAll" in scopeNode)) throw new Error("Scope node does not support searching");

  let results: any[];
  if (params.types && !params.query) {
    results = scopeNode.findAllWithCriteria({ types: params.types });
  } else {
    results = scopeNode.findAll((node: any) => {
      if (params.types?.length && !params.types.includes(node.type)) return false;
      if (params.query) {
        const q = params.query.toLowerCase();
        return params.caseSensitive ? node.name.includes(params.query) : node.name.toLowerCase().includes(q);
      }
      return true;
    });
  }

  const totalCount = results.length;
  const limit = params.limit || 50;
  const offset = params.offset || 0;
  results = results.slice(offset, offset + limit);

  return {
    totalCount,
    returned: results.length,
    offset,
    limit,
    results: results.map((node: any) => {
      const entry: any = { id: node.id, name: node.name, type: node.type };
      if (node.parent) { entry.parentId = node.parent.id; entry.parentName = node.parent.name; }
      if ("absoluteBoundingBox" in node && node.absoluteBoundingBox) {
        entry.bounds = node.absoluteBoundingBox;
      } else if ("x" in node) {
        entry.x = node.x; entry.y = node.y;
        if ("width" in node) { entry.width = node.width; entry.height = node.height; }
      }
      return entry;
    }),
  };
}

async function exportNodeAsImage(params: any) {
  const { customBase64Encode } = await import("../utils/base64");
  const { nodeId, scale = 1 } = params || {};
  const format = params.format || "PNG";
  if (!nodeId) throw new Error("Missing nodeId");

  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);
  if (!("exportAsync" in node)) throw new Error(`Node does not support export: ${nodeId}`);

  const bytes = await (node as any).exportAsync({
    format,
    constraint: { type: "SCALE", value: scale },
  });

  const mimeMap: Record<string, string> = {
    PNG: "image/png", JPG: "image/jpeg", SVG: "image/svg+xml", PDF: "application/pdf",
  };

  return {
    mimeType: mimeMap[format] || "application/octet-stream",
    imageData: customBase64Encode(bytes),
  };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_node_info: getNodeInfo,
  // Legacy single-node alias
  get_nodes_info: async (params: any) => getNodeInfo({ nodeIds: params.nodeIds, depth: params.depth }),
  search_nodes: searchNodes,
  export_node_as_image: exportNodeAsImage,
};
