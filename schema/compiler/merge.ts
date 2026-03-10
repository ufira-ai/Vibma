/**
 * Merge base methods into endpoints that declare `extends`.
 * Base methods are added as inherited; endpoint's own methods override.
 */
import type { RawBaseDef, RawEndpointDef, ResolvedEndpoint, ResolvedMethod } from "./types";

export function mergeEndpoints(
  bases: Map<string, RawBaseDef>,
  endpoints: RawEndpointDef[],
): ResolvedEndpoint[] {
  return endpoints.map(ep => {
    const methods: ResolvedMethod[] = [];

    // If extends a base, add base methods first (marked as inherited)
    if (ep.extends) {
      const base = bases.get(ep.extends);
      if (!base) throw new Error(`Endpoint "${ep.endpoint}" extends unknown base "${ep.extends}"`);

      for (const [name, method] of Object.entries(base.methods)) {
        // Skip if endpoint defines its own version
        if (ep.methods[name]) continue;
        methods.push({
          name,
          ...method,
          params: method.params as Record<string, any>,
          inherited: true,
        });
      }
    }

    // Add endpoint's own methods
    for (const [name, method] of Object.entries(ep.methods)) {
      methods.push({
        name,
        ...method,
        params: method.params as Record<string, any>,
        inherited: false,
      });
    }

    // Merge notes: base notes first, then endpoint notes
    let notes: string | undefined;
    if (ep.extends) {
      const base = bases.get(ep.extends);
      if (base?.notes) notes = base.notes.trim();
    }
    if (ep.notes) {
      notes = notes ? `${notes}\n${ep.notes.trim()}` : ep.notes.trim();
    }

    return {
      name: ep.endpoint,
      domain: ep.domain,
      description: ep.description,
      descriptionZh: ep.description_zh,
      notes,
      methods,
    };
  });
}
