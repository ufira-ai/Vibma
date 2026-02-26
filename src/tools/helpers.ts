import { filterFigmaNode } from "../utils/filter-node";

// ─── Figma Handler Utilities ────────────────────────────────────
// Shared helpers for plugin-side (Figma) handler functions.

/**
 * Snapshot a node using JSON_REST_V1 export + filterFigmaNode.
 * Returns null if node not found or does not support export.
 */
export async function nodeSnapshot(id: string, depth: number): Promise<any> {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) return null;
  if (!("exportAsync" in node)) return { id: node.id, name: node.name, type: node.type };

  const response = await (node as any).exportAsync({ format: "JSON_REST_V1" });
  const filtered = filterFigmaNode(response.document, depth);

  if (filtered && node.parent) {
    filtered.parentId = node.parent.id;
    filtered.parentName = node.parent.name;
    filtered.parentType = node.parent.type;
  }
  return filtered;
}

/**
 * Process batch items with optional depth enrichment.
 * Reads `items` (array) and `depth` (number|undefined) from params.
 * If depth is defined and a result has an `id`, merges node snapshot into the result.
 */
export async function batchHandler(
  params: any,
  fn: (item: any) => Promise<any>,
): Promise<{ results: any[] }> {
  const items = params.items || [params];
  const depth = params.depth;
  const results = [];
  for (const item of items) {
    try {
      let result = await fn(item);
      if (depth !== undefined && result?.id) {
        const snapshot = await nodeSnapshot(result.id, depth);
        if (snapshot) result = { ...result, ...snapshot };
      }
      // Replace empty objects with "ok" for readability
      if (result && typeof result === "object" && Object.keys(result).length === 0) {
        results.push("ok");
      } else {
        results.push(result);
      }
    } catch (e: any) {
      results.push({ error: e.message });
    }
  }
  return { results };
}

/**
 * Append a node to a parent (by ID) or the current page.
 * Returns the parent node if parentId was given, null otherwise.
 */
export async function appendToParent(node: SceneNode, parentId?: string): Promise<BaseNode | null> {
  if (parentId) {
    const parent = await figma.getNodeByIdAsync(parentId);
    if (!parent) throw new Error(`Parent not found: ${parentId}`);
    if (!("appendChild" in parent))
      throw new Error(`Parent does not support children: ${parentId}. Only FRAME, COMPONENT, GROUP, SECTION, and PAGE nodes can have children.`);
    (parent as any).appendChild(node);
    return parent;
  }
  figma.currentPage.appendChild(node);
  return null;
}

/**
 * Build a solid paint from an RGBA color object (channels 0-1).
 */
export function solidPaint(c: any) {
  return { type: "SOLID" as const, color: { r: c.r ?? 0, g: c.g ?? 0, b: c.b ?? 0 }, opacity: c.a ?? 1 };
}
