// ─── Figma Handlers ──────────────────────────────────────────────

async function getAvailableFonts(params: any) {
  const fonts = await figma.listAvailableFontsAsync();
  let result = fonts;
  if (params?.query) {
    const q = params.query.toLowerCase();
    result = fonts.filter((f: any) => f.fontName.family.toLowerCase().includes(q));
  }
  // Deduplicate by family name, collect styles
  const familyMap: Record<string, string[]> = {};
  for (const f of result) {
    const fam = f.fontName.family;
    if (!familyMap[fam]) familyMap[fam] = [];
    familyMap[fam].push(f.fontName.style);
  }
  let entries = Object.entries(familyMap);
  const total = entries.length;
  // Pagination
  const offset = Number(params?.offset) || 0;
  const limit = Number(params?.limit) || 100;
  entries = entries.slice(offset, offset + limit);
  const includeStyles = params?.includeStyles === true || params?.includeStyles === "true";
  return {
    count: total,
    fonts: entries.map(([family, styles]) => ({
      family,
      ...(includeStyles ? { styles } : {}),
    })),
  };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_available_fonts: getAvailableFonts,
};
