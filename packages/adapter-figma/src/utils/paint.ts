import { rgbaToHex } from "@ufira/vibma/utils/color";

export type PaintHint = { type: "warn" | "error" | "suggest" | "confirm"; message: string };
export type PaintCoerceOptions = { path?: string; help?: string };

export const SUPPORTED_PAINT_TYPES = [
  "SOLID",
  "GRADIENT_LINEAR",
  "GRADIENT_RADIAL",
  "GRADIENT_ANGULAR",
  "GRADIENT_DIAMOND",
] as const;

const SUPPORTED_PAINT_TYPES_TEXT = SUPPORTED_PAINT_TYPES.join(", ");
const DEFAULT_PAINT_HELP = 'frames(method:"help", topic:"create")';

const BLEND_MODES = new Set([
  "PASS_THROUGH", "NORMAL", "DARKEN", "MULTIPLY", "LINEAR_BURN", "COLOR_BURN",
  "LIGHTEN", "SCREEN", "LINEAR_DODGE", "COLOR_DODGE", "OVERLAY", "SOFT_LIGHT",
  "HARD_LIGHT", "DIFFERENCE", "EXCLUSION", "HUE", "SATURATION", "COLOR", "LUMINOSITY",
]);

const GRADIENT_TYPES = new Set([
  "GRADIENT_LINEAR", "GRADIENT_RADIAL", "GRADIENT_ANGULAR", "GRADIENT_DIAMOND",
]);

const COMMON_PAINT_FIELDS = ["type", "visible", "opacity", "blendMode"] as const;
const SOLID_PAINT_FIELDS = new Set([...COMMON_PAINT_FIELDS, "color", "boundVariables"]);
const GRADIENT_PAINT_FIELDS = new Set([...COMMON_PAINT_FIELDS, "gradientTransform", "gradientStops"]);
const COLOR_STOP_FIELDS = new Set(["position", "color", "boundVariables"]);

