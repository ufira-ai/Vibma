/**
 * Penpot layout model mapping helpers.
 *
 * Penpot uses a CSS Flex/Grid model rather than Figma's AutoLayout enum model.
 * These helpers translate Vibma's abstract layout values to Penpot API properties.
 *
 * Key differences from adapter-figma/src/handlers/helpers.ts:
 * - `layoutMode` → `layoutFlexDir` ("row" | "column")
 * - `primaryAxisAlignItems` → `layoutJustifyContent`
 * - `counterAxisAlignItems` → `layoutAlignItems`
 * - `primaryAxisSizingMode` / `counterAxisSizingMode` → `layoutSizing` per-axis strings
 * - Colors: Penpot uses `fills` array with `{fillColor, fillOpacity}` rather than Figma `Paint[]`
 */

// ─── Layout direction ────────────────────────────────────────────

/**
 * Map Vibma abstract layout direction to Penpot layoutFlexDir.
 * Vibma: "HORIZONTAL" | "VERTICAL" | "NONE"
 * Penpot: "row" | "column" (no layout when "NONE")
 */
export function mapLayoutMode(vibmaMode: string): "row" | "column" | null {
  switch (vibmaMode) {
    case "HORIZONTAL": return "row";
    case "VERTICAL":   return "column";
    default:           return null; // "NONE" → no flex layout
  }
}

// ─── Primary axis alignment (justify-content) ────────────────────

/**
 * Map Vibma primaryAxisAlignItems to Penpot layoutJustifyContent.
 * Vibma: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN"
 * Penpot: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly"
 */
export function mapPrimaryAlign(vibmaAlign: string): string {
  // Maps Vibma primaryAxisAlignItems → Penpot FlexLayout.justifyContent
  switch (vibmaAlign) {
    case "MIN":           return "start";
    case "CENTER":        return "center";
    case "MAX":           return "end";
    case "SPACE_BETWEEN": return "space-between";
    default:              return "start";
  }
}

// ─── Counter axis alignment (align-items) ────────────────────────

/**
 * Map Vibma counterAxisAlignItems to Penpot layoutAlignItems.
 * Vibma: "MIN" | "CENTER" | "MAX" | "BASELINE"
 * Penpot: "start" | "center" | "end" | "stretch"
 */
export function mapCounterAlign(vibmaAlign: string): string {
  // Maps Vibma counterAxisAlignItems → Penpot FlexLayout.alignItems
  // BASELINE is not supported in Penpot FlexLayout; falls back to "start".
  switch (vibmaAlign) {
    case "MIN":      return "start";
    case "CENTER":   return "center";
    case "MAX":      return "end";
    case "BASELINE": return "start"; // Penpot gap: no baseline align in flex layout
    default:         return "start";
  }
}

// ─── Sizing mode ─────────────────────────────────────────────────

/**
 * Map Vibma sizing mode to Penpot per-axis sizing string.
 * Vibma: "FIXED" | "HUG" | "FILL"
 * Penpot: "fixed" | "fill" | "auto" (hug → "auto" in Penpot terms)
 */
export function mapSizing(vibmaSizing: string): 'fit-content' | 'fill' | 'auto' {
  // Maps Vibma sizing mode → Penpot CommonLayout sizing
  // Penpot: "fit-content" (hug), "fill", "auto" (fixed in older docs)
  switch (vibmaSizing) {
    case "HUG":   return "fit-content";
    case "FILL":  return "fill";
    case "FIXED": return "auto";
    default:      return "auto";
  }
}

// ─── Color / fill conversion ──────────────────────────────────────

/**
 * Convert a Vibma RGBA color object (channels 0–1) to a Penpot fill entry.
 *
 * Figma uses: `{ type: "SOLID", color: { r, g, b }, opacity }`
 * Penpot uses: `{ fillColor: "#rrggbb", fillOpacity: number }`
 */
export function vibmaColorToPenpotFill(c: {
  r: number;
  g: number;
  b: number;
  a?: number;
}): { fillColor: string; fillOpacity: number } {
  // TODO: implement
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return {
    fillColor: `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`,
    fillOpacity: c.a ?? 1,
  };
}
