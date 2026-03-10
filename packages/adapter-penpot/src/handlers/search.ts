// ─── Penpot search_nodes Handler ─────────────────────────────────
//
// Penpot API notes:
// - `penpot.currentPage.findShapes()` returns all shapes on the current page.
// - Filter by name (case-insensitive substring) and optionally by type.

async function searchNodes(params: any): Promise<any> {
  const { query, type } = params;
  if (!query && !type) {
    throw new Error("search_nodes requires at least a query or type parameter");
  }

  const page = penpot.currentPage;
  if (!page) throw new Error("No current page");

  const lowerQuery = query ? (query as string).toLowerCase() : null;

  const allShapes = page.findShapes();
  const results = allShapes.filter((s: any) => {
    if (lowerQuery && !(s.name || "").toLowerCase().includes(lowerQuery)) {
      return false;
    }
    if (type && s.type !== type) {
      return false;
    }
    return true;
  });

  return results.map((s: any) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
  }));
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  search_nodes: searchNodes,
};
