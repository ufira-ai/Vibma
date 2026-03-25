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
import { searchPhotos, fetchImageAsBase64, resolvePexelRef, looksLikeSvg, fetchSvgContent } from "./pexels";

// Connection + icons + images endpoints are registered with custom inline handlers (not via generic registerTools)
const endpointTools = generatedTools.filter(t => t.name !== "connection" && t.name !== "icons" && t.name !== "images");

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
export function registerAllTools(server: McpServer, sendCommand: SendCommandFn, caps: Capabilities) {
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

        return mcpError("images", `Unknown method "${method}"`);
      } catch (e) {
        return mcpError("images", e);
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

  async function resolveImageUrls(params: any): Promise<void> {
    const items = params.items as any[] | undefined;
    if (!items) {
      await resolveOneImageUrl(params);
      return;
    }
    for (const item of items) {
      await resolveOneImageUrl(item);
    }
  }

  for (const name of ["frames", "text", "components", "instances"]) {
    const tool = allTools.find(t => t.name === name);
    if (tool) tool.preProcess = resolveImageUrls;
  }

  registerTools(server, sendCommand, caps, allTools);
  registerPrompts(server);
}
