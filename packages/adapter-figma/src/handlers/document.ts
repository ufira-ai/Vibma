// ─── Figma Handlers ──────────────────────────────────────────────

async function getDocumentInfo() {
  return {
    name: figma.root.name,
    currentPageId: figma.currentPage.id,
    pages: figma.root.children.map((p: any) => (
      { id: p.id, name: p.name }
    )),
  };
}

async function getCurrentPage() {
  await figma.currentPage.loadAsync();
  const page = figma.currentPage;
  return {
    id: page.id,
    name: page.name,
    children: page.children.map((node: any) => ({ id: node.id, name: node.name, type: node.type })),
  };
}

async function setCurrentPage(params: any) {
  let page: any;
  if (params.pageId) {
    page = await figma.getNodeByIdAsync(params.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
  } else if (params.pageName) {
    const name = params.pageName.toLowerCase();
    page = figma.root.children.find((p: any) => p.name.toLowerCase() === name);
    if (!page) page = figma.root.children.find((p: any) => p.name.toLowerCase().includes(name));
    if (!page) {
      const available = figma.root.children.map((p: any) => p.name);
      throw new Error(`Page not found: '${params.pageName}'. Available pages: [${available.join(", ")}]`);
    }
  }
  await figma.setCurrentPageAsync(page);
  return { id: page.id, name: page.name };
}

async function createPage(params: any) {
  const name = params?.name || "New Page";
  const page = figma.createPage();
  page.name = name;
  return { id: page.id };
}

async function renamePage(params: any) {
  if (!params?.newName) throw new Error("Missing newName parameter");
  let page: any;
  if (params.pageId) {
    page = await figma.getNodeByIdAsync(params.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${params.pageId}`);
  } else {
    page = figma.currentPage;
  }
  page.name = params.newName;
  return "ok";
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_document_info: getDocumentInfo,
  get_current_page: getCurrentPage,
  set_current_page: setCurrentPage,
  create_page: createPage,
  rename_page: renamePage,
};
