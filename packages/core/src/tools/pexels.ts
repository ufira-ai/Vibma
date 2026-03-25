/**
 * Pexels API client — search stock photos via pexels.com.
 * Uses the official `pexels` npm package.
 * API key sourced from PEXELS_API_KEY environment variable.
 */

import { createClient, type PhotosWithTotalResults, type Photo, type ErrorResponse } from "pexels";

// ─── Client ─────────────────────────────────────────────────────

let _client: ReturnType<typeof createClient> | null = null;

function getClient(): ReturnType<typeof createClient> {
  if (_client) return _client;
  const key = process.env.PEXELS_API_KEY;
  if (!key) {
    throw new Error(
      "PEXELS_API_KEY environment variable is not set. " +
      "Get a free API key at https://www.pexels.com/api/new/ and set it in your environment.",
    );
  }
  _client = createClient(key);
  return _client;
}

// ─── In-memory photo cache (for attribution + URL resolution) ───

const photoCache = new Map<number, Photo>();

// ─── Types ──────────────────────────────────────────────────────

export interface PexelsSearchParams {
  query: string;
  orientation?: "landscape" | "portrait" | "square";
  size?: "large" | "medium" | "small";
  color?: string;
  locale?: string;
  page?: number;
  per_page?: number;
}

/** Slim photo object returned to agents — minimal context, pick by alt. */
export interface SlimPhoto {
  id: number;
  alt: string | null;
  avg_color: string | null;
  width: number;
  height: number;
}

function isError(res: unknown): res is ErrorResponse {
  return !!res && typeof res === "object" && "error" in res;
}

function cacheAndSlim(p: Photo): SlimPhoto {
  photoCache.set(p.id, p);
  return {
    id: p.id,
    alt: p.alt,
    avg_color: p.avg_color,
    width: p.width,
    height: p.height,
  };
}

// ─── Search ─────────────────────────────────────────────────────

export async function searchPhotos(
  params: PexelsSearchParams,
): Promise<{ photos: SlimPhoto[]; total_results: number; page: number; per_page: number } | { error: string }> {
  try {
    const client = getClient();
    const res = await client.photos.search(params as any);
    if (isError(res)) return { error: res.error };
    const data = res as PhotosWithTotalResults;
    return {
      photos: data.photos.map(cacheAndSlim),
      total_results: data.total_results,
      page: data.page,
      per_page: data.per_page,
    };
  } catch (e) {
    return { error: `Pexels search failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Resolve pexel:ID ───────────────────────────────────────────

const PEXEL_RE = /^pexel:(\d+)$/;

/** Check if a string is a pexel:ID reference. */
export function isPexelRef(s: string): boolean {
  return PEXEL_RE.test(s);
}

/**
 * Resolve a pexel:ID to an image URL + attribution.
 * Checks session cache first, falls back to Pexels API show().
 */
export async function resolvePexelRef(
  ref: string,
): Promise<{ url: string; attribution: string } | { error: string }> {
  const m = ref.match(PEXEL_RE);
  if (!m) return { error: `Invalid pexel reference "${ref}". Use "pexel:<id>" format.` };

  const id = Number(m[1]);
  let photo = photoCache.get(id);

  if (!photo) {
    try {
      const client = getClient();
      const res = await client.photos.show({ id });
      if (isError(res)) return { error: `Pexels photo ${id} not found: ${res.error}` };
      photo = res as Photo;
      photoCache.set(id, photo);
    } catch (e) {
      return { error: `Failed to fetch Pexels photo ${id}: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return {
    url: photo.src.large,
    attribution: `Photo by ${photo.photographer} on Pexels (${photo.url})`,
  };
}

// ─── Fetch image as base64 ──────────────────────────────────────

import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { homedir } from "node:os";

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
};

function isRemoteUrl(s: string): boolean {
  try { return new URL(s).protocol.startsWith("http"); } catch { return false; }
}

/** Detect if input points to an SVG (by extension or content-type). */
export function looksLikeSvg(input: string): boolean {
  if (input.startsWith("pexel:")) return false;
  const ext = extname(isRemoteUrl(input) ? new URL(input).pathname : input).toLowerCase();
  return ext === ".svg";
}

/** Fetch SVG content as text (local file or remote URL). */
export async function fetchSvgContent(
  input: string,
): Promise<{ svg: string } | { error: string }> {
  if (isRemoteUrl(input)) {
    try {
      const res = await fetch(input);
      if (!res.ok) return { error: `SVG fetch returned ${res.status} for "${input}".` };
      const svg = await res.text();
      if (!svg.includes("<svg")) return { error: `URL "${input}" does not contain SVG markup.` };
      return { svg };
    } catch (e) {
      return { error: `Failed to fetch SVG "${input}": ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  try {
    const filePath = resolve(input.startsWith("~") ? input.replace("~", homedir()) : input);
    const svg = await readFile(filePath, "utf-8");
    if (!svg.includes("<svg")) return { error: `File "${input}" does not contain SVG markup.` };
    return { svg };
  } catch (e) {
    return { error: `Failed to read SVG "${input}": ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function fetchImageAsBase64(
  input: string,
): Promise<{ base64: string; mimeType: string } | { error: string }> {
  if (isRemoteUrl(input)) {
    try {
      const res = await fetch(input);
      if (!res.ok) return { error: `Image fetch returned ${res.status} for "${input}".` };
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const buffer = await res.arrayBuffer();
      return { base64: Buffer.from(buffer).toString("base64"), mimeType: contentType };
    } catch (e) {
      return { error: `Failed to fetch image "${input}": ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  // Local file path (cross-platform)
  try {
    const filePath = resolve(input.startsWith("~") ? input.replace("~", homedir()) : input);
    const buffer = await readFile(filePath);
    const mimeType = EXT_MIME[extname(filePath).toLowerCase()] || "image/jpeg";
    return { base64: buffer.toString("base64"), mimeType };
  } catch (e) {
    return { error: `Failed to read image "${input}": ${e instanceof Error ? e.message : String(e)}` };
  }
}
