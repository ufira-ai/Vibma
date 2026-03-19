/**
 * Stage container and commit logic for the two-path authoring model.
 *
 * Stage containers are sibling frames on the same page (never inside the target parent).
 * They mimic the target parent's auto-layout constraints so sizing resolves correctly.
 * Commit unwraps into the original target and removes the stage container.
 */

import type { Hint } from "./helpers";

// ─── Stage Container ────────────────────────────────────────────

/**
 * Create a stage container that mimics the target parent's constraints.
 * Placed as a sibling on the same page — never inside the target parent.
 *
 * The stage container replicates the target parent's layoutMode, sizing,
 * and dimensions so that children built inside it experience the same
 * sizing context (FILL, HUG, etc.) as they would in the real target.
 */
export async function createStageContainer(
  p: any,
  name: string,
): Promise<FrameNode> {
  const stage = figma.createFrame();
  stage.name = `[STAGED] ${name}`;
  stage.fills = [];

  // Capture commit metadata: where this node should land on commit
  const meta: any = {
    targetParentId: p.parentId || null,
    targetPageId: figma.currentPage.id,   // remember the page for page-root stages
    targetX: p.x ?? 0,
    targetY: p.y ?? 0,
  };

  // Resolve target parent to read its constraints
  const targetParent = p.parentId
    ? await figma.getNodeByIdAsync(p.parentId)
    : null;

  // Mimic target parent's auto-layout constraints on the stage container
  // so children experience the same sizing context (FILL resolves correctly, etc.)
  if (targetParent && "layoutMode" in targetParent && (targetParent as any).layoutMode !== "NONE") {
    const tp = targetParent as FrameNode;
    stage.layoutMode = tp.layoutMode;
    // Use FIXED dimensions resolved to current pixel size
    // (if parent was FILL/HUG, resolve to its current rendered dimensions)
    stage.resize(tp.width, tp.height);
    stage.layoutSizingHorizontal = "FIXED";
    stage.layoutSizingVertical = "FIXED";
    // Copy spacing/padding so child layout matches
    if (tp.itemSpacing) stage.itemSpacing = tp.itemSpacing;
    if (tp.paddingTop) stage.paddingTop = tp.paddingTop;
    if (tp.paddingRight) stage.paddingRight = tp.paddingRight;
    if (tp.paddingBottom) stage.paddingBottom = tp.paddingBottom;
    if (tp.paddingLeft) stage.paddingLeft = tp.paddingLeft;
    if (tp.primaryAxisAlignItems) stage.primaryAxisAlignItems = tp.primaryAxisAlignItems;
    if (tp.counterAxisAlignItems) stage.counterAxisAlignItems = tp.counterAxisAlignItems;
  } else if (p.width && p.height) {
    stage.resize(p.width, p.height);
  } else {
    stage.resize(p.width || 400, p.height || 400);
  }

  // Position stage offset from target location (visible but distinct)
  stage.x = (p.x ?? 0) + 50;
  stage.y = (p.y ?? 0) + 50;

  // Store metadata for commit
  stage.setPluginData("_stageMetadata", JSON.stringify(meta));

  // Always place on the current page as a top-level sibling — never inside the target parent.
  // This prevents the stage from affecting the target parent's layout.
  figma.currentPage.appendChild(stage);

  return stage;
}

// ─── Commit ─────────────────────────────────────────────────────

/**
 * Commit a staged node: unwrap from stage container into the original target.
 * Locked to the original parentId and page captured at stage time.
 */
export async function commitStaged(stagedId: string): Promise<{ id: string; hints: Hint[] }> {
  const hints: Hint[] = [];
  const node = await figma.getNodeByIdAsync(stagedId);
  if (!node) throw new Error(`Staged node not found: ${stagedId}`);

  // Find the stage container (could be the node itself or its parent)
  let stageContainer: FrameNode | null = null;
  let contentNode: SceneNode = node as SceneNode;

  if (node.type === "FRAME" && node.name.startsWith("[STAGED]")) {
    stageContainer = node as FrameNode;
    if ("children" in stageContainer && stageContainer.children.length > 0) {
      contentNode = stageContainer.children[0];
    }
  } else if (node.parent?.type === "FRAME" && node.parent.name.startsWith("[STAGED]")) {
    stageContainer = node.parent as FrameNode;
    contentNode = node as SceneNode;
  }

  if (!stageContainer) {
    throw new Error(`Node ${stagedId} is not in a stage container. Only [STAGED] nodes can be committed.`);
  }

  // Read commit metadata
  const metaStr = stageContainer.getPluginData("_stageMetadata");
  if (!metaStr) throw new Error("Stage container missing metadata — cannot determine commit target.");
  const meta = JSON.parse(metaStr);

  // Resolve target: use stored parentId, or fall back to the stored page (not current page)
  let targetParent: BaseNode | null;
  if (meta.targetParentId) {
    targetParent = await figma.getNodeByIdAsync(meta.targetParentId);
    if (!targetParent) throw new Error(`Original target parent not found: ${meta.targetParentId}`);
  } else {
    // Page-root: use the page that was current at stage time
    targetParent = await figma.getNodeByIdAsync(meta.targetPageId);
    if (!targetParent) {
      // Fallback: page may have been deleted — use current page
      targetParent = figma.currentPage;
    }
    // Load the target page if it's not the current one
    if (targetParent.type === "PAGE" && targetParent.id !== figma.currentPage.id) {
      await (targetParent as PageNode).loadAsync();
    }
  }

  if ("appendChild" in targetParent) {
    (targetParent as any).appendChild(contentNode);
  }

  // Set position
  if ("x" in contentNode) {
    (contentNode as any).x = meta.targetX ?? 0;
    (contentNode as any).y = meta.targetY ?? 0;
  }

  // Clean up stage container
  stageContainer.remove();

  const targetDesc = meta.targetParentId ? `parent ${meta.targetParentId}` : "page";
  hints.push({ type: "confirm", message: `Committed staged node to ${targetDesc}.` });

  return { id: contentNode.id, hints };
}

// ─── Figma Handlers ─────────────────────────────────────────────

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  commit: async (params: any) => {
    const id = params.id;
    if (!id) throw new Error("Missing id — provide the staged node ID to commit.");
    const { id: committedId, hints } = await commitStaged(id);
    const result: any = { id: committedId, status: "created" };
    if (hints.length > 0) result.hints = hints;
    return { results: [result] };
  },
};
