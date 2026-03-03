import { z } from "zod";
import { flexJson, flexBool } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";

const lintRules = z.enum([
  "no-autolayout",
  "shape-instead-of-frame",
  "hardcoded-color",
  "no-text-style",
  "fixed-in-autolayout",
  "default-name",
  "empty-container",
  "stale-text-name",
  "no-text-property",
  "wcag-contrast",
  "wcag-contrast-enhanced",
  "wcag-non-text-contrast",
  "wcag-target-size",
  "wcag-text-size",
  "wcag-line-height",
  "wcag",
  "all",
]);

export const tools: ToolDef[] = [
  {
    name: "lint_node",
    description: "Run design linter on a node tree. Returns issues grouped by category with affected node IDs and fix instructions. Lint child nodes individually for large trees.",
    schema: {
      nodeId: z.string().optional().describe("Node ID to lint. Omit to lint current selection."),
      rules: flexJson(z.array(lintRules)).optional().describe('Rules to run. Default: ["all"]. Options: no-autolayout, shape-instead-of-frame, hardcoded-color, no-text-style, fixed-in-autolayout, default-name, empty-container, stale-text-name, no-text-property, all, wcag-contrast, wcag-contrast-enhanced, wcag-non-text-contrast, wcag-target-size, wcag-text-size, wcag-line-height, wcag'),
      maxDepth: z.coerce.number().optional().describe("Max depth to recurse (default: 10)"),
      maxFindings: z.coerce.number().optional().describe("Stop after N findings (default: 50)"),
    },
    tier: "read",
  },
  {
    name: "lint_fix_autolayout",
    description: "Auto-fix: convert frames with multiple children to auto-layout. Takes node IDs from lint_node 'no-autolayout' results.",
    schema: {
      items: flexJson(z.array(z.object({
        nodeId: S.nodeId,
        layoutMode: z.enum(["HORIZONTAL", "VERTICAL"]).optional().describe("Layout direction (default: auto-detect based on child positions)"),
        itemSpacing: z.coerce.number().optional().describe("Spacing between children (default: 0)"),
      }))).describe("Array of frames to convert to auto-layout"),
      depth: S.depth,
    },
    tier: "edit",
  },
];
