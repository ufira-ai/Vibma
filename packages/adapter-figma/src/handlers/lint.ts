import { batchHandler, isSmallIntrinsic } from "./helpers";
import { auditComponentBindings } from "./components";
import { rgbaToHex } from "@ufira/vibma/utils/color";
import {
  alphaComposite, checkContrastPair, isLargeText, inferFontWeight,
  looksInteractive, type SolidColor,
} from "@ufira/vibma/utils/wcag";

// ─── Figma Handlers ──────────────────────────────────────────────

type Severity = "error" | "unsafe" | "heuristic" | "style";
type RuleCategory = "component" | "composition" | "token" | "accessibility" | "naming";

const WCAG_RULES = [
  "wcag-contrast", "wcag-contrast-enhanced", "wcag-non-text-contrast",
  "wcag-target-size", "wcag-text-size", "wcag-line-height",
] as const;

/** Category meta-rules: expand "component" → component rules, etc. */
const CATEGORY_RULES: Record<string, readonly string[]> = {
  component: ["no-text-property", "component-bindings"],
  composition: ["no-autolayout", "overlapping-children", "shape-instead-of-frame", "fixed-in-autolayout", "overflow-parent", "unbounded-hug", "hug-cross-axis", "empty-container"],
  token: ["hardcoded-color", "hardcoded-token", "no-text-style"],
  naming: ["default-name", "stale-text-name"],
};

/** Per-rule metadata: severity, category, and short fix guideline. */
const RULE_META: Record<string, { severity: Severity; category: RuleCategory; fix: string }> = {
  "no-autolayout":        { severity: "heuristic", category: "composition", fix: "Convert to auto-layout. Use lint.fix or set layoutMode." },
  "shape-instead-of-frame": { severity: "style", category: "composition", fix: "Replace shape with a frame — shapes can't have children." },
  "hardcoded-color":      { severity: "heuristic", category: "token", fix: "Bind to a color variable or paint style. guidelines(topic:\"token-discipline\") for details." },
  "hardcoded-token":      { severity: "heuristic", category: "token", fix: "Bind to a FLOAT variable. guidelines(topic:\"token-discipline\") for details." },
  "no-text-style":        { severity: "heuristic", category: "token", fix: "Apply a text style via textStyleName. guidelines(topic:\"token-discipline\") for details." },
  "fixed-in-autolayout":  { severity: "heuristic", category: "composition", fix: "Use FILL or HUG instead of FIXED inside auto-layout." },
  "overflow-parent":      { severity: "unsafe", category: "composition", fix: "Child exceeds parent's available inner space. Fix: use layoutSizingHorizontal/Vertical:'FILL' on children, reduce the fixed dimension, or set overflowDirection on the parent for scrollable overflow." },
  "default-name":         { severity: "style", category: "naming", fix: "Rename to something descriptive." },
  "empty-container":      { severity: "style", category: "composition", fix: "Delete if leftover, or add content." },
  "stale-text-name":      { severity: "style", category: "naming", fix: "Sync layer name with text content, or leave if intentional." },
  "no-text-property":     { severity: "heuristic", category: "component", fix: "Expose as a TEXT component property. guidelines(topic:\"component-structure\") for details." },
  "component-bindings":   { severity: "heuristic", category: "component", fix: "Bind text nodes to properties or delete orphaned ones. guidelines(topic:\"component-structure\") for details." },
  "overlapping-children": { severity: "heuristic", category: "composition", fix: "Set distinct x/y or convert parent to auto-layout." },
  "hug-cross-axis":       { severity: "heuristic", category: "composition", fix: "Set cross-axis sizing to FILL so content fills available space." },
  "unbounded-hug":        { severity: "unsafe", category: "composition", fix: "Set a width + layoutSizingHorizontal:FIXED, or FILL if inside auto-layout. guidelines(topic:\"responsive-designs\") for details." },
  "wcag-contrast":        { severity: "verbose", category: "accessibility", fix: "Adjust text or background color to meet 4.5:1 (AA)." },
  "wcag-contrast-enhanced": { severity: "verbose", category: "accessibility", fix: "Adjust to meet 7:1 (AAA)." },
  "wcag-non-text-contrast": { severity: "verbose", category: "accessibility", fix: "Adjust fill or background to meet 3:1 contrast." },
  "wcag-target-size":     { severity: "verbose", category: "accessibility", fix: "Resize to at least 24x24px." },
  "wcag-text-size":       { severity: "verbose", category: "accessibility", fix: "Increase to 12px minimum." },
  "wcag-line-height":     { severity: "verbose", category: "accessibility", fix: "Increase line height to 1.5x font size." },
};

