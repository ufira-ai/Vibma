import { z } from "zod";
import type { ToolDef } from "../types";

export const tools: ToolDef[] = [
  {
    name: "get_document_info",
    description: "Get the document name, current page, and list of all pages.",
    schema: {},
    tier: "read",
  },
  {
    name: "get_current_page",
    description: "Get the current page info and its top-level children.",
    schema: {},
    tier: "read",
  },
  {
    name: "set_current_page",
    description: "Switch to a different page. Provide either pageId or pageName.",
    schema: {
      pageId: z.string().optional().describe("The page ID to switch to"),
      pageName: z.string().optional().describe("The page name (case-insensitive, partial match)"),
    },
    tier: "read",
  },
  {
    name: "create_page",
    description: "Create a new page in the document",
    schema: { name: z.string().optional().describe("Name for the new page (default: 'New Page')") },
    tier: "create",
  },
  {
    name: "rename_page",
    description: "Rename a page. Defaults to current page if no pageId given.",
    schema: {
      newName: z.string().describe("New name for the page"),
      pageId: z.string().optional().describe("Page ID (default: current page)"),
    },
    tier: "edit",
  },
];
