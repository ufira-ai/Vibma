import { z } from "zod";
import { flexJson, flexNum } from "../../utils/coercion";
import * as S from "../schemas";
import type { ToolDef } from "../types";
import { endpointSchema } from "../endpoint";

const paintStyleItem = z.object({
  name: z.string().describe("Style name"),
  color: flexJson(S.colorRgba).describe('Color.'),
});

const textStyleItem = z.object({
  name: z.string().describe("Style name"),
  fontFamily: z.string().describe("Font family"),
  fontStyle: z.string().optional().describe("Font style (default: Regular)"),
  fontSize: z.coerce.number().describe("Font size"),
  lineHeight: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
  ])).optional().describe("Line height — number (px) or {value, unit}. Default: auto."),
  letterSpacing: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
  ])).optional().describe("Letter spacing — number (px) or {value, unit}. Default: 0."),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
});

const effectStyleItem = z.object({
  name: z.string().describe("Style name"),
  effects: flexJson(z.array(S.effectEntry)).describe("Array of effects"),
});

const patchBase = {
  id: z.string().describe("Style ID or name (case-insensitive match)"),
  name: z.string().optional().describe("Rename the style"),
};

const patchPaintItem = z.object({
  ...patchBase,
  color: flexJson(S.colorRgba).optional().describe('New color.'),
});

const patchTextItem = z.object({
  ...patchBase,
  fontFamily: z.string().optional().describe("Font family"),
  fontStyle: z.string().optional().describe("Font style, e.g. Regular, Bold"),
  fontSize: z.coerce.number().optional().describe("Font size"),
  lineHeight: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
  ])).optional().describe("Line height — number (px) or {value, unit}"),
  letterSpacing: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
  ])).optional().describe("Letter spacing — number (px) or {value, unit}"),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
});

const patchEffectItem = z.object({
  ...patchBase,
  effects: flexJson(z.array(S.effectEntry)).optional().describe("Array of effects"),
});

const patchAnyItem = z.object({
  ...patchBase,
  color: flexJson(S.colorRgba).optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.string().optional(),
  fontSize: z.coerce.number().optional(),
  lineHeight: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT", "AUTO"]) }),
  ])).optional(),
  letterSpacing: flexNum(z.union([
    z.number(),
    z.object({ value: z.coerce.number(), unit: z.enum(["PIXELS", "PERCENT"]) }),
  ])).optional(),
  textCase: z.enum(["ORIGINAL", "UPPER", "LOWER", "TITLE"]).optional(),
  textDecoration: z.enum(["NONE", "UNDERLINE", "STRIKETHROUGH"]).optional(),
  effects: flexJson(z.array(S.effectEntry)).optional(),
});

const createSchemas: Record<string, z.ZodTypeAny> = {
  paint: paintStyleItem, text: textStyleItem, effect: effectStyleItem,
};
const updateSchemas: Record<string, z.ZodTypeAny> = {
  paint: patchPaintItem, text: patchTextItem, effect: patchEffectItem,
};

export const tools: ToolDef[] = [
  {
    name: "styles",
    description:
      "CRUD endpoint for local styles (paint, text, effect).\n" +
      "  list   → {type?, fields?, offset?, limit?} → {totalCount, items: [{id, name, type, ...}]}\n" +
      "  get    → {id, fields?} → style object (full detail; fields to filter)\n" +
      "  create → {type, items: [...]} → {results: [{id}, ...]}\n" +
      "  update → {type?, items: [{id, ...}]} → {results: ['ok'|{warning}, ...]}\n" +
      "  delete → {id} or {items: [{id}, ...]} → 'ok' or {results: ['ok', ...]}",
    schema: (caps) => endpointSchema(
      ["create", "get", "list", "update", "delete"],
      caps,
      {
        type: z.enum(["paint", "text", "effect"]).optional()
          .describe("Style type. Required for create. Filters list by type. Optional for update (strict per-type validation; omit to auto-detect)."),
        items: flexJson(z.array(z.any())).optional()
          .describe("Create: [{name, color}] (paint), [{name, fontFamily, fontSize, ...}] (text), [{name, effects}] (effect). Update: [{id, ...fields}]. Delete (batch): [{id}, ...]."),
        depth: S.depth,
      },
    ),
    tier: "read",
    validate: (params: any) => {
      if (params.items) {
        const map = params.method === "update" ? updateSchemas : createSchemas;
        const itemSchema = (params.type && map[params.type]) || patchAnyItem;
        params.items = z.array(itemSchema).parse(params.items);
      }
    },
  },
];
