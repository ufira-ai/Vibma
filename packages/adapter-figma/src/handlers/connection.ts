// ─── Figma Handlers ──────────────────────────────────────────────

async function ping() {
  return {
    status: "pong",
    documentName: figma.root.name,
    currentPage: figma.currentPage.name,
    timestamp: Date.now(),
  };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  ping,
};