/** Collected issue: rule + nodeId + optional severity override for context-aware ranking. */
interface Issue {
  rule: string;
  nodeId: string;
  nodeName: string;
  /** Override the default rule severity based on context (leaf vs container, etc.) */
  severity?: Severity;
  /** Extra context for the prose generator */
  extra?: Record<string, any>;
}

async function lintNodeHandler(params: any) {
  const ruleSet = new Set<string>(params?.rules || ["all"]);
  const runAll = ruleSet.has("all");
  // Expand meta-rules into individual rules
  if (ruleSet.has("wcag") || ruleSet.has("accessibility") || runAll) {
    for (const r of WCAG_RULES) ruleSet.add(r);
  }
  for (const [cat, catRules] of Object.entries(CATEGORY_RULES)) {
    if (ruleSet.has(cat) || runAll) {
      for (const r of catRules) ruleSet.add(r);
    }
  }
  const runWcag = WCAG_RULES.some(r => ruleSet.has(r));
  const maxDepth = params?.maxDepth ?? 10;
  const maxFindings = params?.maxFindings ?? 50;
  const minSeverity = params?.minSeverity as string | undefined;
  const skipInstances = params?.skipInstances ?? true;

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
  const ctx: LintCtx = { runAll, ruleSet, maxDepth, maxFindings, localPaintStyleIds, localTextStyleIds, hasPaintStyles: localPaintStyleIds.size > 0, hasTextStyles: localTextStyleIds.size > 0, hasColorVars: colorVarEntries.length > 0, paintStyleEntries, colorVarEntries, hasFloatVars, runWcag, skipInstances };

  await walkNode(root, 0, issues, ctx);

  const truncated = issues.length >= maxFindings;

  // Group by rule -> prose output
  const grouped: Record<string, Issue[]> = {};
  for (const issue of issues) {
    if (!grouped[issue.rule]) grouped[issue.rule] = [];
    grouped[issue.rule].push(issue);
  }

  // Filter by minSeverity: drop rules below the threshold
  const SEV_ORDER: Record<string, number> = { error: 0, unsafe: 1, heuristic: 2, style: 3, verbose: 4 };
  const minSevLevel = minSeverity ? (SEV_ORDER[minSeverity] ?? 2) : 3; // default: up to style (excludes verbose)

  const categories: any[] = [];
  for (const [rule, ruleIssues] of Object.entries(grouped)) {
    const meta = RULE_META[rule];
    const sev = meta?.severity || "heuristic";
    if ((SEV_ORDER[sev] ?? 2) > minSevLevel) continue; // below threshold
    categories.push({
      rule,
      severity: sev,
      category: meta?.category || "composition",
      count: ruleIssues.length,
      fix: meta?.fix || "Review and fix manually.",
      nodes: ruleIssues.map(i => {
        const entry: any = { id: i.nodeId, name: i.nodeName };
        if (i.severity) entry.severity = i.severity; // per-finding override
        if (i.extra) Object.assign(entry, i.extra);
        return entry;
      }),
    });
  }
  categories.sort((a, b) => (SEV_ORDER[a.severity] ?? 2) - (SEV_ORDER[b.severity] ?? 2));

  const result: any = { nodeId: root.id, nodeName: root.name, categories };
  if (truncated) {
    const breakdown = categories.map(c => `${c.rule}: ${c.count}`).join(", ");
    result.warning = `Showing first ${maxFindings} findings (${breakdown}). Increase maxFindings or lint specific rules (e.g. rules: ["hardcoded-color"]) to see more.`;
  }
  return result;
}


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
  skipInstances: boolean;
}

