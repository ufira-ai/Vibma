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

/** RGBA color — accepts {r,g,b,a?} object (0-1), hex string (#RGB, #RRGGBB, #RRGGBBAA), or style/variable name string */
export const colorRgba = z.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, z.union([
  z.object({
    r: z.coerce.number().min(0).max(1),
    g: z.coerce.number().min(0).max(1),
    b: z.coerce.number().min(0).max(1),
    a: z.coerce.number().min(0).max(1).optional(),
  }),
  z.string(), // Non-hex strings pass through for handler-level style/variable resolution
])).describe('Hex "#FF0000", {r,g,b,a?} 0-1, or style/variable name.');

// ─── Figma Plugin API Paint[] schemas ───────────────────────────

export const variableAlias = z.object({
  type: z.literal("VARIABLE_ALIAS"),
  id: z.string(),
}).strict().describe('{type:"VARIABLE_ALIAS", id:string}. Discover VariableIDs via variables.get/list or variable_collections.get; prefer *VariableName helpers when available.');

export const transform = z.tuple([
  z.tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()]),
  z.tuple([z.coerce.number(), z.coerce.number(), z.coerce.number()]),
]).describe('Figma Plugin API Transform: [[number,number,number],[number,number,number]]');

export const blendMode = z.enum([
  "PASS_THROUGH", "NORMAL", "DARKEN", "MULTIPLY", "LINEAR_BURN", "COLOR_BURN",
  "LIGHTEN", "SCREEN", "LINEAR_DODGE", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT",
  "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
]);

/** Strict Color for Paint arrays: hex or RGB(A) object only, not style/variable-name strings. */
export const paintColor = z.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, z.object({
  r: z.coerce.number().min(0).max(1),
  g: z.coerce.number().min(0).max(1),
  b: z.coerce.number().min(0).max(1),
  a: z.coerce.number().min(0).max(1).optional(),
}).strict()).describe('Paint color: hex "#FF0000"/"#FF000080" or {r,g,b,a?} 0-1. Non-hex strings are not valid inside Paint[].');

const paintBoundVariables = z.object({
  color: variableAlias.optional(),
}).strict();

const commonPaintFields = {
  visible: flexBool(z.boolean()).optional(),
  opacity: z.coerce.number().min(0).max(1).optional(),
  blendMode: blendMode.optional(),
};

export const colorStop = z.object({
  position: z.coerce.number().min(0).max(1),
  color: paintColor,
  boundVariables: paintBoundVariables.optional(),
}).strict().describe('ColorStop: {position:0..1, color: Color, boundVariables?: {color: VariableAlias}}');

export const solidPaint = z.object({
  type: z.literal("SOLID"),
  color: paintColor,
  boundVariables: paintBoundVariables.optional(),
  ...commonPaintFields,
}).strict();

export const gradientPaint = z.object({
  type: z.enum(["GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND"]),
  gradientTransform: transform,
  gradientStops: z.array(colorStop),
  ...commonPaintFields,
}).strict().describe('GradientPaint: use gradientTransform + gradientStops. Do not use REST gradientHandlePositions.');

const imageFilters = z.object({
  exposure: z.coerce.number().optional(),
  contrast: z.coerce.number().optional(),
  saturation: z.coerce.number().optional(),
  temperature: z.coerce.number().optional(),
  tint: z.coerce.number().optional(),
  highlights: z.coerce.number().optional(),
  shadows: z.coerce.number().optional(),
}).strict();

export const imagePaint = z.object({
  type: z.literal("IMAGE"),
  scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]),
  imageHash: z.string().nullable(),
  imageTransform: transform.optional(),
  scalingFactor: z.coerce.number().optional(),
  rotation: z.coerce.number().optional(),
  filters: imageFilters.optional(),
  ...commonPaintFields,
}).strict();

export const videoPaint = z.object({
  type: z.literal("VIDEO"),
  scaleMode: z.enum(["FILL", "FIT", "CROP", "TILE"]),
  videoHash: z.string().nullable(),
  videoTransform: transform.optional(),
  scalingFactor: z.coerce.number().optional(),
  rotation: z.coerce.number().optional(),
  filters: imageFilters.optional(),
  ...commonPaintFields,
}).strict();

