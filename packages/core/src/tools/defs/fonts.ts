import { z } from "zod";
import type { ToolDef } from "../types";

export const tools: ToolDef[] = [
  {
    name: "get_available_fonts",
    description: "Get available fonts in Figma. Optionally filter by query string.",
    schema: { query: z.string().optional().describe("Filter fonts by name (case-insensitive). Omit to list all fonts.") },
    tier: "read",
  },
];
