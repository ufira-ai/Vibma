import { batchHandler } from "./helpers";

// ─── Figma Handlers ──────────────────────────────────────────────

export async function setEffectsSingle(p: any): Promise<any> {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("effects" in node)) throw new Error(`Node does not support effects: ${p.nodeId}`);

  const result: any = {};
  if (p.effectStyleName) {
    const styles = await figma.getLocalEffectStylesAsync();
    const exact = styles.find(s => s.name === p.effectStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.effectStyleName.toLowerCase()));
    if (!match) {
      const available = styles.map(s => s.name);
      const names = available.slice(0, 20);
      const suffix = available.length > 20 ? `, … and ${available.length - 20} more` : "";
      throw new Error(`effectStyleName '${p.effectStyleName}' not found. Available: [${names.join(", ")}${suffix}]`);
    }
    await (node as any).setEffectStyleIdAsync(match.id);
    result.matchedStyle = match.name;
    if (p.effects) result.warning = "Both effectStyleName and effects provided — used effectStyleName, ignored effects. Pass only one.";
  } else if (p.effects) {
    const mapped = p.effects.map((e: any) => {
      const eff: any = { type: e.type, radius: e.radius, visible: e.visible ?? true };
      if (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") eff.blendMode = e.blendMode || "NORMAL";
      if (e.color) eff.color = { r: e.color.r ?? 0, g: e.color.g ?? 0, b: e.color.b ?? 0, a: e.color.a ?? 1 };
      if (e.offset) eff.offset = { x: e.offset.x ?? 0, y: e.offset.y ?? 0 };
      if (e.spread !== undefined) eff.spread = e.spread;
      return eff;
    });
    (node as any).effects = mapped;
  }
  return result;
}

export async function setConstraintsSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("constraints" in node)) throw new Error(`Node does not support constraints: ${p.nodeId}`);
  (node as any).constraints = { horizontal: p.horizontal, vertical: p.vertical };
  return {};
}

export async function setExportSettingsSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("exportSettings" in node)) throw new Error(`Node does not support exportSettings: ${p.nodeId}`);
  (node as any).exportSettings = p.settings;
  return {};
}

export async function setNodePropertiesSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  for (const [key, value] of Object.entries(p.properties)) {
    if (key in node) (node as any)[key] = value;
  }
  return {};
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  set_effects: (p) => batchHandler(p, setEffectsSingle),
  set_constraints: (p) => batchHandler(p, setConstraintsSingle),
  set_export_settings: (p) => batchHandler(p, setExportSettingsSingle),
  set_node_properties: (p) => batchHandler(p, setNodePropertiesSingle),
};
