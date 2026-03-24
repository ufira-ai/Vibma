/**
 * Iconify API client — resolves icon names to SVG via api.iconify.design.
 * In-memory cache: each icon+size combo is fetched once per MCP session.
 * Zero npm dependencies — pure fetch().
 */

const ICONIFY_API = "https://api.iconify.design";

// ─── Cache ───────────────────────────────────────────────────────

const svgCache = new Map<string, string>();

// ─── Name parsing ────────────────────────────────────────────────

const NAME_RE = /^([a-z0-9][a-z0-9-]*):([a-z0-9][a-z0-9-]*)$/;

/** Parse "prefix:name" → { prefix, name } or null on bad format. */
export function parseIconName(icon: string): { prefix: string; name: string } | null {
  const m = icon.match(NAME_RE);
  return m ? { prefix: m[1], name: m[2] } : null;
}

// ─── Fetch SVG ───────────────────────────────────────────────────

export async function fetchIconSvg(
  icon: string,
  size?: number,
): Promise<{ svg: string } | { error: string }> {
  const parsed = parseIconName(icon);
  if (!parsed) {
    return {
      error: `Invalid icon name "${icon}". Use "prefix:name" format (e.g. "lucide:home", "mdi:account").`,
    };
  }

  const height = size ?? 24;
  const cacheKey = `${icon}@${height}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return { svg: cached };

  const url = `${ICONIFY_API}/${parsed.prefix}/${parsed.name}.svg?height=${height}`;

  try {
    const res = await fetch(url);
    if (res.status === 404) {
      return {
        error:
          `Icon "${icon}" not found. Verify the name at https://icon-sets.iconify.design ` +
          `or use icons(method:"search", query:"${parsed.name}") to discover icons.`,
      };
    }
    if (!res.ok) {
      return { error: `Iconify API returned ${res.status} for "${icon}".` };
    }
    const svg = await res.text();
    if (!svg.startsWith("<svg")) {
      return { error: `Iconify API returned unexpected response for "${icon}".` };
    }
    svgCache.set(cacheKey, svg);
    return { svg };
  } catch (e) {
    return {
      error: `Iconify API unreachable — cannot fetch "${icon}": ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ─── Search ──────────────────────────────────────────────────────

export async function searchIcons(
  query: string,
  prefix?: string,
  limit?: number,
): Promise<{ icons: string[]; total: number } | { error: string }> {
  const params = new URLSearchParams({ query, limit: String(limit ?? 64) });
  if (prefix) params.set("prefix", prefix);

  try {
    const res = await fetch(`${ICONIFY_API}/search?${params}`);
    if (!res.ok) return { error: `Iconify search returned ${res.status}.` };
    const data = await res.json() as { icons: string[]; total: number };
    return { icons: data.icons, total: data.total };
  } catch (e) {
    return { error: `Iconify search failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

// ─── Collections ─────────────────────────────────────────────────

interface CollectionInfo {
  prefix: string;
  name: string;
  total: number;
  category?: string;
  license?: string;
}

export async function listCollections(): Promise<
  { collections: CollectionInfo[] } | { error: string }
> {
  try {
    const res = await fetch(`${ICONIFY_API}/collections`);
    if (!res.ok) return { error: `Iconify collections returned ${res.status}.` };
    const data = await res.json() as Record<string, any>;
    const collections: CollectionInfo[] = Object.entries(data).map(
      ([prefix, info]) => ({
        prefix,
        name: info.name,
        total: info.total,
        category: info.category,
        license: info.license?.spdx,
      }),
    );
    return { collections };
  } catch (e) {
    return { error: `Failed to fetch collections: ${e instanceof Error ? e.message : String(e)}` };
  }
}
