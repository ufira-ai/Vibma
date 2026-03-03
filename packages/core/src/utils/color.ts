/** Convert RGBA (0-1 float) to hex string. Handles both server and plugin contexts. */
export function rgbaToHex(color: any): string {
  if (typeof color === "string" && color.startsWith("#")) return color;

  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const a = color.a !== undefined ? Math.round(color.a * 255) : 255;

  const hex = [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return a === 255 ? `#${hex}` : `#${hex}${a.toString(16).padStart(2, "0")}`;
}
