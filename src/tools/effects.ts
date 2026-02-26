import { z } from "zod";
import { flexJson, flexBool } from "../utils/coercion";
import * as S from "./schemas";
import type { McpServer, SendCommandFn } from "./types";
import { mcpJson, mcpError } from "./types";
import { batchHandler } from "./helpers";

// ─── Schemas ─────────────────────────────────────────────────────

// Uses S.effectEntry from shared schemas

const effectItem = z.object({
  nodeId: S.nodeId,
  effects: flexJson(z.array(S.effectEntry).optional()).describe("Array of effect objects. Ignored when effectStyleName is set."),
  effectStyleName: z.string().optional().describe("Apply an effect style by name (case-insensitive). Omit to use raw effects."),
});

const constraintItem = z.object({
  nodeId: S.nodeId,
  horizontal: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
  vertical: z.enum(["MIN", "CENTER", "MAX", "STRETCH", "SCALE"]),
});

const exportSettingEntry = z.object({
  format: z.enum(["PNG", "JPG", "SVG", "PDF"]),
  suffix: z.string().optional(),
  contentsOnly: flexBool(z.boolean().optional()),
  constraint: flexJson(z.object({
    type: z.enum(["SCALE", "WIDTH", "HEIGHT"]),
    value: z.coerce.number(),
  }).optional()),
});

const exportSettingsItem = z.object({
  nodeId: S.nodeId,
  settings: flexJson(z.array(exportSettingEntry)).describe("Export settings array"),
});

const nodePropertiesItem = z.object({
  nodeId: S.nodeId,
  properties: flexJson(z.record(z.unknown())).describe("Key-value properties to set"),
});

// ─── MCP Registration ────────────────────────────────────────────

export function registerMcpTools(server: McpServer, sendCommand: SendCommandFn) {
  server.tool(
    "set_effects",
    "Set effects (shadows, blurs) on nodes. Use effectStyleName to apply by name, or provide raw effects. Batch: pass multiple items.",
    { items: flexJson(z.array(effectItem)).describe("Array of {nodeId, effects}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_effects", params)); }
      catch (e) { return mcpError("Error setting effects", e); }
    }
  );

  server.tool(
    "set_constraints",
    "Set constraints on nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(constraintItem)).describe("Array of {nodeId, horizontal, vertical}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_constraints", params)); }
      catch (e) { return mcpError("Error setting constraints", e); }
    }
  );

  server.tool(
    "set_export_settings",
    "Set export settings on nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(exportSettingsItem)).describe("Array of {nodeId, settings}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_export_settings", params)); }
      catch (e) { return mcpError("Error setting export settings", e); }
    }
  );

  server.tool(
    "set_node_properties",
    "Set arbitrary properties on nodes. Batch: pass multiple items.",
    { items: flexJson(z.array(nodePropertiesItem)).describe("Array of {nodeId, properties}"), depth: S.depth },
    async (params: any) => {
      try { return mcpJson(await sendCommand("set_node_properties", params)); }
      catch (e) { return mcpError("Error setting node properties", e); }
    }
  );
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function setEffectsSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("effects" in node)) throw new Error(`Node does not support effects: ${p.nodeId}`);

  const result: any = {};
  if (p.effectStyleName) {
    const styles = await figma.getLocalEffectStylesAsync();
    const exact = styles.find(s => s.name === p.effectStyleName);
    const match = exact || styles.find(s => s.name.toLowerCase().includes(p.effectStyleName.toLowerCase()));
    if (!match) throw new Error(`Effect style not found: "${p.effectStyleName}"`);
    await (node as any).setEffectStyleIdAsync(match.id);
    result.matchedStyle = match.name;
    if (p.effects) result._hint = "Both effectStyleName and effects provided — used effectStyleName, ignored effects. Pass only one.";
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
    result._hint = "Hardcoded effects. Use effectStyleName to apply an effect style for design system consistency.";
  }
  return result;
}

async function setConstraintsSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("constraints" in node)) throw new Error(`Node does not support constraints: ${p.nodeId}`);
  (node as any).constraints = { horizontal: p.horizontal, vertical: p.vertical };
  return {};
}

async function setExportSettingsSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!("exportSettings" in node)) throw new Error(`Node does not support exportSettings: ${p.nodeId}`);
  (node as any).exportSettings = p.settings;
  return {};
}

async function setNodePropertiesSingle(p: any) {
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
