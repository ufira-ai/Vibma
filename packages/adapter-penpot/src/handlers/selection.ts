// ─── Penpot get_selection / set_selection Handlers ───────────────
//
// Penpot API notes:
// - `penpot.selection` returns the currently selected shapes array.
// - Setting `penpot.selection = shapes` updates the selection.
// - `penpot.currentPage.findShapes()` returns all shapes on the page.

async function getSelection(): Promise<any> {
  const selected = penpot.selection;
  return (selected || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    type: s.type,
  }));
}

async function setSelection(params: any): Promise<any> {
  const { ids } = params;
  if (!Array.isArray(ids)) {
    throw new Error("set_selection requires an ids array");
  }

  const page = penpot.currentPage;
  if (!page) throw new Error("No current page");

  const idSet = new Set(ids as string[]);
  const shapes = page.findShapes().filter((s: any) => idSet.has(s.id));

  penpot.selection = shapes;

  return { selectedCount: shapes.length };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  get_selection: getSelection,
  set_selection: setSelection,
};
