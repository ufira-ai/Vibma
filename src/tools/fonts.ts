import { z } from "zod";
import type { ToolDef } from "./types";
import type { GetAvailableFontsResult } from "./response-types";

// ─── Tool Definitions ───────────────────────────────────────────

export const tools: ToolDef[] = [
  {
    name: "get_available_fonts",
    description: "Get available fonts in Figma. Optionally filter by query string.",
    schema: { query: z.string().optional().describe("Filter fonts by name (case-insensitive). Omit to list all fonts.") },
    tier: "read",
  },
];

// ─── Figma Handlers ──────────────────────────────────────────────

async function getAvailableFonts(params: any): Promise<GetAvailableFontsResult> {
  const fonts = await figma.listAvailableFontsAsync();
  let result = fonts;
  if (params?.query) {
    const q = params.query.toLowerCase();
    result = fonts.filter((f: any) => f.fontName.family.toLowerCase().includes(q));
  }
  // Deduplicate by family name, list styles
  const familyMap: Record<string, string[]> = {};
  for (const f of result) {
    const fam = f.fontName.family;
    if (!familyMap[fam]) familyMap[fam] = [];
    familyMap[fam].push(f.fontName.style);
  }
  return {
    count: Object.keys(familyMap).length,
    fonts: Object.entries(familyMap).map(([family, styles]) => ({ family, styles })),
  };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_available_fonts: getAvailableFonts,
};
