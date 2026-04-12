/**
 * Figma REST API client — browse published team library components and styles.
 * MCP-side only (no plugin involvement). Auth via FIGMA_API_TOKEN env var.
 */

// ─── Auth ────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.FIGMA_API_TOKEN;
  if (!token) {
    throw new Error(
      "FIGMA_API_TOKEN environment variable is not set. " +
      "Create a Personal Access Token at https://www.figma.com/developers/api#access-tokens " +
      "with the 'Team library content — Read' scope (team_library_content:read) and set it in your environment.",
    );
  }
  return token;
}

/**
 * Validate FIGMA_API_TOKEN + FIGMA_TEAM_ID at startup. Tests the token against
 * the actual team library endpoint (GET /v1/teams/:id/components?page_size=1)
 * so we verify token validity, scope, AND team access in one call.
 * Non-throwing — callers decide whether to skip tool registration or warn.
 */
export async function validateFigmaCredentials(): Promise<{ ok: boolean; user?: string; error?: string }> {
  const token = process.env.FIGMA_API_TOKEN;
  if (!token) {
    return { ok: false, error: "FIGMA_API_TOKEN not set. Library tool will not be registered. Create a Personal Access Token at https://www.figma.com/developers/api#access-tokens with the 'Team library content — Read' scope (team_library_content:read)." };
  }
  const teamId = process.env.FIGMA_TEAM_ID;
  if (!teamId) {
    return { ok: false, error: "FIGMA_TEAM_ID not set. Library tool will not be registered. Set the team ID (from figma.com/files/team/:id) so library.list can discover components." };
  }
  try {
    const res = await fetch(`https://api.figma.com/v1/teams/${teamId}/components?page_size=1`, {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) {
      if (res.status === 403) {
        const body = await res.text().catch(() => "");
        return { ok: false, error: `FIGMA_API_TOKEN lacks access to this team (403). ${body.includes("scope") ? body : "Ensure the token has the 'Team library content — Read' scope (team_library_content:read) and belongs to a member of the team."}` };
      }
      if (res.status === 404) return { ok: false, error: `FIGMA_TEAM_ID '${teamId}' not found (404). Verify the team ID from figma.com/files/team/:id.` };
      return { ok: false, error: `Figma API returned ${res.status} when validating team access. Library tool will not be registered.` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `Cannot reach Figma API: ${e.message}. Library tool will not be registered.` };
  }
}

// ─── URL Parsing ─────────────────────────────────────────────────

const FILE_URL_RE = /figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/;
const TEAM_URL_RE = /figma\.com\/files\/team\/(\d+)/;

export function parseFileKey(input: string): string {
  const m = input.match(FILE_URL_RE);
  if (m) return m[1];
  if (/^[a-zA-Z0-9]+$/.test(input)) return input;
  throw new Error(`Cannot parse file key from "${input}". Provide a Figma file URL (figma.com/design/:key/...) or a raw file key.`);
}

export function parseTeamId(input: string): string {
  const m = input.match(TEAM_URL_RE);
  if (m) return m[1];
  if (/^\d+$/.test(input)) return input;
  throw new Error(`Cannot parse team ID from "${input}". Provide a Figma team URL (figma.com/files/team/:id/...) or a raw team ID.`);
}

// ─── HTTP cache ──────────────────────────────────────────────────

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: any; ts: number }>();

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return undefined; }
  return entry.data as T;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, ts: Date.now() });
}

