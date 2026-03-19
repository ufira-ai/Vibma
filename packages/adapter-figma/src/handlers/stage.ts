/**
 * Stage container and commit logic for the two-path authoring model.
 *
 * Stage containers live on the same page as the target, mimicking the target's
 * layout constraints with FIXED dimensions. Commit unwraps into the original target.
 */

import { serializeNode, DEFAULT_NODE_BUDGET } from "../utils/serialize-node";
import type { Hint } from "./helpers";

// ─── Stage Container ────────────────────────────────────────────

/**
 * Create a stage container that mimics the target parent's constraints.
 * Returns the stage frame. Caller creates the tree inside it.
 */
export async function createStageContainer(
  p: any,
  name: string,
): Promise<FrameNode> {
  const stage = figma.createFrame();
  stage.name = `[STAGED] ${name}`;
  stage.fills = [];

  // Resolve target parent
  const targetParent = p.parentId
    ? await figma.getNodeByIdAsync(p.parentId)
    : figma.currentPage;

  // Capture stage metadata for commit
  const meta: any = {
    targetParentId: p.parentId || null,
    targetX: p.x ?? 0,
    targetY: p.y ?? 0,
  };

  // Position stage near the target location
  stage.x = (p.x ?? 0) + 50;
  stage.y = (p.y ?? 0) + 50;

  // Mimic target parent constraints with FIXED dimensions
  if (targetParent && "layoutMode" in targetParent && (targetParent as any).layoutMode !== "NONE") {
    const tp = targetParent as FrameNode;
    // Resolve pixel dimensions (FILL → current size, HUG → current size)
    stage.resize(tp.width, tp.height);
    meta.targetLayoutMode = tp.layoutMode;
    meta.targetWidth = tp.width;
    meta.targetHeight = tp.height;
  } else if (p.width && p.height) {
    stage.resize(p.width, p.height);
  } else {
    // Page-level or no constraints — use reasonable default
    stage.resize(p.width || 400, p.height || 400);
  }

  // Store metadata on the stage frame for commit to read
  stage.setPluginData("_stageMetadata", JSON.stringify(meta));

  // Append to same parent as target (or page)
  if (targetParent && "appendChild" in targetParent && targetParent.type !== "PAGE") {
    (targetParent as any).appendChild(stage);
  }

  return stage;
}

// ─── Commit ─────────────────────────────────────────────────────

/**
 * Commit a staged node: unwrap from stage container into the original target.
 * Returns the committed node ID.
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
    // The first child is the actual content
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

  // Reparent content to original target
  const targetParent = meta.targetParentId
    ? await figma.getNodeByIdAsync(meta.targetParentId)
    : figma.currentPage;

  if (!targetParent) throw new Error(`Original target parent not found: ${meta.targetParentId}`);

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

  hints.push({ type: "confirm", message: `Committed staged node to ${meta.targetParentId ? `parent ${meta.targetParentId}` : "page"}.` });

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
