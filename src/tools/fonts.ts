import { z } from "zod";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "get_available_fonts",
    "Get available fonts in Figma. Optionally filter by query string.",
    { query: z.string().optional().describe("Filter fonts by name (case-insensitive). Omit to list all fonts.") },
    async ({ query }: any) => {
      try { return mcpJson(await sendCommand("get_available_fonts", { query })); }
      catch (e) { return mcpError("Error getting fonts", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function getAvailableFonts(params: any) {
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