export function isCssGradientString(value: any): boolean {
  return typeof value === "string" && /\b(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(/i.test(value);
}

export function paintAuthoringGuidance(help = DEFAULT_PAINT_HELP): string {
  return `Supported Paint[] authoring types: ${SUPPORTED_PAINT_TYPES_TEXT}. ` +
    `Gradient format: use gradientTransform + gradientStops; for a basic left-to-right gradient use gradientTransform:[[1,0,0],[0,1,0]]. ` +
    `Do not use CSS gradient strings or REST gradientHandlePositions. ` +
    `Readback may include IMAGE/VIDEO/PATTERN metadata from existing Figma content, but those paint types are not supported as Paint[] authoring input. ` +
    `Use imageUrl or images(method:"search") for images. For examples call ${help}.`;
}

export function paintAuthoringError(message: string, help?: string): string {
  const prefixed = message.startsWith("Invalid Paint[] payload")
    ? message
    : `Invalid Paint[] payload. ${message}`;
  if (prefixed.includes("Supported Paint[] authoring types:")) return prefixed;
  return `${prefixed} ${paintAuthoringGuidance(help)}`;
}

function normalizeOptions(options?: PaintCoerceOptions | string): PaintCoerceOptions {
  if (typeof options === "string") return { help: options };
  return options ?? {};
}

export function serializeVariableAlias(alias: any): { type: "VARIABLE_ALIAS"; id: string } | undefined {
  if (!alias || typeof alias !== "object" || typeof alias.id !== "string") return undefined;
  return { type: "VARIABLE_ALIAS", id: alias.id };
}

export function serializeBoundVariables(boundVariables: any): Record<string, any> | undefined {
  if (!boundVariables || typeof boundVariables !== "object") return undefined;
  const out: Record<string, any> = {};
  for (const [field, value] of Object.entries(boundVariables)) {
    if (Array.isArray(value)) {
      const aliases = value.map(serializeVariableAlias).filter(Boolean);
      if (aliases.length > 0) out[field] = aliases;
    } else {
      const alias = serializeVariableAlias(value);
      if (alias) out[field] = alias;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function serializePaint(paint: Paint | any): Record<string, any> {
  const p: any = { type: paint.type };

  if (paint.visible === false) p.visible = false;
  if (paint.opacity !== undefined && paint.opacity !== 1) p.opacity = paint.opacity;
  if (paint.blendMode && paint.blendMode !== "NORMAL") p.blendMode = paint.blendMode;

  const boundVariables = serializeBoundVariables(paint.boundVariables);
  if (boundVariables) p.boundVariables = boundVariables;

  if (paint.type === "SOLID" && paint.color) {
    // Plugin API SolidPaint stores RGB in color and alpha separately in opacity.
    p.color = rgbaToHex(paint.color);
    return p;
  }

  if (GRADIENT_TYPES.has(paint.type)) {
    if (paint.gradientTransform) p.gradientTransform = paint.gradientTransform;
    if (paint.gradientStops) {
      p.gradientStops = paint.gradientStops.map((stop: any) => {
        const s: any = {
          position: stop.position,
          color: rgbaToHex(stop.color),
        };
        const stopBoundVariables = serializeBoundVariables(stop.boundVariables);
        if (stopBoundVariables) s.boundVariables = stopBoundVariables;
        return s;
      });
    }
    return p;
  }

  if (paint.type === "IMAGE") {
    copyDefined(p, paint, ["scaleMode", "imageHash", "imageTransform", "scalingFactor", "rotation", "filters"]);
    return p;
  }

  if (paint.type === "VIDEO") {
    copyDefined(p, paint, ["scaleMode", "videoHash", "videoTransform", "scalingFactor", "rotation", "filters"]);
    return p;
  }

  if (paint.type === "PATTERN") {
    copyDefined(p, paint, ["sourceNodeId", "tileType", "scalingFactor", "spacing", "horizontalAlignment"]);
    return p;
  }

  // Unknown future paint type: preserve common fields + known enumerable data.
  for (const [key, value] of Object.entries(paint)) {
    if (key === "type" || key in p) continue;
    p[key] = value;
  }
  return p;
}

export function coercePaints(input: any, hints?: PaintHint[], options?: PaintCoerceOptions | string): Paint[] {
  const opts = normalizeOptions(options);
  const path = opts.path ?? "paints";
  if (!Array.isArray(input)) {
    const css = isCssGradientString(input)
      ? " CSS gradient strings like linear-gradient(...) are not Paint[] input; author a Figma gradient paint object instead."
      : "";
    throw new Error(paintAuthoringError(`${path} must be an array of Paint objects.${css}`, opts.help));
  }
  return input.map((paint, index) => coercePaint(paint, hints, `${path}[${index}]`, opts));
}

export function coercePaint(input: any, hints?: PaintHint[], path?: string, options?: PaintCoerceOptions | string): Paint {
  const opts = normalizeOptions(options);
  const actualPath = path ?? opts.path ?? "paint";
  try {
    return coercePaintInner(input, hints, actualPath) as Paint;
  } catch (e: any) {
    throw new Error(paintAuthoringError(e.message, opts.help));
  }
}

function coercePaintInner(input: any, _hints: PaintHint[] | undefined, path: string): Paint {
  if (isCssGradientString(input)) {
    throw new Error(`${path}: CSS gradient strings like ${JSON.stringify(input)} are not supported in Paint[] authoring. Use a Figma gradient paint object with gradientTransform + gradientStops.`);
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${path}: paint must be an object with a type field.`);
  }

  rejectRestGradientHandles(input, path);

  switch (input.type) {
    case "SOLID":
      return coerceSolidPaint(input, path) as Paint;
    case "GRADIENT_LINEAR":
    case "GRADIENT_RADIAL":
    case "GRADIENT_ANGULAR":
    case "GRADIENT_DIAMOND":
      return coerceGradientPaint(input, path) as Paint;
    case "IMAGE":
      throw new Error(`${path}: IMAGE Paint objects are not supported in Paint[] authoring. Use imageUrl on frames.create/update or images(method:"search") to create image fills.`);
    case "VIDEO":
      throw new Error(`${path}: VIDEO paints are not supported by Vibma authoring.`);
    case "PATTERN":
      throw new Error(`${path}: PATTERN paints are not supported for authoring yet. Pattern paint support needs a dedicated Vibma API design.`);
    default:
      if (isCssGradientString(input.type)) {
        throw new Error(`${path}.type is a CSS gradient string, not a Figma paint type.`);
      }
      throw new Error(`${path}: unsupported paint type ${JSON.stringify(input.type)}.`);
  }
}

function coerceSolidPaint(input: any, path: string): SolidPaint {
  rejectUnknownFields(input, SOLID_PAINT_FIELDS, path, "SOLID paint");
  if (input.color === undefined) throw new Error(`${path}.color is required for SOLID paints.`);
  const c = coerceRgbaColor(input.color, `${path}.color`);
  const paint: any = {
    type: "SOLID",
    color: { r: c.r, g: c.g, b: c.b },
    opacity: input.opacity !== undefined ? coerceUnit(input.opacity, `${path}.opacity`) : c.a,
  };
  applyCommonPaintFields(paint, input, path, { skipOpacity: true });
  applyBoundVariables(paint, input, path);
  return paint;
}

function coerceGradientPaint(input: any, path: string): GradientPaint {
  rejectUnknownFields(input, GRADIENT_PAINT_FIELDS, path, "gradient paint");
  if (input.gradientTransform === undefined) throw new Error(`${path}.gradientTransform is required for gradient paints. Use the Figma Plugin API 2×3 Transform matrix, not REST gradientHandlePositions.`);
  if (input.gradientStops === undefined) throw new Error(`${path}.gradientStops is required for gradient paints.`);
  if (!Array.isArray(input.gradientStops)) throw new Error(`${path}.gradientStops must be an array of ColorStop objects.`);

  const paint: any = {
    type: input.type,
    gradientTransform: coerceTransform(input.gradientTransform, `${path}.gradientTransform`),
    gradientStops: input.gradientStops.map((stop: any, index: number) => coerceColorStop(stop, `${path}.gradientStops[${index}]`)),
  };
  applyCommonPaintFields(paint, input, path);
  return paint;
}

function coerceColorStop(input: any, path: string): ColorStop {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`${path}: ColorStop must be an object.`);
  }
  rejectUnknownFields(input, COLOR_STOP_FIELDS, path, "ColorStop");
  const stop: any = {
    position: coerceUnit(input.position, `${path}.position`),
    color: coerceRgbaColor(input.color, `${path}.color`),
  };
  const boundVariables = coerceBoundVariables(input.boundVariables, `${path}.boundVariables`);
  if (boundVariables) stop.boundVariables = boundVariables;
  return stop;
}

function rejectRestGradientHandles(input: any, path: string): void {
  if (!("gradientHandlePositions" in input)) return;
  throw new Error(`${path}.gradientHandlePositions is the REST API gradient format and is not accepted. Use gradientTransform:[[1,0,0],[0,1,0]] plus gradientStops.`);
}

function rejectUnknownFields(input: Record<string, any>, allowed: Set<string>, path: string, label: string): void {
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new Error(`${path}: unsupported field(s) for ${label}: ${unknown.join(", ")}.`);
  }
}

function applyCommonPaintFields(out: any, input: any, path: string, opts: { skipOpacity?: boolean } = {}): void {
  if (input.visible !== undefined) out.visible = coerceBoolean(input.visible, `${path}.visible`);
  if (!opts.skipOpacity && input.opacity !== undefined) out.opacity = coerceUnit(input.opacity, `${path}.opacity`);
  if (input.blendMode !== undefined) out.blendMode = coerceEnum(input.blendMode, BLEND_MODES, `${path}.blendMode`);
}

function applyBoundVariables(out: any, input: any, path: string): void {
  const boundVariables = coerceBoundVariables(input.boundVariables, `${path}.boundVariables`);
  if (boundVariables) out.boundVariables = boundVariables;
}

function coerceBoundVariables(input: any, path: string): Record<string, any> | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${path} must be an object of field → VariableAlias.`);
  const out: Record<string, any> = {};
  for (const [field, alias] of Object.entries(input)) {
    if (field !== "color") throw new Error(`${path}.${field} is not supported. Paint[] authoring only supports boundVariables.color.`);
    out[field] = coerceVariableAlias(alias, `${path}.${field}`);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function coerceVariableAlias(input: any, path: string): VariableAlias {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${path} must be a VariableAlias object.`);
  if (input.type !== "VARIABLE_ALIAS") throw new Error(`${path}.type must be "VARIABLE_ALIAS".`);
  return { type: "VARIABLE_ALIAS", id: coerceString(input.id, `${path}.id`) };
}

function coerceTransform(input: any, path: string): Transform {
  if (!Array.isArray(input) || input.length !== 2) throw new Error(`${path} must be a 2×3 Transform matrix: [[a,b,c],[d,e,f]].`);
  return [
    coerceTransformRow(input[0], `${path}[0]`),
    coerceTransformRow(input[1], `${path}[1]`),
  ] as Transform;
}

function coerceTransformRow(input: any, path: string): [number, number, number] {
  if (!Array.isArray(input) || input.length !== 3) throw new Error(`${path} must contain exactly 3 numbers.`);
  return [
    coerceNumber(input[0], `${path}[0]`),
    coerceNumber(input[1], `${path}[1]`),
    coerceNumber(input[2], `${path}[2]`),
  ];
}

function coerceRgbaColor(input: any, path: string): { r: number; g: number; b: number; a: number } {
  if (typeof input === "string") {
    const parsed = parseHex(input);
    if (!parsed) throw new Error(`${path} must be a hex color (#RGB, #RGBA, #RRGGBB, or #RRGGBBAA) or {r,g,b,a?}.`);
    return parsed;
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${path} must be a hex color or {r,g,b,a?}.`);
  return {
    r: coerceUnit(input.r, `${path}.r`),
    g: coerceUnit(input.g, `${path}.g`),
    b: coerceUnit(input.b, `${path}.b`),
    a: input.a !== undefined ? coerceUnit(input.a, `${path}.a`) : 1,
  };
}

function parseHex(hex: string): { r: number; g: number; b: number; a: number } | null {
  const m = hex.match(/^#?([0-9a-f]{3,8})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length === 4) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];
  if (h.length !== 6 && h.length !== 8) return null;
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
    a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  };
}

function coerceEnum<T extends string>(value: any, allowed: Set<T> | Set<string>, path: string): T {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${path} must be one of: ${[...allowed].join(", ")}.`);
  }
  return value as T;
}

function coerceUnit(value: any, path: string): number {
  const n = coerceNumber(value, path);
  if (n < 0 || n > 1) throw new Error(`${path} must be between 0 and 1.`);
  return n;
}

function coerceNumber(value: any, path: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${path} must be a finite number.`);
  return n;
}

function coerceBoolean(value: any, path: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${path} must be a boolean.`);
}

function coerceString(value: any, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function copyDefined(out: Record<string, any>, source: Record<string, any>, keys: string[]): void {
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
}
