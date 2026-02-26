import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";

// ─── Shared Zod Schema Fragments ────────────────────────────────
// Import as: import * as S from "./schemas";

/** Single node ID */
export const nodeId = z.string().describe("Node ID");

/** Array of node IDs */
export const nodeIds = flexJson(z.array(z.string())).describe("Array of node IDs");

/** Optional parent reference for creation tools */
export const parentId = z.string().optional()
  .describe("Parent node ID. Omit to place on current page.");

/**
 * Response depth — controls how much node detail is returned after an operation.
 * Omit for minimal response (id + name only).
 * 0 = node with full properties, children as stubs.
 * N = recurse N levels of children with full properties.
 * -1 = unlimited recursion.
 */
export const depth = z.coerce.number().optional()
  .describe("Response detail: omit for id+name only. 0=properties + child stubs. N=recurse N levels. -1=unlimited.");

/** X position for creation tools */
export const xPos = z.coerce.number().optional().describe("X position (default: 0)");

/** Y position for creation tools */
export const yPos = z.coerce.number().optional().describe("Y position (default: 0)");

/** Parse hex color string (#RGB, #RRGGBB, #RRGGBBAA) to {r,g,b,a} 0-1 */
function parseHex(hex: string): { r: number; g: number; b: number; a?: number } | null {
  const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  if (h.length === 8) return { r, g, b, a: parseInt(h.slice(6, 8), 16) / 255 };
  return { r, g, b };
}

/** RGBA color — accepts {r,g,b,a?} object (0-1) or hex string (#RGB, #RRGGBB, #RRGGBBAA) */
export const colorRgba = z.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, z.object({
  r: z.coerce.number().min(0).max(1),
  g: z.coerce.number().min(0).max(1),
  b: z.coerce.number().min(0).max(1),
  a: z.coerce.number().min(0).max(1).optional(),
}));

/** Single effect entry — shared by set_effects and create_effect_style */
export const effectEntry = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
  color: flexJson(colorRgba.optional()),
  offset: flexJson(z.object({ x: z.coerce.number(), y: z.coerce.number() }).optional()),
  radius: z.coerce.number(),
  spread: z.coerce.number().optional(),
  visible: flexBool(z.boolean().optional()),
  blendMode: z.string().optional(),
});
