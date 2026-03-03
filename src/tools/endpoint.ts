/**
 * Shared endpoint infrastructure.
 *
 * Every resource endpoint follows the same contract:
 *   create  → items[{...}]                        → { results: [{id}, ...] }
 *   get     → { id, fields? }                     → resource object (field-filtered)
 *   list    → { filters?, fields?, offset, limit } → { totalCount, returned, offset, limit, items: [...] }
 *   update  → items[{...}]                        → { results: ["ok", ...] }
 *   delete  → { id } or items[{id}]               → "ok" or { results: ["ok", ...] }
 *
 * MCP side:  endpointSchema()
 * Figma side: createDispatcher() + paginate()
 */

import { z } from "zod";
import { flexJson } from "../utils/coercion";
import type { Capabilities } from "./types";

// ─── Method Types ────────────────────────────────────────────────

export type EndpointMethod = "create" | "get" | "list" | "update" | "delete";

// ─── Response Types ──────────────────────────────────────────────

/** Batch response envelope (create, update, delete). Produced by batchHandler. */
export interface BatchResponse<T = { id: string }> {
  results: Array<T | "ok" | { error: string }>;
  warnings?: string[];
  deferred?: string;
}

/** Paginated list response envelope. */
export interface ListResponse<T = Record<string, any>> {
  totalCount: number;
  returned: number;
  offset: number;
  limit: number;
  items: T[];
}

// ─── Discriminated Param Types ───────────────────────────────────
//
// Each endpoint specializes these with its own create/update item
// types and list filters. Example:
//
//   type StyleParams = EndpointParams<StyleCreateItem, StyleUpdateItem, { type?: string }>;
//

export type EndpointParams<
  TCreate = Record<string, any>,
  TUpdate = Record<string, any>,
  TListFilters = Record<string, never>,
> =
  | { method: "create"; items: TCreate[] }
  | { method: "get"; id: string; fields?: string[] }
  | ({ method: "list"; fields?: string[]; offset?: number; limit?: number } & TListFilters)
  | { method: "update"; items: TUpdate[] }
  | { method: "delete"; id?: string; items?: Array<{ id: string }> };

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Top-level field filter for get/list responses.
 * Always preserves identity fields (id, name, type).
 * Pass ["*"] to return all fields.
 */
export function pickFields(obj: Record<string, any>, fields: string[]): Record<string, any> {
  if (fields.includes("*")) return obj;
  const keep = new Set([...fields, "id", "name", "type"]);
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (keep.has(key)) out[key] = obj[key];
  }
  return out;
}

/**
 * Paginate an array of items. Default limit: 100.
 * Call from list handlers after assembling the full result set.
 */
export function paginate<T>(items: T[], offset = 0, limit = 100): ListResponse<T> {
  const sliced = items.slice(offset, offset + limit);
  return { totalCount: items.length, returned: sliced.length, offset, limit, items: sliced };
}

// ─── Schema Builder ──────────────────────────────────────────────

/** Maps each endpoint method to the minimum tier required to use it. */
export type MethodTier = "read" | "create" | "edit";

const DEFAULT_TIERS: Record<string, MethodTier> = {
  get: "read", list: "read", create: "create", update: "edit", delete: "edit",
};

/**
 * Build standard endpoint Zod schema fields.
 *
 * Always includes `method`. Auto-adds:
 * - `id` when get/delete are in the method list
 * - `fields` when get or list are in the method list
 * - `offset`/`limit` when list is in the method list
 * Merge endpoint-specific fields (items, list filters) via `extra`.
 *
 * When `caps` is provided, methods are filtered by tier — only methods
 * whose tier is enabled appear in the enum.
 */
export function endpointSchema(
  methods: string[],
  capsOrExtra?: Capabilities | Record<string, z.ZodTypeAny>,
  extraOrTiers?: Record<string, z.ZodTypeAny>,
  methodTiers?: Record<string, MethodTier>,
): Record<string, z.ZodTypeAny> {
  // Overload resolution: (methods, extra?) or (methods, caps, extra?, tiers?)
  let caps: Capabilities | undefined;
  let extra: Record<string, z.ZodTypeAny> | undefined;

  if (capsOrExtra && ("create" in capsOrExtra) && ("edit" in capsOrExtra)
      && typeof (capsOrExtra as any).create === "boolean") {
    caps = capsOrExtra as Capabilities;
    extra = extraOrTiers;
  } else {
    extra = capsOrExtra as Record<string, z.ZodTypeAny> | undefined;
    // methodTiers and extraOrTiers are unused in the legacy call signature
  }

  // Filter methods by capabilities
  let filtered = methods;
  if (caps) {
    const tiers = { ...DEFAULT_TIERS, ...methodTiers };
    filtered = methods.filter(m => {
      const tier = tiers[m] ?? "edit"; // unknown methods default to edit
      if (tier === "read") return true;
      if (tier === "create") return caps!.create;
      if (tier === "edit") return caps!.edit;
      return false;
    });
  }

  const schema: Record<string, z.ZodTypeAny> = {
    method: z.enum(filtered as [string, ...string[]]),
  };
  if (filtered.includes("get") || filtered.includes("delete")) {
    schema.id = z.string().optional().describe("Resource ID (get, delete)");
  }
  if (filtered.includes("get") || filtered.includes("list")) {
    schema.fields = flexJson(z.array(z.string())).optional()
      .describe('Property whitelist (get/list). Identity fields (id, name, type) always included. Omit for stubs on list, full detail on get. Pass ["*"] for all fields.');
  }
  if (filtered.includes("list")) {
    schema.offset = z.coerce.number().optional().describe("Skip N items for pagination (default 0)");
    schema.limit = z.coerce.number().optional().describe("Max items per page (default 100)");
  }
  return { ...schema, ...extra };
}

// ─── Figma Dispatcher ────────────────────────────────────────────

type MethodHandlers = Record<string, (params: any) => Promise<any>>;

/**
 * Create a Figma handler that dispatches on `params.method`.
 * Only methods with registered handlers are allowed.
 * Automatically applies `fields` filtering on get responses.
 */
export function createDispatcher(handlers: MethodHandlers) {
  const supported = Object.keys(handlers).join(", ");
  return async (params: any): Promise<any> => {
    const method = params.method as EndpointMethod;
    const handler = handlers[method];
    if (!handler) throw new Error(`Method '${method}' not supported. Available: ${supported}`);
    let result = await handler(params);
    // Auto-apply fields filtering on get responses (full detail by default)
    if (method === "get" && params.fields?.length && result && typeof result === "object") {
      result = pickFields(result, params.fields);
    }
    return result;
  };
}