async function figmaGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`https://api.figma.com${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const cacheKey = url.toString();
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  // Figma PATs (figd_*) require X-Figma-Token. Bearer is only for OAuth access tokens.
  // X-Figma-Token works for both, so we use it unconditionally.
  const res = await fetch(url.toString(), {
    headers: { "X-Figma-Token": getToken() },
  });

  if (!res.ok) {
    if (res.status === 403) throw new Error(`403 from Figma (${path}). The token is either invalid or lacks scope for this endpoint (need library_content:read for team/file library endpoints).`);
    if (res.status === 404) throw new Error(`404 from Figma (${path}). File or team not found — verify the URL/key.`);
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after") || "60";
      throw new Error(`Figma API rate limited. Retry after ${retryAfter} seconds.`);
    }
    throw new Error(`Figma API error ${res.status}: ${await res.text()}`);
  }

  const data = await res.json() as T;
  setCache(cacheKey, data);
  return data;
}

// ─── Internal registry ───────────────────────────────────────────
// Every library(list) call populates this map as a side effect. Keys are
// deliberately NOT exposed to the agent — downstream tools (instances.create,
// library.get) resolve by name and use the key internally for import/fetch.

export type LibraryKind = "component" | "set" | "style";

export interface LibraryRecord {
  name: string;
  kind: LibraryKind;
  key: string;          // Figma component/style key (opaque; never returned to agent)
  fileKey: string;      // Source file key — needed for detail fetches
  nodeId: string;       // Node ID within the source file — needed for componentPropertyDefinitions
  description?: string;
  containingFrame?: string;
  styleType?: string;   // For kind === "style": FILL | TEXT | EFFECT | GRID
}

const registry = new Map<string, LibraryRecord>();

/** Returns the final name used in the registry (bare or disambiguated). */
function registerRecord(r: LibraryRecord): string {
  if (!registry.has(r.name)) {
    registry.set(r.name, r);
    return r.name;
  }
  const existing = registry.get(r.name)!;
  if (existing.fileKey === r.fileKey && existing.nodeId === r.nodeId) return r.name; // identical re-hit
  const qualified = r.containingFrame
    ? `${r.name} (in ${r.containingFrame})`
    : `${r.name} (${r.fileKey.slice(0, 6)})`;
  registry.set(qualified, r);
  return qualified;
}

export function resolveLibraryRecord(name: string): LibraryRecord | undefined {
  return registry.get(name);
}

export function resolveComponentKey(name: string): string | undefined {
  const r = registry.get(name);
  if (!r || r.kind === "style") return undefined;
  return r.key;
}

export function resolveStyleKey(name: string): string | undefined {
  const r = registry.get(name);
  if (!r || r.kind !== "style") return undefined;
  return r.key;
}

export function listCachedComponentNames(): string[] {
  const names: string[] = [];
  for (const [name, rec] of registry.entries()) {
    if (rec.kind !== "style") names.push(name);
  }
  return names;
}

// NOTE: no MCP-side "imported" Set. Resolution works on-demand from the
// registry: if a name is in the registry (populated by library.list), the
// MCP pre-processor attaches the key, and the plugin imports idempotently
// via figma.import*ByKeyAsync at apply time. Figma itself is the single
// source of truth for whether a component/style is available in a file.

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Figma's team /components endpoint returns every variant of a set as a
 * standalone entry with a property-path name like "Size=XL, Buttons=2".
 * Detect these and skip — they are not addressable by name alone.
 */
function isVariantPathName(name: string): boolean {
  if (!name.includes("=")) return false;
  return /^[^=,]+=[^=,]+(?:,\s?[^=,]+=[^=,]+)*$/.test(name);
}

/**
 * Convention: any segment starting with "_" marks the entry as internal/private
 * by team-library convention. Applies to the name itself AND its containing
 * frame (so a component inside a "_Kit" page is hidden even if its own name is
 * clean). Agents shouldn't instantiate hidden entries directly.
 */
function isHiddenSegment(s: string | undefined | null): boolean {
  if (!s) return false;
  return s.split("/").some(seg => seg.startsWith("_"));
}

function isHidden(name: string, containing_frame: any): boolean {
  if (isHiddenSegment(name)) return true;
  if (isHiddenSegment(containing_frame?.name)) return true;
  if (isHiddenSegment(containing_frame?.pageName)) return true;
  return false;
}

/**
 * containing_frame shape differs between file and team endpoints:
 *   file: { name, nodeId, ... } | team: { pageId, pageName }
 */
function frameLabel(cf: any): string | undefined {
  return cf?.name ?? cf?.pageName;
}

// ─── List fetchers ───────────────────────────────────────────────
// list() is cheap-to-browse: registers everything in the internal map and
// returns minimal shapes. No pagination — page_size is maxed out.

export interface LibrarySection {
  name: string;               // Containing frame (page/section) name as designers see in Figma's libraries panel — e.g. "Sidebars", "Windows", "Buttons"
  components: string[];       // non-variant component names
  componentSets: string[];    // variant set names (preferred for agents)
  styles: {
    TEXT: string[];
    FILL: string[];
    EFFECT: string[];
    GRID: string[];
  };
}

export interface LibraryGroup {
  name: string;               // Source library (Figma file) name
  sections: LibrarySection[]; // Sections mirror the section headers in Figma's Libraries browser
}

export interface LibraryListView {
  libraries: LibraryGroup[];  // grouped by source file + section so agents can tell overlapping libraries apart
}

function emptySection(name: string): LibrarySection {
  return { name, components: [], componentSets: [], styles: { TEXT: [], FILL: [], EFFECT: [], GRID: [] } };
}

interface CollectedEntry {
  finalName: string;
  kind: LibraryKind;
  fileKey: string;
  section: string;            // containing_frame name, or "(unsectioned)" when absent
  styleType?: string;
}

function absorbComponents(raw: any[], entries: CollectedEntry[]): void {
  for (const c of raw) {
    if (isVariantPathName(c.name)) continue;
    if (isHidden(c.name, c.containing_frame)) continue;
    const section = frameLabel(c.containing_frame);
    const finalName = registerRecord({
      name: c.name,
      kind: "component",
      key: c.key,
      fileKey: c.file_key,
      nodeId: c.node_id,
      description: c.description || undefined,
      containingFrame: section,
    });
    entries.push({ finalName, kind: "component", fileKey: c.file_key, section: section || "(unsectioned)" });
  }
}

function absorbComponentSets(raw: any[], entries: CollectedEntry[]): void {
  for (const cs of raw) {
    if (isHidden(cs.name, cs.containing_frame)) continue;
    const section = frameLabel(cs.containing_frame);
    const finalName = registerRecord({
      name: cs.name,
      kind: "set",
      key: cs.key,
      fileKey: cs.file_key,
      nodeId: cs.node_id,
      description: cs.description || undefined,
      containingFrame: section,
    });
    entries.push({ finalName, kind: "set", fileKey: cs.file_key, section: section || "(unsectioned)" });
  }
}

function absorbStyles(raw: any[], entries: CollectedEntry[]): void {
  for (const s of raw) {
    if (isHidden(s.name, s.containing_frame)) continue;
    const section = frameLabel(s.containing_frame);
    const finalName = registerRecord({
      name: s.name,
      kind: "style",
      key: s.key,
      fileKey: s.file_key,
      nodeId: s.node_id,
      description: s.description || undefined,
      containingFrame: section,
      styleType: s.style_type,
    });
    entries.push({ finalName, kind: "style", fileKey: s.file_key, section: section || "(unsectioned)", styleType: s.style_type });
  }
}

// The Figma REST API returns opaque file_key per entry but not the source file's
// display name. We fetch /v1/files/{fileKey}?depth=1 once per unique file so agents
// see the library grouped under its human-readable Figma file name.
async function getLibraryFileName(fileKey: string): Promise<string> {
  try {
    const data = await figmaGet<any>(`/v1/files/${fileKey}`, { depth: "1" });
    if (typeof data?.name === "string" && data.name.length > 0) return data.name;
    return `(unnamed library ${fileKey.slice(0, 6)})`;
  } catch {
    return `(unreachable library ${fileKey.slice(0, 6)})`;
  }
}

async function groupEntries(entries: CollectedEntry[]): Promise<LibraryListView> {
  const uniqueFileKeys = Array.from(new Set(entries.map(e => e.fileKey)));
  const nameByKey = new Map<string, string>();
  await Promise.all(uniqueFileKeys.map(async (key) => {
    nameByKey.set(key, await getLibraryFileName(key));
  }));

  // fileKey → (sectionName → LibrarySection)
  const libraries = new Map<string, { name: string; sections: Map<string, LibrarySection> }>();
  for (const e of entries) {
    const libName = nameByKey.get(e.fileKey) || `(unknown ${e.fileKey.slice(0, 6)})`;
    let lib = libraries.get(e.fileKey);
    if (!lib) { lib = { name: libName, sections: new Map() }; libraries.set(e.fileKey, lib); }
    let sec = lib.sections.get(e.section);
    if (!sec) { sec = emptySection(e.section); lib.sections.set(e.section, sec); }
    if (e.kind === "component") sec.components.push(e.finalName);
    else if (e.kind === "set") sec.componentSets.push(e.finalName);
    else if (e.kind === "style" && e.styleType) {
      const bucket = sec.styles[e.styleType as keyof LibrarySection["styles"]];
      if (bucket) bucket.push(e.finalName);
    }
  }

  return {
    libraries: Array.from(libraries.values()).map(lib => ({
      name: lib.name,
      sections: Array.from(lib.sections.values()),
    })),
  };
}

/** Fetch everything from a file in parallel. */
export async function getFileLibraryList(fileKey: string): Promise<LibraryListView> {
  const [comps, sets, styles] = await Promise.all([
    figmaGet<any>(`/v1/files/${fileKey}/components`).catch(() => ({ meta: { components: [] } })),
    figmaGet<any>(`/v1/files/${fileKey}/component_sets`).catch(() => ({ meta: { component_sets: [] } })),
    figmaGet<any>(`/v1/files/${fileKey}/styles`).catch(() => ({ meta: { styles: [] } })),
  ]);
  const entries: CollectedEntry[] = [];
  absorbComponents(comps.meta?.components || [], entries);
  absorbComponentSets(sets.meta?.component_sets || [], entries);
  absorbStyles(styles.meta?.styles || [], entries);
  return await groupEntries(entries);
}

/** Fetch everything from a team in parallel. Auto-paginates with page_size=1000. */
export async function getTeamLibraryList(teamId: string): Promise<LibraryListView> {
  const entries: CollectedEntry[] = [];

  async function paginate(path: string, absorb: (raw: any[], e: CollectedEntry[]) => void, rootField: string) {
    let after: string | undefined;
    for (let page = 0; page < 20; page++) { // safety cap: 20k entries
      const params: Record<string, string> = { page_size: "1000" };
      if (after) params.after = after;
      const res: any = await figmaGet<any>(path, params);
      absorb(res.meta?.[rootField] || [], entries);
      after = res.meta?.cursor?.after;
      if (!after) break;
    }
  }

  await Promise.all([
    paginate(`/v1/teams/${teamId}/components`, absorbComponents, "components"),
    paginate(`/v1/teams/${teamId}/component_sets`, absorbComponentSets, "component_sets"),
    paginate(`/v1/teams/${teamId}/styles`, absorbStyles, "styles"),
  ]);

  return await groupEntries(entries);
}

// ─── Detail fetcher (for `get`) ──────────────────────────────────
// Batches one /v1/files/:fileKey/nodes?ids=... call per source file.

export interface LibraryDetail {
  name: string;
  kind: LibraryKind;
  description?: string;
  containingFrame?: string;
  styleType?: string;
  /**
   * Component property definitions — shape matches components.get output
   * (see serializeComponentSummary in adapter-figma/handlers/components.ts):
   *   { [cleanName]: { type, defaultValue?, options? } }
   * Only VARIANT props carry `options`; TEXT/BOOLEAN/INSTANCE_SWAP do not.
   */
  properties?: Record<string, {
    type: "VARIANT" | "TEXT" | "BOOLEAN" | "INSTANCE_SWAP";
    defaultValue?: string | boolean;
    options?: string[];
  }>;
  /** Usage hint generated from properties — drop-in for instances.create. */
  usage?: string;
}

/**
 * Mirror of serializeComponentSummary (adapter-figma/handlers/components.ts)
 * so library.get and components.get return the same property shape:
 *   { type, defaultValue?, options? }
 * Clean key (strip Figma's "#1:2" suffix). Omit defaultValue when undefined.
 * VARIANT props carry `options` (Figma's `variantOptions` renamed for parity).
 */
function simplifyProps(raw: any): LibraryDetail["properties"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<LibraryDetail["properties"]> = {};
  for (const [fullKey, def] of Object.entries<any>(raw)) {
    const cleanKey = fullKey.indexOf("#") > 0 ? fullKey.slice(0, fullKey.indexOf("#")) : fullKey;
    const entry: NonNullable<LibraryDetail["properties"]>[string] = { type: def.type };
    if (def.defaultValue !== undefined) entry.defaultValue = def.defaultValue;
    if (def.type === "VARIANT" && def.variantOptions) entry.options = def.variantOptions;
    out[cleanKey] = entry;
  }
  return Object.keys(out).length ? out : undefined;
}

function buildUsageHint(name: string, props: LibraryDetail["properties"]): string | undefined {
  if (!props) return undefined;
  const variantEntries = Object.entries(props).filter(([_, d]) => d.type === "VARIANT");
  const textEntries = Object.entries(props).filter(([_, d]) => d.type === "TEXT");
  const boolEntries = Object.entries(props).filter(([_, d]) => d.type === "BOOLEAN");
  const variantPart = variantEntries.length
    ? `variantProperties: {${variantEntries.map(([k, d]) => `${JSON.stringify(k)}: ${JSON.stringify(d.defaultValue ?? d.options?.[0] ?? "")}`).join(", ")}}`
    : undefined;
  const propsPart = (textEntries.length || boolEntries.length)
    ? `properties: {${[...textEntries, ...boolEntries].map(([k, d]) => `${JSON.stringify(k)}: ${JSON.stringify(d.defaultValue ?? "")}`).join(", ")}}`
    : undefined;
  const parts = [`componentName: ${JSON.stringify(name)}`, variantPart, propsPart, `parentId: "<target>"`].filter(Boolean);
  return `instances(method:"create", items:[{${parts.join(", ")}}])`;
}

export interface LibraryDetailSection {
  name: string;
  components: LibraryDetail[];
  componentSets: LibraryDetail[];
  styles: { TEXT: LibraryDetail[]; FILL: LibraryDetail[]; EFFECT: LibraryDetail[]; GRID: LibraryDetail[] };
}

export interface LibraryDetailGroup {
  name: string;
  sections: LibraryDetailSection[];
}

export interface LibraryDetailView {
  libraries: LibraryDetailGroup[];
}

function emptyDetailSection(name: string): LibraryDetailSection {
  return { name, components: [], componentSets: [], styles: { TEXT: [], FILL: [], EFFECT: [], GRID: [] } };
}

export function countDetailMatches(view: LibraryDetailView): number {
  let n = 0;
  for (const lib of view.libraries) {
    for (const sec of lib.sections) {
      n += sec.components.length + sec.componentSets.length;
      n += sec.styles.TEXT.length + sec.styles.FILL.length + sec.styles.EFFECT.length + sec.styles.GRID.length;
    }
  }
  return n;
}

/**
 * Run one or more substring queries against the registry and return results
 * nested by library → section → kind, mirroring library(method:"list") but with
 * full LibraryDetail objects at the leaves. Batch queries are merged and
 * deduped by registered name before the detail fetch. Optional library/section
 * filters narrow the result set when several libraries expose the same name.
 */
export async function queryLibrary(
  queries: string[],
  opts: { library?: string; section?: string } = {},
): Promise<LibraryDetailView> {
  const seen = new Set<string>();
  const records: LibraryRecord[] = [];
  for (const q of queries) {
    for (const rec of filterRegistryByQuery(q)) {
      if (seen.has(rec.name)) continue;
      seen.add(rec.name);
      records.push(rec);
    }
  }

  // File-name map for filtering + nesting. Reads through figmaGet's 5-minute cache.
  const uniqueFileKeys = Array.from(new Set(records.map(r => r.fileKey)));
  const nameByKey = new Map<string, string>();
  await Promise.all(uniqueFileKeys.map(async (key) => {
    nameByKey.set(key, await getLibraryFileName(key));
  }));

  const libFilter = opts.library?.toLowerCase();
  const secFilter = opts.section?.toLowerCase();
  const filtered = records.filter(r => {
    if (libFilter) {
      const libName = (nameByKey.get(r.fileKey) || "").toLowerCase();
      if (!libName.includes(libFilter)) return false;
    }
    if (secFilter) {
      const secName = (r.containingFrame || "(unsectioned)").toLowerCase();
      if (!secName.includes(secFilter)) return false;
    }
    return true;
  });

  const details = await getLibraryDetails(filtered);

  // Nest details by library → section, preserving the order in which records
  // were matched (so the first-matched library appears first).
  const libMap = new Map<string, { name: string; sections: Map<string, LibraryDetailSection> }>();
  for (let i = 0; i < filtered.length; i++) {
    const rec = filtered[i];
    const det = details[i];
    const libName = nameByKey.get(rec.fileKey) || `(unknown ${rec.fileKey.slice(0, 6)})`;
    const secName = rec.containingFrame || "(unsectioned)";
    let lib = libMap.get(rec.fileKey);
    if (!lib) { lib = { name: libName, sections: new Map() }; libMap.set(rec.fileKey, lib); }
    let sec = lib.sections.get(secName);
    if (!sec) { sec = emptyDetailSection(secName); lib.sections.set(secName, sec); }
    if (rec.kind === "component") sec.components.push(det);
    else if (rec.kind === "set") sec.componentSets.push(det);
    else if (rec.kind === "style" && rec.styleType) {
      const bucket = sec.styles[rec.styleType as keyof LibraryDetailSection["styles"]];
      if (bucket) bucket.push(det);
    }
  }

  return {
    libraries: Array.from(libMap.values()).map(lib => ({
      name: lib.name,
      sections: Array.from(lib.sections.values()),
    })),
  };
}

export async function getLibraryDetails(records: LibraryRecord[]): Promise<LibraryDetail[]> {
  // Group by fileKey so each file only costs one REST call.
  const byFile = new Map<string, LibraryRecord[]>();
  for (const r of records) {
    if (r.kind === "style" || !r.fileKey || !r.nodeId) continue; // styles have no useful detail beyond list view
    const arr = byFile.get(r.fileKey) || [];
    arr.push(r);
    byFile.set(r.fileKey, arr);
  }

  const nodeDocsByFile = new Map<string, Record<string, any>>();
  await Promise.all(
    [...byFile.entries()].map(async ([fileKey, recs]) => {
      const ids = recs.map(r => r.nodeId).join(",");
      try {
        const res: any = await figmaGet<any>(`/v1/files/${fileKey}/nodes`, { ids, depth: "1" });
        nodeDocsByFile.set(fileKey, res.nodes || {});
      } catch {
        nodeDocsByFile.set(fileKey, {});
      }
    }),
  );

  const details: LibraryDetail[] = [];
  for (const r of records) {
    if (r.kind === "style") {
      details.push({
        name: r.name,
        kind: "style",
        styleType: r.styleType,
        description: r.description,
        containingFrame: r.containingFrame,
      });
      continue;
    }
    const nodes = nodeDocsByFile.get(r.fileKey) || {};
    const doc = nodes[r.nodeId]?.document;
    const properties = simplifyProps(doc?.componentPropertyDefinitions);
    const detail: LibraryDetail = {
      name: r.name,
      kind: r.kind,
      description: r.description,
      containingFrame: r.containingFrame,
      ...(properties ? { properties } : {}),
    };
    const usage = buildUsageHint(r.name, properties);
    if (usage) detail.usage = usage;
    details.push(detail);
  }
  return details;
}

// ─── Query filter ────────────────────────────────────────────────

export function filterRegistryByQuery(query: string): LibraryRecord[] {
  const q = query.toLowerCase();
  const out: LibraryRecord[] = [];
  for (const rec of registry.values()) {
    if (rec.name.toLowerCase().includes(q) || rec.description?.toLowerCase().includes(q)) {
      out.push(rec);
    }
  }
  return out;
}
