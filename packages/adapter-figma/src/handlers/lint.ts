import { batchHandler } from "./helpers";
import { rgbaToHex } from "@ufira/vibma/utils/color";
import {
  alphaComposite, checkContrastPair, isLargeText, inferFontWeight,
  looksInteractive, type SolidColor,
} from "@ufira/vibma/utils/wcag";

// ─── Figma Handlers ──────────────────────────────────────────────

const WCAG_RULES = [
  "wcag-contrast", "wcag-contrast-enhanced", "wcag-non-text-contrast",
  "wcag-target-size", "wcag-text-size", "wcag-line-height",
] as const;

/** Collected issue: just rule + nodeId. Grouping and prose happen at the end. */
interface Issue {
  rule: string;
  nodeId: string;
  nodeName: string;
  /** Extra context for the prose generator */
  extra?: Record<string, any>;
}

async function lintNodeHandler(params: any) {
  const ruleSet = new Set<string>(params?.rules || ["all"]);
  const runAll = ruleSet.has("all");
  // Expand "wcag" meta-rule into individual wcag-* rules
  if (ruleSet.has("wcag") || runAll) {
    for (const r of WCAG_RULES) ruleSet.add(r);
  }
  const runWcag = WCAG_RULES.some(r => ruleSet.has(r));
  const maxDepth = params?.maxDepth ?? 10;
  const maxFindings = params?.maxFindings ?? 50;

  // Get root node
  let root: BaseNode;
  if (params?.nodeId) {
    const node = await figma.getNodeByIdAsync(params.nodeId);
    if (!node) throw new Error(`Node not found: ${params.nodeId}`);
    root = node;
  } else {
    const sel = figma.currentPage.selection;
    if (sel.length === 0) throw new Error("Nothing selected and no nodeId provided");
    root = sel.length === 1 ? sel[0] : figma.currentPage;
  }

  // Collect local styles + color variables for checks
  let localPaintStyleIds = new Set<string>();
  let localTextStyleIds = new Set<string>();
  let paintStyleEntries: ColorEntry[] = [];
  let colorVarEntries: ColorEntry[] = [];
  let hasFloatVars = false;
  if (runAll || ruleSet.has("hardcoded-token") || ruleSet.has("hardcoded-radius")) {
    const floatVars = await figma.variables.getLocalVariablesAsync("FLOAT");
    hasFloatVars = floatVars.length > 0;
  }
  if (runAll || ruleSet.has("hardcoded-color")) {
    const paints = await figma.getLocalPaintStylesAsync();
    localPaintStyleIds = new Set(paints.map(s => s.id));
    for (const style of paints) {
      if (style.paints.length === 1 && style.paints[0].type === "SOLID") {
        const p = style.paints[0] as SolidPaint;
        paintStyleEntries.push({ name: style.name, id: style.id, r: p.color.r, g: p.color.g, b: p.color.b, a: p.opacity ?? 1 });
      }
    }
    const colorVars = await figma.variables.getLocalVariablesAsync("COLOR");
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const defaultModes = new Map(collections.map(c => [c.id, c.defaultModeId]));
    for (const v of colorVars) {
      const modeId = defaultModes.get(v.variableCollectionId);
      if (!modeId) continue;
      const val = v.valuesByMode[modeId];
      if (!val || typeof val !== "object" || "type" in val) continue; // skip aliases
      const c = val as { r: number; g: number; b: number; a?: number };
      colorVarEntries.push({ name: v.name, id: v.id, r: c.r, g: c.g, b: c.b, a: c.a ?? 1 });
    }
  }
  if (runAll || ruleSet.has("no-text-style")) {
    const texts = await figma.getLocalTextStylesAsync();
    localTextStyleIds = new Set(texts.map(s => s.id));
  }

  const issues: Issue[] = [];
  const ctx: LintCtx = { runAll, ruleSet, maxDepth, maxFindings, localPaintStyleIds, localTextStyleIds, hasPaintStyles: localPaintStyleIds.size > 0, hasTextStyles: localTextStyleIds.size > 0, hasColorVars: colorVarEntries.length > 0, paintStyleEntries, colorVarEntries, hasFloatVars, runWcag };

  await walkNode(root, 0, issues, ctx);

  const truncated = issues.length >= maxFindings;

  // Group by rule -> prose output
  const grouped: Record<string, Issue[]> = {};
  for (const issue of issues) {
    if (!grouped[issue.rule]) grouped[issue.rule] = [];
    grouped[issue.rule].push(issue);
  }

  const categories: any[] = [];
  for (const [rule, ruleIssues] of Object.entries(grouped)) {
    categories.push({
      rule,
      count: ruleIssues.length,
      fix: FIX_INSTRUCTIONS[rule] || "Review and fix manually.",
      nodes: ruleIssues.map(i => {
        const entry: any = { id: i.nodeId, name: i.nodeName };
        if (i.extra) Object.assign(entry, i.extra);
        return entry;
      }),
    });
  }

  const result: any = { nodeId: root.id, nodeName: root.name, categories };
  if (truncated) {
    const breakdown = categories.map(c => `${c.rule}: ${c.count}`).join(", ");
    result.warning = `Showing first ${maxFindings} findings (${breakdown}). Increase maxFindings or lint specific rules (e.g. rules: ["hardcoded-color"]) to see more.`;
  }
  return result;
}

