import { z } from "zod";
import type { McpServer, SendCommandFn, Capabilities } from "./types";
import { mcpJson, mcpError } from "./types";
import { registerTools } from "./registry";

// Generated endpoint tools (schema compiler output)
import { tools as generatedTools } from "./generated/defs";
import { resolveHelp, resolveEndpointHelp } from "./generated/help";
import { resolveGuideline } from "./generated/guidelines";

import { registerPrompts } from "./prompts";
import { fetchIconSvg, searchIcons, listCollections } from "./iconify";
import { searchPhotos, getPhoto, fetchImageAsBase64, resolvePexelRef, looksLikeSvg, fetchSvgContent } from "./pexels";
import {
  parseFileKey,
  parseTeamId,
  getFileLibraryList,
  getTeamLibraryList,
  filterRegistryByQuery,
  queryLibrary,
  countDetailMatches,
  resolveComponentKey,
  resolveLibraryRecord,
  listCachedComponentNames,
  validateFigmaCredentials,
} from "./figma-rest";

// Connection + icons + images + library endpoints are registered with custom inline handlers (not via generic registerTools)
const endpointTools = generatedTools.filter(t => t.name !== "connection" && t.name !== "icons" && t.name !== "images" && t.name !== "library");

// Wire per-method response formatter for frames.export (returns binary image, not JSON)
const framesTool = endpointTools.find(t => t.name === "frames");
if (framesTool) {
  framesTool.methodFormatters = {
    export: (result: unknown) => {
      const r = result as any;
      // SVG_STRING returns raw text, not binary
      if (r.isString) {
        return { content: [{ type: "text" as const, text: r.imageData }] };
      }
      return {
        content: [{ type: "image" as const, data: r.imageData, mimeType: r.mimeType || "image/png" }],
      };
    },
  };
}

export const allTools = [...endpointTools];

