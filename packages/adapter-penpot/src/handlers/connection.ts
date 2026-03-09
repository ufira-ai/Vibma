// ─── Penpot Connection Handler ───────────────────────────────────
// Penpot does not expose a version string in the plugin sandbox API,
// so we return a static alive-check response.

async function ping(): Promise<{ status: string; tool: string; currentPage: string | null }> {
  const page = penpot.currentPage;
  return {
    status: "connected",
    tool: "penpot",
    currentPage: page?.name ?? null,
  };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  ping,
};