/** Per-rule fix instructions -- natural language, actionable, referencing MCP tools */
const FIX_INSTRUCTIONS: Record<string, string> = {
  "no-autolayout": 'Use lint(method:"fix", items:[{nodeId}]) to auto-convert, or frames(method:"update", items:[{id, layout:{layoutMode:"VERTICAL"}}]).',
  "shape-instead-of-frame": 'Delete the shape with frames(method:"delete"), then frames(method:"create", type:"frame") with same position/size/fill, then frames(method:"reparent") to move overlapping siblings into the new frame.',
  "hardcoded-color": 'Check each node\'s matchName/matchId for a suggested style or variable. If a match exists: frames(method:"update", items:[{id, fill:{styleName:"..."}}]) or bind a variable via items:[{id, fill:{variableName:"..."}}] or bindings:[{field:"fills/0/color", variableName:"..."}]. If no match: create a style with styles(method:"create", type:"paint") or a variable with variables(method:"create") first, then apply it.',
  "hardcoded-token": 'Bind to a FLOAT variable instead of using hardcoded numbers. For cornerRadius: frames(method:"update", items:[{id, cornerRadius:{radius:"Radii/Medium"}}]). For padding/itemSpacing: items:[{id, layout:{paddingTop:"Spacing/Medium", itemSpacing:"Spacing/Small"}}]. For strokeWeight: items:[{id, stroke:{weight:"Border/Thick"}}]. For opacity: items:[{id, opacity:"Opacity/Subtle"}]. Pass a variable name string instead of a number. If no FLOAT variable exists, create one with variables(method:"create") first.',
  "no-text-style": 'Apply a text style: frames(method:"update", items:[{id, text:{textStyleName:"..."}}]). If no text styles exist, create one with styles(method:"create", type:"text") first.',
  "fixed-in-autolayout": 'Use frames(method:"update", items:[{id, layout:{layoutSizingHorizontal:"FILL"}}]) or "HUG" instead of FIXED. FILL stretches to fill the parent, HUG shrinks to fit content.',
  "default-name": 'Use frames(method:"update", items:[{id, name:"descriptive name"}]) to rename.',
  "empty-container": 'These frames have no children — likely leftover. Delete with frames(method:"delete", items:[{id}]) or add content.',
  "stale-text-name": 'These text node names don\'t match their content. Use frames(method:"update", items:[{id, name:"..."}]) to sync, or leave if the name is intentional.',
  "no-text-property": 'Use components(method:"update", items:[{id, propertyName:"TextLabel", action:"add", type:"TEXT", defaultValue:"..."}]) to expose the text as an editable property on the component.',
  "overlapping-children": 'Children are stacked at the same position — likely missing x/y. Either: (1) convert to auto-layout with frames(method:"update", items:[{id, layout:{layoutMode:"VERTICAL"}}]) so children flow automatically, or (2) reposition each child with frames(method:"update", items:[{id:"<childId>", x:<value>, y:<value>}]).',
  // -- WCAG fix instructions --
  "wcag-contrast": 'Adjust text color or background to meet AA contrast (4.5:1 normal text, 3:1 large text). Use frames(method:"update") with fill or text.fontColor to change colors.',
  "wcag-contrast-enhanced": 'Adjust to meet AAA contrast (7:1 normal text, 4.5:1 large text). Use frames(method:"update") with fill or text.fontColor.',
  "wcag-non-text-contrast": 'Need 3:1 contrast against parent background. Use frames(method:"update", items:[{id, fill:{color:"#..."}}]) to adjust.',
  "wcag-target-size": 'Resize to at least 24x24px: frames(method:"update", items:[{id, width:24, height:24}]) or add padding via layout.',
  "wcag-text-size": 'Increase to 12px minimum: frames(method:"update", items:[{id, text:{fontSize:12}}]).',
  "wcag-line-height": 'Increase line height to at least 1.5x font size: frames(method:"update", items:[{id, text:{lineHeight:{value:150, unit:"PERCENT"}}}]).',
};