/** Register all MCP tools and prompts on the server */
export async function registerAllTools(server: McpServer, sendCommand: SendCommandFn, caps: Capabilities) {
  // Standalone help tool — directory of all endpoints, handled locally
  server.registerTool("help", {
    description: 'Get help on any endpoint or method. Lists all endpoints, their methods, and detailed parameter docs.\nExamples: help() → directory, help(topic: "components") → endpoint details, help(topic: "components.create") → method params.',
    inputSchema: {
      topic: z.string().optional().describe('Endpoint or endpoint.method name, e.g. "components" or "components.create"'),
    },
  }, async (params: any) => {
    return { content: [{ type: "text" as const, text: resolveHelp(params.topic) }] };
  });

  // Standalone guidelines tool — design methodology, handled locally
  server.registerTool("guidelines", {
    description: 'Design guidelines for building quality Figma designs. Covers layout, responsiveness, tokens, components, accessibility, naming, and workflow.\nExamples: guidelines() → list topics, guidelines(topic: "responsive-designs") → full guideline.',
    inputSchema: {
      topic: z.string().optional().describe('Guideline topic name, e.g. "responsive-designs" or "token-discipline"'),
    },
  }, async (params: any) => {
    return { content: [{ type: "text" as const, text: resolveGuideline(params.topic) }] };
  });

  // ─── Icons endpoint — all methods inline (Iconify API + sendCommand delegation) ───
  // Follows the connection pattern: YAML-defined schema with inline:true, registered with custom handlers.
  const iconsDef = generatedTools.find(t => t.name === "icons");
  if (iconsDef) {
    const iconsSchema = typeof iconsDef.schema === "function" ? iconsDef.schema(caps) : iconsDef.schema;

    server.registerTool("icons", {
      description: iconsDef.description,
      inputSchema: iconsSchema,
    }, async (params: any) => {
      try {
        const method = params.method;

        if (method === "help") {
          const text = resolveEndpointHelp("icons", params.topic) ?? resolveHelp("icons");
          return { content: [{ type: "text" as const, text }] };
        }

        if (method === "search") {
          if (!params.query) return mcpError("icons", "search requires a query parameter");
          const result = await searchIcons(params.query, params.prefix, params.limit);
          return mcpJson(result);
        }

        if (method === "collections") {
          const result = await listCollections(params.query, params.category, params.limit);
          return mcpJson(result);
        }

        if (method === "create") {
          if (!params.icon) {
            return mcpError("icons", 'create requires icon — e.g. icon:"lucide:home"');
          }
          const result = await fetchIconSvg(params.icon, params.size);
          if ("error" in result) return mcpError("icons", result.error);

          const isStrokeIcon = /stroke="(?!none")[^"]+/.test(result.svg) && /fill="none"/.test(result.svg);
          const colorVar = params.colorVariableName;
          const colorStyle = params.colorStyleName;
          const fillVar = params.fillVariableName ?? (isStrokeIcon ? undefined : colorVar);
          const strokeVar = params.strokeVariableName ?? (isStrokeIcon ? colorVar : undefined);
          const fillStyle = params.fillStyleName ?? (isStrokeIcon ? undefined : colorStyle);
          const strokeStyle = params.strokeStyleName ?? (isStrokeIcon ? colorStyle : undefined);

          const figmaResult = await sendCommand("frames.create", {
            type: "svg",
            items: [{
              svg: result.svg,
              name: params.name ?? params.icon,
              parentId: params.parentId,
              x: params.x,
              y: params.y,
              fillStyleName: fillStyle,
              fillVariableName: fillVar,
              strokeStyleName: strokeStyle,
              strokeVariableName: strokeVar,
            }],
          });

          const hasColor = fillVar || strokeVar || fillStyle || strokeStyle;
          if (!hasColor && figmaResult && typeof figmaResult === "object") {
            const r = figmaResult as any;
            if (!r.warnings) r.warnings = [];
            const param = isStrokeIcon ? "strokeVariableName" : "fillVariableName";
            const id = Array.isArray(r.results) ? r.results[0]?.id : undefined;
            r.warnings.push(
              `Hardcoded color. Pass colorVariableName on create, or set ${param} on the vector child: frames(method:"update", items:[{id:"${id}", ${param}:"<name>"}])`,
            );
          }

          return mcpJson(figmaResult);
        }

        return mcpError("icons", `Unknown method "${method}"`);
      } catch (e) {
        return mcpError("icons", e);
      }
    });
  }

  // ─── Images endpoint — search inline (Pexels API), no Figma handler needed ───
  // Only registered when PEXELS_API_KEY is set — no point exposing a tool agents can't use.
  const imagesDef = process.env.PEXELS_API_KEY ? generatedTools.find(t => t.name === "images") : undefined;
  if (imagesDef) {
    const imagesSchema = typeof imagesDef.schema === "function" ? imagesDef.schema(caps) : imagesDef.schema;

    server.registerTool("images", {
      description: imagesDef.description,
      inputSchema: imagesSchema,
    }, async (params: any) => {
      try {
        const method = params.method;

        if (method === "help") {
          const text = resolveEndpointHelp("images", params.topic) ?? resolveHelp("images");
          return { content: [{ type: "text" as const, text }] };
        }

        if (method === "search") {
          if (!params.query) return mcpError("images", "search requires a query parameter");
          const result = await searchPhotos({
            query: params.query,
            orientation: params.orientation,
            size: params.size,
            color: params.color,
            locale: params.locale,
            page: params.page,
            per_page: params.per_page,
          });
          return mcpJson(result);
        }

        if (method === "preview") {
          if (!params.id) return mcpError("images", "preview requires an id parameter");
          const photo = await getPhoto(Number(params.id));
          if ("error" in photo) return mcpError("images", photo.error);
          const size: string = params.size ?? "medium";
          const url = (photo.src as any)[size] ?? photo.src.medium;
          const img = await fetchImageAsBase64(url);
          if ("error" in img) return mcpError("images", img.error);
          return {
            content: [
              { type: "image" as const, data: img.base64, mimeType: img.mimeType },
              { type: "text" as const, text: JSON.stringify({ id: photo.id, alt: photo.alt, photographer: photo.photographer, width: photo.width, height: photo.height }) },
            ],
          };
        }

        return mcpError("images", `Unknown method "${method}"`);
      } catch (e) {
        return mcpError("images", e);
      }
    });
  }

  // ─── Library endpoint — browse external published team libraries via Figma REST API ───
  // Only registered when both FIGMA_API_TOKEN and FIGMA_TEAM_ID are set and the token
  // is valid (verified via GET /v1/me at startup). Without these, the tool is hidden —
  // agents never see it and can't call it with invalid credentials.
  const figmaCreds = await validateFigmaCredentials();
  const libraryDef = figmaCreds.ok ? generatedTools.find(t => t.name === "library") : undefined;
  if (!figmaCreds.ok) {
    console.error(`[vibma] Library tool disabled: ${figmaCreds.error}`);
  } else {
    console.error(`[vibma] Library tool enabled (team ${process.env.FIGMA_TEAM_ID})`);
  }
  if (libraryDef) {
    const librarySchema = typeof libraryDef.schema === "function" ? libraryDef.schema(caps) : libraryDef.schema;

    server.registerTool("library", {
      description: libraryDef.description,
      inputSchema: librarySchema,
    }, async (params: any) => {
      try {
        const method = params.method;

        if (method === "help") {
          const text = resolveEndpointHelp("library", params.topic) ?? resolveHelp("library");
          return { content: [{ type: "text" as const, text }] };
        }

        const teamFromEnv = process.env.FIGMA_TEAM_ID;
        let { file, team } = params;

        // Convenience: if registry is empty and neither target is passed, try env.
        const needsTarget = (m: string) => m === "list" || (m === "get" && filterRegistryByQuery("").length === 0);
        if (!file && !team && needsTarget(method) && teamFromEnv) team = teamFromEnv;

        if (method === "list") {
          if (!file && !team) {
            return mcpError("library", "list requires either a file (URL or key), a team (URL or ID), or FIGMA_TEAM_ID env var on the MCP server.");
          }
          if (file && team) return mcpError("library", "Pass either file or team, not both");

          const view = file
            ? await getFileLibraryList(parseFileKey(file))
            : await getTeamLibraryList(parseTeamId(team));

          return mcpJson(view);
        }

        if (method === "get") {
          if (!params.query) {
            return mcpError("library", 'get requires a query parameter — e.g. library(method:"get", query:"button")');
          }

          // If registry is empty, auto-populate from file/team (ergonomic one-shot).
          if (filterRegistryByQuery("").length === 0) {
            if (!file && !team) {
              return mcpError("library", "Registry empty. Call library(method:\"list\") first, or pass file/team on this call for a one-shot list+get.");
            }
            if (file) await getFileLibraryList(parseFileKey(file));
            else await getTeamLibraryList(parseTeamId(team));
          }

          // Accept query as a single string or an array of strings. Each query
          // is a substring filter; matches across queries are merged and deduped
          // by registered name. Optional library/section filters narrow by source
          // so overlapping names across imported libraries can be disambiguated.
          const rawQueries: string | string[] = params.query;
          const queries = Array.isArray(rawQueries) ? rawQueries : [rawQueries];
          const view = await queryLibrary(queries, { library: params.library, section: params.section });
          if (countDetailMatches(view) === 0) {
            const scope = [
              params.library ? `library matching "${params.library}"` : null,
              params.section ? `section matching "${params.section}"` : null,
            ].filter(Boolean).join(" / ");
            const hint = `No entries match ${JSON.stringify(queries)}${scope ? ` in ${scope}` : ""}. Call library(method:"list") to see what's available.`;
            return mcpJson({ libraries: [], hint });
          }
          return mcpJson(view);
        }

        return mcpError("library", `Unknown method "${method}"`);
      } catch (e) {
        return mcpError("library", e);
      }
    });
  }

  // ─── imageUrl pre-processor ───
  // Intercept imageUrl in create/update items, download image MCP-side,
  // and inject _imageData (base64) for the Figma handler.
  // Applied to all node-based endpoints (frames, text, components, instances).
  /** Resolve imageUrl (pexel:ID, SVG, or raster URL/path) → _imageData or _svgMarkup. */
  async function resolveOneImageUrl(target: any): Promise<void> {
    if (!target.imageUrl) return;
    let url = target.imageUrl;
    let attribution: string | undefined;

    // Resolve pexel:ID → actual URL + attribution
    if (url.startsWith("pexel:")) {
      const resolved = await resolvePexelRef(url);
      if ("error" in resolved) throw new Error(resolved.error);
      url = resolved.url;
      attribution = resolved.attribution;
    }

    // SVG → read as text markup for createNodeFromSvg
    if (looksLikeSvg(url)) {
      const result = await fetchSvgContent(url);
      if ("error" in result) throw new Error(result.error);
      target._svgMarkup = result.svg;
      delete target.imageUrl;
      return;
    }

    const img = await fetchImageAsBase64(url);
    if ("error" in img) throw new Error(img.error);
    target._imageData = img.base64;
    target._imageMimeType = img.mimeType;
    if (attribution) target._attribution = attribution;
    delete target.imageUrl;
  }

  async function resolveImageUrlsDeep(node: any): Promise<void> {
    await resolveOneImageUrl(node);
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        await resolveImageUrlsDeep(child);
      }
    }
  }

  async function resolveImageUrls(params: any): Promise<void> {
    const items = params.items as any[] | undefined;
    if (!items) {
      await resolveImageUrlsDeep(params);
      return;
    }
    for (const item of items) {
      await resolveImageUrlsDeep(item);
    }
  }

  for (const name of ["frames", "text", "components", "instances"]) {
    const tool = allTools.find(t => t.name === name);
    if (tool) tool.preProcess = resolveImageUrls;
  }

  // ─── instances pre-processor: componentName → componentKey ───
  // Agents reference published library components by human-readable name.
  // The figma-rest module holds an internal name→key registry populated
  // whenever library(...) runs. This pre-processor resolves the name once
  // at dispatch time so the plugin receives a key — agent context never
  // has to touch the 40-char opaque key directly.
  // ─── Library style resolver ──────────────────────────────────
  // For frames/text items: if the agent passed fillStyleName/strokeStyleName/
  // For *StyleName params, attach a sibling _*StyleKey field when the name
  // appears in the library registry. The plugin-side applier uses local-first
  // precedence — if a local style with that exact name exists, it wins and the
  // key is ignored. Otherwise the plugin imports via importStyleByKeyAsync and
  // applies the returned style's ID directly. This matters especially for text
  // styles: figma.getLocalTextStylesAsync does NOT return library-imported text
  // styles until they've been applied to a node, so the name-lookup path alone
  // cannot find them — the direct ID from importStyleByKeyAsync is the only
  // reliable way to apply a library text style.
  function resolveLibraryStyleKeys(node: any): void {
    if (node.fillStyleName) {
      const rec = resolveLibraryRecord(node.fillStyleName);
      if (rec?.kind === "style") node._fillStyleKey = rec.key;
    }
    if (node.strokeStyleName) {
      const rec = resolveLibraryRecord(node.strokeStyleName);
      if (rec?.kind === "style") node._strokeStyleKey = rec.key;
    }
    if (node.textStyleName) {
      const rec = resolveLibraryRecord(node.textStyleName);
      if (rec?.kind === "style") node._textStyleKey = rec.key;
    }
    if (node.effectStyleName) {
      const rec = resolveLibraryRecord(node.effectStyleName);
      if (rec?.kind === "style") node._effectStyleKey = rec.key;
    }
    if (Array.isArray(node.children)) for (const c of node.children) resolveLibraryStyleKeys(c);
  }

  async function resolveStyleNames(params: any): Promise<void> {
    const items = params.items as any[] | undefined;
    if (!items) {
      resolveLibraryStyleKeys(params);
      return;
    }
    for (const item of items) resolveLibraryStyleKeys(item);
  }

  for (const name of ["frames", "text"]) {
    const tool = allTools.find(t => t.name === name);
    if (tool) {
      const existing = tool.preProcess;
      tool.preProcess = async (params: any) => {
        await resolveStyleNames(params);
        if (existing) await existing(params);
      };
    }
  }

  // Auto-resolve componentName → componentKey from the registry. No gate — the
  // plugin imports on-demand when it sees componentKey. Figma itself tracks
  // imported components; we don't duplicate that state.
  async function resolveComponentNames(params: any): Promise<void> {
    const items = params.items as any[] | undefined;
    if (!items) return;
    for (const item of items) {
      if (item.componentName && !item.componentKey && !item.componentId) {
        const name: string = item.componentName;
        const key = resolveComponentKey(name);
        if (!key) {
          const known = listCachedComponentNames();
          const hint = known.length
            ? ` Registry has: ${known.slice(0, 10).join(", ")}${known.length > 10 ? ", ..." : ""}.`
            : ' Registry is empty — call library(method:"list") first to populate it.';
          throw new Error(`Unknown componentName "${name}".${hint}`);
        }
        item.componentKey = key;
        delete item.componentName;
      }
    }
  }

  const instancesTool = allTools.find(t => t.name === "instances");
  if (instancesTool) {
    const existingPreProcess = instancesTool.preProcess;
    instancesTool.preProcess = async (params: any) => {
      await resolveComponentNames(params);
      if (existingPreProcess) await existingPreProcess(params);
    };
  }

  registerTools(server, sendCommand, caps, allTools);
  registerPrompts(server);
}
