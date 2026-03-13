// ─── Figma Handlers ──────────────────────────────────────────────

async function saveVersionHistory(params: any) {
  if (!params?.title) throw new Error("Missing required parameter: title");

  const title = params.title;
  const description = params.description || "";

  const result = await figma.saveVersionHistoryAsync(title, description);

  return {
    id: typeof result === "string" ? result : String(result),
  };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  save_version_history: saveVersionHistory,
};