interface ColorEntry { name: string; id: string; r: number; g: number; b: number; a: number }

interface LintCtx {
  runAll: boolean;
  ruleSet: Set<string>;
  maxDepth: number;
  maxFindings: number;
  localPaintStyleIds: Set<string>;
  localTextStyleIds: Set<string>;
  hasPaintStyles: boolean;
  hasTextStyles: boolean;
  hasColorVars: boolean;
  paintStyleEntries: ColorEntry[];
  colorVarEntries: ColorEntry[];
  hasFloatVars: boolean;
  runWcag: boolean;
}

async function walkNode(node: BaseNode, depth: number, issues: Issue[], ctx: LintCtx) {
  if (issues.length >= ctx.maxFindings) return;
  if (depth > ctx.maxDepth) return;

  // -- Rule: no-autolayout --
  if (ctx.runAll || ctx.ruleSet.has("no-autolayout")) {
    if (isFrame(node) && node.layoutMode === "NONE" && "children" in node) {
      const childCount = (node as any).children.length;
      if (childCount > 1) {
        const direction = detectLayoutDirection(node as FrameNode);
        issues.push({ rule: "no-autolayout", nodeId: node.id, nodeName: node.name, extra: { suggestedDirection: direction } });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: overlapping-children --
  if (ctx.runAll || ctx.ruleSet.has("overlapping-children")) {
    if (isFrame(node) && node.layoutMode === "NONE" && "children" in node) {
      const children = (node as any).children as SceneNode[];
      if (children.length >= 2) {
        const clusters: Map<string, SceneNode[]> = new Map();
        for (const child of children) {
          if (!("x" in child) || !("y" in child)) continue;
          const key = `${Math.round((child as any).x)},${Math.round((child as any).y)}`;
          if (!clusters.has(key)) clusters.set(key, []);
          clusters.get(key)!.push(child);
        }
        for (const [pos, group] of clusters) {
          if (group.length < 2) continue;
          const [xStr, yStr] = pos.split(",");
          issues.push({
            rule: "overlapping-children",
            nodeId: node.id,
            nodeName: node.name,
            extra: {
              position: { x: Number(xStr), y: Number(yStr) },
              count: group.length,
              childIds: group.map(c => c.id),
              childNames: group.map(c => c.name),
            },
          });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
    }
  }

  // -- Rule: shape-instead-of-frame --
  if (ctx.runAll || ctx.ruleSet.has("shape-instead-of-frame")) {
    if (isShape(node) && node.parent && "children" in node.parent) {
      const siblings = (node.parent as any).children as SceneNode[];
      const bounds = getAbsoluteBounds(node as SceneNode);
      if (bounds) {
        const overlapping = siblings.filter(s => {
          if (s.id === node.id) return false;
          const sb = getAbsoluteBounds(s);
          if (!sb) return false;
          return sb.x >= bounds.x && sb.y >= bounds.y
            && sb.x + sb.width <= bounds.x + bounds.width
            && sb.y + sb.height <= bounds.y + bounds.height;
        });
        if (overlapping.length > 0) {
          issues.push({ rule: "shape-instead-of-frame", nodeId: node.id, nodeName: node.name, extra: { overlappingIds: overlapping.map(s => s.id) } });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
    }
  }

  // -- Rule: hardcoded-color --
  if ((ctx.runAll || ctx.ruleSet.has("hardcoded-color")) && (ctx.hasPaintStyles || ctx.hasColorVars)) {
    const checkPaints = (paints: any, styleId: any, hasBoundVar: boolean, property: "fill" | "stroke") => {
      if (!paints || !Array.isArray(paints) || paints.length === 0 || paints[0].type !== "SOLID") return;
      if (hasBoundVar) return;
      if (styleId && styleId !== "" && styleId !== figma.mixed) return;
      const color = paints[0].color;
      const opacity = paints[0].opacity ?? 1;
      const hex = rgbaToHex({ r: color.r, g: color.g, b: color.b, a: opacity });
      const match = findColorMatch(color.r, color.g, color.b, opacity, ctx);
      const extra: Record<string, any> = { hex, property };
      if (match) { extra.matchType = match.type; extra.matchName = match.name; extra.matchId = match.id; }
      issues.push({ rule: "hardcoded-color", nodeId: node.id, nodeName: node.name, extra });
    };
    if ("fills" in node && "fillStyleId" in node) {
      checkPaints((node as any).fills, (node as any).fillStyleId, (node as any).boundVariables?.fills?.length > 0, "fill");
      if (issues.length >= ctx.maxFindings) return;
    }
    if ("strokes" in node && "strokeStyleId" in node) {
      checkPaints((node as any).strokes, (node as any).strokeStyleId, (node as any).boundVariables?.strokes?.length > 0, "stroke");
      if (issues.length >= ctx.maxFindings) return;
    }
  }

  // -- Rule: hardcoded-token — numeric properties that should be bound to FLOAT variables --
  if ((ctx.runAll || ctx.ruleSet.has("hardcoded-token") || ctx.ruleSet.has("hardcoded-radius")) && ctx.hasFloatVars) {
    const bv = (node as any).boundVariables || {};

    // cornerRadius
    if ("cornerRadius" in node) {
      const hasBound = bv.topLeftRadius || bv.topRightRadius || bv.bottomLeftRadius || bv.bottomRightRadius;
      if (!hasBound) {
        const cr = (node as any).cornerRadius;
        if (cr === figma.mixed) {
          const tl = (node as any).topLeftRadius ?? 0;
          const tr = (node as any).topRightRadius ?? 0;
          const br = (node as any).bottomRightRadius ?? 0;
          const bl = (node as any).bottomLeftRadius ?? 0;
          if (tl > 0 || tr > 0 || br > 0 || bl > 0) {
            issues.push({ rule: "hardcoded-token", nodeId: node.id, nodeName: node.name, extra: { property: "cornerRadius", topLeftRadius: tl, topRightRadius: tr, bottomRightRadius: br, bottomLeftRadius: bl } });
            if (issues.length >= ctx.maxFindings) return;
          }
        } else if (typeof cr === "number" && cr > 0) {
          issues.push({ rule: "hardcoded-token", nodeId: node.id, nodeName: node.name, extra: { property: "cornerRadius", value: cr } });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
    }

    // strokeWeight — only flag when node has visible strokes
    if ("strokes" in node && "strokeWeight" in node) {
      const strokes = (node as any).strokes;
      const hasStrokes = Array.isArray(strokes) && strokes.length > 0;
      if (hasStrokes) {
        const sw = (node as any).strokeWeight;
        if (typeof sw === "number" && sw > 0 && !bv.strokeTopWeight && !bv.strokeBottomWeight && !bv.strokeLeftWeight && !bv.strokeRightWeight) {
          issues.push({ rule: "hardcoded-token", nodeId: node.id, nodeName: node.name, extra: { property: "strokeWeight", value: sw } });
          if (issues.length >= ctx.maxFindings) return;
        }
      }
    }

    // opacity
    if ("opacity" in node) {
      const op = (node as any).opacity;
      if (typeof op === "number" && op < 1 && !bv.opacity) {
        issues.push({ rule: "hardcoded-token", nodeId: node.id, nodeName: node.name, extra: { property: "opacity", value: op } });
        if (issues.length >= ctx.maxFindings) return;
      }
    }

    // padding + itemSpacing (only on auto-layout frames)
    if (isFrame(node) && node.layoutMode !== "NONE") {
      for (const f of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "itemSpacing"] as const) {
        if (f in node) {
          const val = (node as any)[f];
          if (typeof val === "number" && val > 0 && !bv[f]) {
            issues.push({ rule: "hardcoded-token", nodeId: node.id, nodeName: node.name, extra: { property: f, value: val } });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
    }
  }

  // -- Rule: no-text-style --
  if ((ctx.runAll || ctx.ruleSet.has("no-text-style")) && ctx.hasTextStyles) {
    if (node.type === "TEXT") {
      const textStyleId = (node as any).textStyleId;
      const hasTextVar = (node as any).boundVariables && Object.keys((node as any).boundVariables).length > 0;
      if (!hasTextVar && (!textStyleId || textStyleId === "" || textStyleId === figma.mixed)) {
        issues.push({ rule: "no-text-style", nodeId: node.id, nodeName: node.name });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: fixed-in-autolayout --
  if (ctx.runAll || ctx.ruleSet.has("fixed-in-autolayout")) {
    if (isFrame(node) && node.layoutMode !== "NONE" && "children" in node) {
      for (const child of (node as any).children) {
        if (issues.length >= ctx.maxFindings) break;
        if (!("layoutSizingHorizontal" in child)) continue;
        if (child.layoutSizingHorizontal === "FIXED" && child.layoutSizingVertical === "FIXED") {
          issues.push({ rule: "fixed-in-autolayout", nodeId: child.id, nodeName: child.name, extra: { parentId: node.id, axis: node.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical" } });
        }
      }
      if (issues.length >= ctx.maxFindings) return;
    }
  }

  // -- Rule: default-name --
  if (ctx.runAll || ctx.ruleSet.has("default-name")) {
    const defaultNames = ["Frame", "Rectangle", "Ellipse", "Line", "Text", "Group", "Component", "Instance", "Section", "Vector"];
    const isDefault = defaultNames.some(d => node.name === d || /^.+ \d+$/.test(node.name) && node.name.startsWith(d));
    if (isDefault && node.type !== "PAGE") {
      issues.push({ rule: "default-name", nodeId: node.id, nodeName: node.name });
      if (issues.length >= ctx.maxFindings) return;
    }
  }

  // -- Rule: empty-container --
  if (ctx.runAll || ctx.ruleSet.has("empty-container")) {
    if (isFrame(node) && "children" in node && (node as any).children.length === 0) {
      issues.push({ rule: "empty-container", nodeId: node.id, nodeName: node.name });
      if (issues.length >= ctx.maxFindings) return;
    }
  }

  // -- Rule: stale-text-name --
  if (ctx.runAll || ctx.ruleSet.has("stale-text-name")) {
    if (node.type === "TEXT") {
      const chars = (node as any).characters as string;
      // Only flag if both name and characters are non-empty and they differ
      if (chars && node.name && node.name !== chars && node.name !== chars.slice(0, node.name.length)) {
        issues.push({ rule: "stale-text-name", nodeId: node.id, nodeName: node.name, extra: { characters: chars.slice(0, 60) } });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: no-text-property --
  if (ctx.runAll || ctx.ruleSet.has("no-text-property")) {
    if (node.type === "TEXT" && isInsideComponent(node)) {
      const refs = (node as any).componentPropertyReferences;
      if (!refs || !refs.characters) {
        issues.push({ rule: "no-text-property", nodeId: node.id, nodeName: node.name });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- WCAG Rules --

  // -- Rule: wcag-contrast + wcag-contrast-enhanced --
  if (ctx.runWcag && (ctx.ruleSet.has("wcag-contrast") || ctx.ruleSet.has("wcag-contrast-enhanced"))) {
    if (node.type === "TEXT") {
      const textNode = node as any;
      const fontSize = textNode.fontSize;
      const fontName = textNode.fontName;

      // Skip if fontSize or fontName is mixed (multiple styles in one text node)
      if (fontSize !== figma.mixed && fontName !== figma.mixed) {
        const fgColor = getTextFillColor(textNode);
        if (fgColor) {
          const bgColor = resolveBackgroundColor(node);
          if (bgColor !== null) {
            // Composite foreground over background accounting for opacity
            const nodeOpacity = getEffectiveOpacity(node);
            const effectiveAlpha = fgColor.a * nodeOpacity;
            const composited = alphaComposite(
              fgColor.r, fgColor.g, fgColor.b, effectiveAlpha,
              bgColor.r, bgColor.g, bgColor.b,
            );

            const fontWeight = inferFontWeight((fontName as FontName).style);
            const large = isLargeText(fontSize as number, fontWeight);
            const result = checkContrastPair(composited, bgColor, large);

            const fgHex = rgbaToHex({ ...fgColor, a: effectiveAlpha });
            const bgHex = rgbaToHex({ r: bgColor.r, g: bgColor.g, b: bgColor.b, a: 1 });

            // AA check
            if (ctx.ruleSet.has("wcag-contrast") && !result.passesAA) {
              issues.push({
                rule: "wcag-contrast",
                nodeId: node.id,
                nodeName: node.name,
                extra: {
                  ratio: result.ratio,
                  required: result.aaRequired,
                  level: "AA",
                  foreground: fgHex,
                  background: bgHex,
                  fontSize: fontSize as number,
                  fontWeight,
                  isLargeText: large,
                },
              });
              if (issues.length >= ctx.maxFindings) return;
            }

            // AAA check (only if AA passes but AAA fails)
            if (ctx.ruleSet.has("wcag-contrast-enhanced") && result.passesAA && !result.passesAAA) {
              issues.push({
                rule: "wcag-contrast-enhanced",
                nodeId: node.id,
                nodeName: node.name,
                extra: {
                  ratio: result.ratio,
                  required: result.aaaRequired,
                  level: "AAA",
                  foreground: fgHex,
                  background: bgHex,
                  fontSize: fontSize as number,
                  fontWeight,
                  isLargeText: large,
                },
              });
              if (issues.length >= ctx.maxFindings) return;
            }
          }
        }
      }
    }
  }

  // -- Rule: wcag-non-text-contrast --
  if (ctx.runWcag && ctx.ruleSet.has("wcag-non-text-contrast")) {
    // Check frames, shapes, and components with fills against their parent's fill
    if (node.type !== "TEXT" && node.type !== "PAGE" && "fills" in node) {
      const nodeFill = getNodeFillColor(node);
      if (nodeFill && node.parent) {
        const parentFill = resolveBackgroundColor(node);
        if (parentFill !== null) {
          const result = checkContrastPair(nodeFill, parentFill);
          if (result.ratio < 3.0) {
            const nodeHex = rgbaToHex({ ...nodeFill, a: 1 });
            const parentHex = rgbaToHex({ r: parentFill.r, g: parentFill.g, b: parentFill.b, a: 1 });
            issues.push({
              rule: "wcag-non-text-contrast",
              nodeId: node.id,
              nodeName: node.name,
              extra: {
                ratio: result.ratio,
                required: 3.0,
                level: "AA",
                fill: nodeHex,
                background: parentHex,
              },
            });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
    }
  }

  // -- Rule: wcag-target-size --
  if (ctx.runWcag && ctx.ruleSet.has("wcag-target-size")) {
    if (looksInteractive(node) && "width" in node && "height" in node) {
      const w = (node as any).width as number;
      const h = (node as any).height as number;
      const MIN_TARGET = 24;

      if (w < MIN_TARGET || h < MIN_TARGET) {
        issues.push({
          rule: "wcag-target-size",
          nodeId: node.id,
          nodeName: node.name,
          extra: {
            width: Math.round(w * 100) / 100,
            height: Math.round(h * 100) / 100,
            minimumRequired: MIN_TARGET,
            failingDimension: w < MIN_TARGET && h < MIN_TARGET ? "both"
              : w < MIN_TARGET ? "width" : "height",
          },
        });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: wcag-text-size --
  if (ctx.runWcag && ctx.ruleSet.has("wcag-text-size")) {
    if (node.type === "TEXT") {
      const fontSize = (node as any).fontSize;
      if (fontSize !== figma.mixed && typeof fontSize === "number" && fontSize < 12) {
        issues.push({
          rule: "wcag-text-size",
          nodeId: node.id,
          nodeName: node.name,
          extra: { fontSize, minimumRecommended: 12 },
        });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: wcag-line-height --
  if (ctx.runWcag && ctx.ruleSet.has("wcag-line-height")) {
    if (node.type === "TEXT") {
      const textNode = node as any;
      const fontSize = textNode.fontSize;
      const lineHeight = textNode.lineHeight;

      if (fontSize !== figma.mixed && lineHeight !== figma.mixed) {
        const fs = fontSize as number;
        const lh = lineHeight as { unit: string; value: number };
        let lineHeightPx: number | null = null;

        if (lh.unit === "PIXELS") {
          lineHeightPx = lh.value;
        } else if (lh.unit === "PERCENT") {
          lineHeightPx = (lh.value / 100) * fs;
        }
        // Skip "AUTO" -- platform default, flagging it would be too noisy

        if (lineHeightPx !== null) {
          const ratio = lineHeightPx / fs;
          const REQUIRED_RATIO = 1.5;

          if (ratio < REQUIRED_RATIO) {
            issues.push({
              rule: "wcag-line-height",
              nodeId: node.id,
              nodeName: node.name,
              extra: {
                lineHeightPx: Math.round(lineHeightPx * 100) / 100,
                fontSize: fs,
                ratio: Math.round(ratio * 100) / 100,
                requiredRatio: REQUIRED_RATIO,
                recommendedLineHeight: Math.ceil(fs * REQUIRED_RATIO),
              },
            });
            if (issues.length >= ctx.maxFindings) return;
          }
        }
      }
    }
  }

  // Recurse into children
  if ("children" in node) {
    for (const child of (node as any).children) {
      if (issues.length >= ctx.maxFindings) break;
      await walkNode(child, depth + 1, issues, ctx);
    }
  }
}

function findColorMatch(r: number, g: number, b: number, a: number, ctx: LintCtx): { type: "style" | "variable"; name: string; id: string } | null {
  const eps = 0.02;
  for (const e of ctx.paintStyleEntries) {
    if (Math.abs(e.r - r) < eps && Math.abs(e.g - g) < eps && Math.abs(e.b - b) < eps && Math.abs(e.a - a) < eps)
      return { type: "style", name: e.name, id: e.id };
  }
  for (const e of ctx.colorVarEntries) {
    if (Math.abs(e.r - r) < eps && Math.abs(e.g - g) < eps && Math.abs(e.b - b) < eps && Math.abs(e.a - a) < eps)
      return { type: "variable", name: e.name, id: e.id };
  }
  return null;
}

function isFrame(node: BaseNode): node is FrameNode {
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET";
}

function isInsideComponent(node: BaseNode): boolean {
  let p = node.parent;
  while (p) {
    if (p.type === "COMPONENT" || p.type === "COMPONENT_SET") return true;
    p = p.parent;
  }
  return false;
}

const SHAPE_TYPES = new Set(["RECTANGLE", "ELLIPSE", "POLYGON", "STAR", "VECTOR", "LINE"]);
function isShape(node: BaseNode): boolean {
  return SHAPE_TYPES.has(node.type);
}

function getAbsoluteBounds(node: SceneNode): { x: number; y: number; width: number; height: number } | null {
  if ("absoluteBoundingBox" in node && (node as any).absoluteBoundingBox) {
    return (node as any).absoluteBoundingBox;
  }
  if ("x" in node && "width" in node) {
    return { x: (node as any).x, y: (node as any).y, width: (node as any).width, height: (node as any).height };
  }
  return null;
}

function detectLayoutDirection(frame: FrameNode): "VERTICAL" | "HORIZONTAL" {
  const children = frame.children;
  if (children.length < 2) return "VERTICAL";
  let xVariance = 0;
  let yVariance = 0;
  for (let i = 1; i < children.length; i++) {
    xVariance += Math.abs(children[i].x - children[i - 1].x);
    yVariance += Math.abs(children[i].y - children[i - 1].y);
  }
  return yVariance >= xVariance ? "VERTICAL" : "HORIZONTAL";
}

// -- WCAG Figma Helpers --

/**
 * Get the effective foreground solid color of a text node.
 * Returns null if fills are mixed, empty, non-solid, or invisible.
 */
function getTextFillColor(node: any): SolidColor | null {
  const fills = node.fills;
  if (fills === figma.mixed) return null;
  if (!Array.isArray(fills) || fills.length === 0) return null;

  // Use the last visible SOLID fill (topmost in Figma's paint stack)
  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (fill.visible === false) continue;
    if (fill.type !== "SOLID") return null; // gradient/image -- cannot check
    return { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: fill.opacity ?? 1 };
  }
  return null;
}

/**
 * Get the first visible solid fill color from any node.
 * Used for non-text contrast checks.
 */
function getNodeFillColor(node: BaseNode): { r: number; g: number; b: number } | null {
  if (!("fills" in node)) return null;
  const fills = (node as any).fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return null;

  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (fill.visible === false) continue;
    if (fill.type !== "SOLID") return null;
    return { r: fill.color.r, g: fill.color.g, b: fill.color.b };
  }
  return null;
}

/**
 * Resolve the effective background color behind a node by walking up
 * the ancestor chain and compositing solid fills.
 * Returns null if any ancestor has a gradient/image fill (cannot compute).
 */
function resolveBackgroundColor(node: BaseNode): { r: number; g: number; b: number } | null {
  // Start with white (WCAG default assumption for unknown background)
  let bgR = 1, bgG = 1, bgB = 1;

  // Collect ancestors from parent to root, then process root-to-leaf
  const ancestors: BaseNode[] = [];
  let current = node.parent;
  while (current) {
    ancestors.push(current);
    current = current.parent;
  }
  ancestors.reverse();

  for (const ancestor of ancestors) {
    if (!("fills" in ancestor)) continue;
    const fills = (ancestor as any).fills;
    if (fills === figma.mixed || !Array.isArray(fills)) continue;

    for (const fill of fills) {
      if (fill.visible === false) continue;

      if (fill.type === "SOLID") {
        const fillOpacity = fill.opacity ?? 1;
        const nodeOpacity = ("opacity" in ancestor) ? ((ancestor as any).opacity ?? 1) : 1;
        const effectiveAlpha = fillOpacity * nodeOpacity;

        if (effectiveAlpha >= 0.999) {
          bgR = fill.color.r;
          bgG = fill.color.g;
          bgB = fill.color.b;
        } else {
          const c = alphaComposite(fill.color.r, fill.color.g, fill.color.b, effectiveAlpha, bgR, bgG, bgB);
          bgR = c.r;
          bgG = c.g;
          bgB = c.b;
        }
      } else if (fill.type !== "SOLID") {
        // Gradient, image, video -- cannot compute contrast reliably
        return null;
      }
    }
  }

  return { r: bgR, g: bgG, b: bgB };
}

/**
 * Walk from a node up to root, multiplying opacity at each level.
 * Figma's opacity is per-node and compounds visually.
 */
function getEffectiveOpacity(node: BaseNode): number {
  let opacity = 1;
  let current: BaseNode | null = node;
  while (current) {
    if ("opacity" in current) {
      opacity *= (current as any).opacity ?? 1;
    }
    current = current.parent;
  }
  return opacity;
}

// -- Auto-fix handlers --

async function fixAutolayoutSingle(p: any) {
  const node = await figma.getNodeByIdAsync(p.nodeId);
  if (!node) throw new Error(`Node not found: ${p.nodeId}`);
  if (!isFrame(node)) throw new Error(`Node ${p.nodeId} is ${node.type}, not a FRAME`);
  if (node.layoutMode !== "NONE") return { skipped: true, reason: "Already has auto-layout" };

  const direction = p.layoutMode || detectLayoutDirection(node);
  node.layoutMode = direction;
  if (p.itemSpacing !== undefined) {
    node.itemSpacing = p.itemSpacing;
  }
  return { layoutMode: direction };
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  lint_node: lintNodeHandler,
  lint_fix_autolayout: (p) => batchHandler(p, fixAutolayoutSingle),
};