async function walkNode(node: BaseNode, depth: number, issues: Issue[], ctx: LintCtx) {
  if (issues.length >= ctx.maxFindings) return;
  if (depth > ctx.maxDepth) return;

  // -- Rule: no-autolayout --
  if (ctx.runAll || ctx.ruleSet.has("no-autolayout")) {
    if (isFrame(node) && node.layoutMode === "NONE" && "children" in node) {
      const children = (node as any).children as SceneNode[];
      const childCount = children.length;
      if (childCount > 1) {
        const direction = detectLayoutDirection(node as FrameNode);
        // Small containers with only leaf children (labels, icons) → style, not heuristic
        const allLeaves = children.every(c => isLeaf(c));
        const severity: Severity | undefined = allLeaves && childCount <= 3 ? "style" : undefined;
        issues.push({ rule: "no-autolayout", nodeId: node.id, nodeName: node.name, severity, extra: { suggestedDirection: direction } });
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

  // -- Rule: unbounded-hug --
  if (ctx.runAll || ctx.ruleSet.has("unbounded-hug")) {
    if (isFrame(node) && node.layoutMode !== "NONE" &&
        node.layoutSizingHorizontal === "HUG" && node.layoutSizingVertical === "HUG") {
      const isRoot = !node.parent || node.parent.type === "PAGE";
      const children = "children" in node ? (node as FrameNode).children : [];
      const hasTextChildren = children.some(c => c.type === "TEXT");
      const hasFillChildren = children.some(c => "layoutSizingHorizontal" in c && (c as any).layoutSizingHorizontal === "FILL");
      const hasLongText = children.some(c => c.type === "TEXT" && ((c as any).characters?.length ?? 0) > 20);

      if (isRoot && (hasLongText || hasFillChildren) && !isSmallIntrinsic(node)) {
        // Root container with text/FILL children — no width constraint
        issues.push({ rule: "unbounded-hug", nodeId: node.id, nodeName: node.name, extra: { context: "root", hasText: hasTextChildren, hasFillChildren } });
        if (issues.length >= ctx.maxFindings) return;
      }
      // Nested HUG/HUG: skip — either fine (button in variant set) or cascades to root finding
    }
    // Text nodes inside auto-layout: HUG on both axes means text won't wrap
    if (node.type === "TEXT" && node.parent && "layoutMode" in node.parent && (node.parent as any).layoutMode !== "NONE") {
      const th = (node as any).layoutSizingHorizontal;
      const tv = (node as any).layoutSizingVertical;
      if (th === "HUG" && tv === "HUG") {
        const isShortLabel = ((node as any).characters?.length ?? 0) < 40;
        issues.push({ rule: "unbounded-hug", nodeId: node.id, nodeName: node.name, severity: isShortLabel ? "style" : undefined, extra: { nodeType: "TEXT" } });
        if (issues.length >= ctx.maxFindings) return;
      }
    }
  }

  // -- Rule: hug-cross-axis --
  // Child has HUG on the cross-axis of a constrained parent — won't fill available space
  if (ctx.runAll || ctx.ruleSet.has("hug-cross-axis")) {
    if (node.parent && "layoutMode" in node.parent && "layoutSizingHorizontal" in node) {
      const parent = node.parent as any;
      if (parent.layoutMode !== "NONE") {
        const isHorizontal = parent.layoutMode === "HORIZONTAL";
        // Cross-axis: vertical layout → check horizontal sizing; horizontal layout → check vertical sizing
        const parentCross = isHorizontal ? parent.layoutSizingVertical : parent.layoutSizingHorizontal;
        const childCross = isHorizontal ? (node as any).layoutSizingVertical : (node as any).layoutSizingHorizontal;
        if ((parentCross === "FIXED" || parentCross === "FILL") && childCross === "HUG") {
          const crossAxis = isHorizontal ? "vertical" : "horizontal";
          // Leaf text/shapes with HUG on cross-axis are often intentional (small labels, icons)
          const leafSeverity: Severity | undefined = isLeaf(node) ? "style" : undefined;
          issues.push({
            rule: "hug-cross-axis",
            nodeId: node.id,
            nodeName: node.name,
            severity: leafSeverity,
            extra: { crossAxis, parentSizing: parentCross, parentId: parent.id, parentName: parent.name },
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
      // HUG-HUG parents are intrinsically-sized (badges, pills, chips) — FIXED children are expected
      const parentHugs = node.layoutSizingHorizontal === "HUG" && node.layoutSizingVertical === "HUG";
      if (!parentHugs) {
        for (const child of (node as any).children) {
          if (issues.length >= ctx.maxFindings) break;
          if (!("layoutSizingHorizontal" in child)) continue;
          // ABSOLUTE children are intentionally FIXED (taken out of flow)
          if ((child as any).layoutPositioning === "ABSOLUTE") continue;
          if (child.layoutSizingHorizontal === "FIXED" && child.layoutSizingVertical === "FIXED") {
            // Childless frames are decorative elements (dots, dividers, icons) — skip
            if ("children" in child && (child as any).children.length === 0) continue;
            issues.push({ rule: "fixed-in-autolayout", nodeId: child.id, nodeName: child.name, extra: { parentId: node.id, parentName: node.name, axis: node.layoutMode === "HORIZONTAL" ? "horizontal" : "vertical" } });
          }
        }
      }
      if (issues.length >= ctx.maxFindings) return;
    }
  }

  // -- Rule: overflow-parent --
  // Skip scrollable containers (intentional overflow) and instance internals (owned by component author).
  if (ctx.runAll || ctx.ruleSet.has("overflow-parent")) {
    const overflow = (node as any).overflowDirection;
    const isInstanceInternal = ctx.skipInstances && node.type === "INSTANCE";
    if (isFrame(node) && node.layoutMode !== "NONE" && "children" in node && (!overflow || overflow === "NONE") && !isInstanceInternal) {
      const pW = node.width;
      const pH = node.height;
      const padL = (node as any).paddingLeft || 0;
      const padR = (node as any).paddingRight || 0;
      const padT = (node as any).paddingTop || 0;
      const padB = (node as any).paddingBottom || 0;
      const innerW = pW - padL - padR;
      const innerH = pH - padT - padB;
      const isH = node.layoutMode === "HORIZONTAL";

      const children = (node as any).children as any[];
      const spacing = (node as any).itemSpacing || 0;

      // Per-child: check cross-axis overflow using actual bounding dimensions.
      // All sizing modes checked — FILL children have computed dimensions too
      // (e.g. minWidth can push them beyond parent).
      for (const child of children) {
        if (issues.length >= ctx.maxFindings) break;
        if (!("width" in child) || !("height" in child)) continue;

        const crossDim = isH ? child.height : child.width;
        const crossInner = isH ? innerH : innerW;
        if (crossDim > crossInner && crossInner > 0) {
          const axis = isH ? "height" : "width";
          const childSizing = isH ? child.layoutSizingVertical : child.layoutSizingHorizontal;
          const sizingProp = isH ? "layoutSizingVertical" : "layoutSizingHorizontal";
          const minProp = isH ? "minHeight" : "minWidth";
          const childMin = (child as any)[minProp];

          // Context-aware fix based on child sizing mode
          let fix: string;
          if (childSizing === "FIXED") {
            fix = `Reduce ${child.name} ${axis} from ${Math.round(crossDim)} to ≤${Math.round(crossInner)}, or use ${sizingProp}:"FILL" to fit parent.`;
          } else if (childSizing === "FILL" && childMin && childMin > crossInner) {
            fix = `${minProp} ${childMin} on ${child.name} exceeds available ${Math.round(crossInner)}. Reduce ${minProp} or increase parent.`;
          } else if (childSizing === "HUG") {
            fix = `${child.name} content requires ${Math.round(crossDim)} but only ${Math.round(crossInner)} available. Use ${sizingProp}:"FILL" to constrain to parent.`;
          } else {
            fix = `Use ${sizingProp}:"FILL" to fit parent.`;
          }

          issues.push({
            rule: "overflow-parent",
            nodeId: child.id,
            nodeName: child.name,
            extra: {
              message: `${child.name} ${axis} ${Math.round(crossDim)} overflows ${node.name} (inner ${axis} ${Math.round(crossInner)}). ${fix}`,
              parentId: node.id,
              parentName: node.name,
            },
          });
        }
      }

      // Primary-axis cumulative: sum non-FILL children's actual dimensions + spacing vs inner space.
      // FILL children are elastic (they compress), but FIXED and HUG children take concrete space.
      if (issues.length < ctx.maxFindings) {
        const primaryInner = isH ? innerW : innerH;
        const concreteChildren = children.filter((c: any) =>
          "width" in c && (isH ? c.layoutSizingHorizontal : c.layoutSizingVertical) !== "FILL"
        );
        if (concreteChildren.length > 0 && primaryInner > 0) {
          const totalConcrete = concreteChildren.reduce((sum: number, c: any) => sum + (isH ? c.width : c.height), 0);
          const totalSpacing = (children.length - 1) * spacing;
          const totalUsed = totalConcrete + totalSpacing;
          if (totalUsed > primaryInner) {
            const axis = isH ? "width" : "height";
            const scrollDir = isH ? "HORIZONTAL" : "VERTICAL";
            const parentSizing = isH ? node.layoutSizingHorizontal : node.layoutSizingVertical;
            const childDescs = concreteChildren.map((c: any) => `${c.name} (${Math.round(isH ? c.width : c.height)})`).join(", ");

            // Context-aware fix based on parent sizing mode
            let fix: string;
            if (parentSizing === "FILL") {
              fix = `Parent is FILL-sized (${Math.round(primaryInner)} from its parent). Set overflowDirection:"${scrollDir}" for scrollable content, or increase the ancestor that constrains this container.`;
            } else if (parentSizing === "FIXED") {
              fix = `Increase ${node.name} ${axis} beyond ${Math.round(primaryInner)}, or set overflowDirection:"${scrollDir}" for scrollable content.`;
            } else {
              // HUG — shouldn't normally overflow, but can with maxWidth/maxHeight
              const maxProp = isH ? "maxWidth" : "maxHeight";
              const maxVal = (node as any)[maxProp];
              if (maxVal) {
                fix = `${maxProp} ${maxVal} constrains ${node.name} below content size. Increase ${maxProp} or set overflowDirection:"${scrollDir}" for scrollable content.`;
              } else {
                fix = `Set overflowDirection:"${scrollDir}" for scrollable content.`;
              }
            }

            issues.push({
              rule: "overflow-parent",
              nodeId: node.id,
              nodeName: node.name,
              extra: {
                message: `Children overflow ${node.name} on ${axis}: ${childDescs} + spacing ${Math.round(totalSpacing)} = ${Math.round(totalUsed)} vs ${Math.round(primaryInner)} available. ${fix}`,
              },
            });
          }
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
  // Skip frames with image or gradient fills — they have visual content even without children.
  // Skip SLOT nodes — empty slots are intentional placeholders for instance content.
  if (ctx.runAll || ctx.ruleSet.has("empty-container")) {
    if (isFrame(node) && node.type !== "SLOT" && "children" in node && (node as any).children.length === 0) {
      const fills: any[] = (node as any).fills || [];
      const hasVisualFill = fills.some((f: any) => f.type === "IMAGE" || f.type === "GRADIENT_LINEAR" || f.type === "GRADIENT_RADIAL" || f.type === "GRADIENT_ANGULAR" || f.type === "GRADIENT_DIAMOND");
      if (!hasVisualFill) {
        issues.push({ rule: "empty-container", nodeId: node.id, nodeName: node.name });
        if (issues.length >= ctx.maxFindings) return;
      }
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

  // -- Rule: component-bindings --
  if (ctx.runAll || ctx.ruleSet.has("component-bindings")) {
    if (node.type === "COMPONENT" || node.type === "COMPONENT_SET") {
      const audit = auditComponentBindings(node as any);
      for (const t of audit.unboundText) {
        issues.push({ rule: "component-bindings", nodeId: t.id, nodeName: t.name, extra: { issue: "unbound-text", characters: t.characters } });
        if (issues.length >= ctx.maxFindings) return;
      }
      for (const p of audit.orphanedProperties) {
        issues.push({ rule: "component-bindings", nodeId: node.id, nodeName: node.name, severity: "unsafe", extra: { issue: "orphaned-property", propertyKey: p.key, propertyName: p.name } });
        if (issues.length >= ctx.maxFindings) return;
      }
      for (const n of audit.unboundNested) {
        issues.push({ rule: "component-bindings", nodeId: n.id, nodeName: n.name, severity: "style", extra: { issue: "unexposed-nested", path: n.path, characters: n.characters } });
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

            // Use variable names when bound, hex when hardcoded
            const fgVar = await getFillTokenName(node);
            const bgVar = await getBackgroundTokenName(node);
            const fgHex = rgbaToHex({ ...fgColor, a: effectiveAlpha });
            const bgHex = rgbaToHex({ r: bgColor.r, g: bgColor.g, b: bgColor.b, a: 1 });
            const foreground = fgVar || fgHex;
            const background = bgVar || bgHex;

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
                  foreground,
                  background,
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
                  foreground,
                  background,
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
            const fillVar = await getFillTokenName(node);
            const bgVar = await getBackgroundTokenName(node);
            const nodeHex = rgbaToHex({ ...nodeFill, a: 1 });
            const parentHex = rgbaToHex({ r: parentFill.r, g: parentFill.g, b: parentFill.b, a: 1 });
            // Both token-bound: downgrade to style (intentional surface hierarchy)
            const bothBound = !!(fillVar && bgVar);
            issues.push({
              rule: "wcag-non-text-contrast",
              nodeId: node.id,
              nodeName: node.name,
              severity: bothBound ? "style" : undefined,
              extra: {
                ratio: result.ratio,
                required: 3.0,
                level: "AA",
                fill: fillVar || nodeHex,
                background: bgVar || parentHex,
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

  // Recurse into children.
  // Instance nodes are visited (rules like overflow-parent check their children),
  // but we don't recurse INTO instance internals — those are owned by the component.
  if ("children" in node) {
    if (ctx.skipInstances && node.type === "INSTANCE") return;
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
  return node.type === "FRAME" || node.type === "COMPONENT" || node.type === "COMPONENT_SET" || node.type === "INSTANCE" || node.type === "SLOT";
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

/** Leaf node: text, shape, or empty frame — not a structural container. */
function isLeaf(node: BaseNode): boolean {
  if (node.type === "TEXT") return true;
  if (SHAPE_TYPES.has(node.type)) return true;
  if ("children" in node && (node as any).children.length === 0) return true;
  return false;
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
/**
 * Get the token name for a node's fill — variable name, paint style name, or null.
 * Checks boundVariables.fills first, then fillStyleId.
 */
async function getFillTokenName(node: BaseNode): Promise<string | null> {
  // Check variable binding first
  const bv = (node as any).boundVariables;
  if (bv?.fills) {
    const fills = Array.isArray(bv.fills) ? bv.fills : [bv.fills];
    for (const f of fills) {
      if (f?.id) {
        try {
          const v = await figma.variables.getVariableByIdAsync(f.id);
          if (v) return v.name;
        } catch {}
      }
    }
  }
  // Check paint style
  const styleId = (node as any).fillStyleId;
  if (styleId && styleId !== "" && styleId !== figma.mixed) {
    try {
      const style = await figma.getStyleByIdAsync(styleId);
      if (style) return style.name;
    } catch {}
  }
  return null;
}

/**
 * Walk ancestors to find the nearest fill token name for background.
 * Returns the variable/style name if the background comes from a token, or null.
 */
async function getBackgroundTokenName(node: BaseNode): Promise<string | null> {
  let current = node.parent;
  while (current) {
    if ("fills" in current) {
      const fills = (current as any).fills;
      if (fills !== figma.mixed && Array.isArray(fills) && fills.length > 0) {
        const hasFill = fills.some((f: any) => f.visible !== false && f.type === "SOLID");
        if (hasFill) return getFillTokenName(current);
      }
    }
    current = current.parent;
  }
  return null;
}

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

/** Run lint on a node — used by frames.audit and as base for component audit. */
export { lintNodeHandler as auditNode };

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  lint_node: lintNodeHandler,
  lint_fix_autolayout: (p) => batchHandler(p, fixAutolayoutSingle),
};