export const patternPaint = z.object({
  type: z.literal("PATTERN"),
  sourceNodeId: z.string(),
  tileType: z.enum(["RECTANGULAR", "HORIZONTAL_HEXAGONAL", "VERTICAL_HEXAGONAL"]),
  scalingFactor: z.coerce.number(),
  spacing: z.object({ x: z.coerce.number(), y: z.coerce.number() }).strict(),
  horizontalAlignment: z.enum(["START", "CENTER", "END"]),
  ...commonPaintFields,
}).strict();

export const paintInput = z.union([solidPaint, gradientPaint], {
  error: 'Invalid Paint[] payload. Supported Paint[] authoring types: SOLID, GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND. Use gradientTransform + gradientStops; do not use CSS gradients, REST gradientHandlePositions, IMAGE, VIDEO, or PATTERN.',
})
  .describe('Paint[] authoring input supports SOLID and Figma gradient paints only. Images use imageUrl/images endpoint; VIDEO and PATTERN authoring are not supported here.');

export const paint = paintInput
  .describe('Paint[] authoring input. Supports SOLID and gradients: GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND. Use gradientTransform + gradientStops; REST gradientHandlePositions is not accepted. IMAGE/VIDEO/PATTERN are readback-only metadata, not authoring input.');

export const paintArray = flexJson(z.array(paintInput))
  .describe('Paint[] input array. Authoring accepts only SOLID and gradients: GRADIENT_LINEAR, GRADIENT_RADIAL, GRADIENT_ANGULAR, GRADIENT_DIAMOND. Use imageUrl/images for images; VIDEO/PATTERN authoring is not supported here.');

export const paintArrayLoose = flexJson(z.array(z.unknown()))
  .describe('Paint[] input array. Authoring accepts only SOLID and gradients. Adapter validates details and returns guidance; CSS gradients, REST gradientHandlePositions, IMAGE, VIDEO, and PATTERN are not supported as authoring input. Use imageUrl/images for images.');

/** Variable value — color (hex or RGBA), number, boolean, string, or alias */
export const variableValue = z.preprocess((v) => {
  if (typeof v === "string") return parseHex(v) ?? v;
  return v;
}, z.union([
  z.number(),
  z.boolean(),
  z.string(),
  z.object({ r: z.number(), g: z.number(), b: z.number(), a: z.number().optional() }),
  z.object({ type: z.literal("VARIABLE_ALIAS"), name: z.string() }),
])).describe('number, boolean, string, hex "#FF0000", {r,g,b,a?}, or {type:"VARIABLE_ALIAS",name:"other/variable"}');

/** Line height — number (px) or {value, unit} */
export const lineHeight = z.union([
  z.coerce.number(),
  z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
]).describe('number (px) or {value, unit: "PIXELS"|"PERCENT"|"AUTO"}');

/** Letter spacing — number (px) or {value, unit} */
export const letterSpacing = z.union([
  z.coerce.number(),
  z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
]).describe('number (px) or {value, unit: "PIXELS"|"PERCENT"}');

/** String or boolean — for component property defaults */
export const stringOrBoolean = z.union([z.string(), z.boolean()]);

/** Design token — accepts a string that is either a numeric value ("8") or a variable name/ID ("Radii/Medium").
 *  Numeric strings are parsed to numbers in the handler; non-numeric strings are variable references. */
export const token = z.preprocess((v) => {
  // Accept raw numbers from agents that pass them correctly
  if (typeof v === "number") return String(v);
  return v;
}, z.string()).describe('number as string ("8") or variable name ("Radii/Medium")');

/** Single effect entry — shared by set_effects and styles create */
export const effectEntry = z.object({
  type: z.enum(["DROP_SHADOW", "INNER_SHADOW", "LAYER_BLUR", "BACKGROUND_BLUR"]),
  color: flexJson(colorRgba).optional(),
  offset: flexJson(z.object({ x: z.coerce.number(), y: z.coerce.number() })).optional(),
  radius: z.coerce.number(),
  spread: z.coerce.number().optional(),
  visible: flexBool(z.boolean()).optional(),
  blendMode: z.string().optional(),
});
