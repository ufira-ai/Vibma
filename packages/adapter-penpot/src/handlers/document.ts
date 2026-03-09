// ─── Penpot Document Handlers ────────────────────────────────────
//
// API notes vs adapter-figma:
// - File name: penpot.currentFile.name  (currentFile is a File | null)
// - Pages list: penpot.currentFile.pages  (Page[], each has .id and .name)
// - Current page: penpot.currentPage  (Page | null)
// - Root children: penpot.currentPage.root is a Shape; top-level shapes are
//   accessed via penpot.currentPage.findShapes() or the root shape's children.
//   The root Shape does not expose a typed .children array in ShapeBase, so we
//   use findShapes() without criteria to count top-level board/shape children.

async function getDocumentInfo(): Promise<any> {
  const file = penpot.currentFile;
  const page = penpot.currentPage;
  return {
    // File-level metadata
    name: file?.name ?? null,
    fileId: file?.id ?? null,
    // Current page
    currentPageId: page?.id ?? null,
    currentPageName: page?.name ?? null,
    // Pages list — available via currentFile.pages
    pageCount: file?.pages?.length ?? null,
    pages: file?.pages?.map((p) => ({ id: p.id, name: p.name })) ?? null,
  };
}

async function getCurrentPage(): Promise<any> {
  const page = penpot.currentPage;
  if (!page) throw new Error("No current page");
  // findShapes without criteria returns all shapes on the page (flat).
  // Filter to top-level shapes only by checking that their parent is the root.
  const root = page.root;
  const allShapes = page.findShapes();
  const topLevel = allShapes.filter((s) => s.parent?.id === root.id);
  return {
    id: page.id,
    name: page.name,
    children: topLevel.map((s) => ({ id: s.id, name: s.name, type: s.type })),
  };
}

async function setCurrentPage(params: any): Promise<any> {
  const file = penpot.currentFile;
  if (!file) throw new Error("No current file");
  let target: any;
  if (params.pageId) {
    target = file.pages.find((p) => p.id === params.pageId);
    if (!target) throw new Error(`Page not found: ${params.pageId}`);
  } else if (params.pageName) {
    const name = params.pageName.toLowerCase();
    target = file.pages.find((p) => p.name.toLowerCase() === name);
    if (!target) target = file.pages.find((p) => p.name.toLowerCase().includes(name));
    if (!target) {
      const available = file.pages.map((p) => p.name);
      throw new Error(
        `Page not found: '${params.pageName}'. Available pages: [${available.join(", ")}]`,
      );
    }
  } else {
    throw new Error("Provide either pageId or pageName");
  }
  // Penpot's openPage navigates to the page in the editor.
  penpot.openPage(target);
  return { id: target.id, name: target.name };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  get_document_info: getDocumentInfo,
  get_current_page: getCurrentPage,
  set_current_page: setCurrentPage,
};
