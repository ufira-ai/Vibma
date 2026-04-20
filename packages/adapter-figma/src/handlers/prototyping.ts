import { batchHandler } from "./helpers";

// ─── Prototype Reactions & Navigation ────────────────────────────

const DIRECTIONAL_TRANSITIONS = new Set(["MOVE_IN", "MOVE_OUT", "PUSH", "SLIDE_IN", "SLIDE_OUT"]);

function buildTrigger(type: string, p: any): any {
  switch (type) {
    case "ON_CLICK":
    case "ON_HOVER":
    case "ON_PRESS":
    case "ON_DRAG":
      return { type };
    case "AFTER_TIMEOUT":
      return { type, timeout: (p.triggerDelay ?? 800) / 1000 };
    case "MOUSE_ENTER":
    case "MOUSE_LEAVE":
      return { type, delay: p.triggerDelay ?? 0 };
    case "MOUSE_UP":
    case "MOUSE_DOWN":
      return { type, delay: p.triggerDelay ?? 0 };
    case "ON_KEY_DOWN":
      return {
        type,
        device: p.triggerDevice || "KEYBOARD",
        keyCodes: p.triggerKeyCodes || [],
      };
    default:
      return { type };
  }
}

function buildTransition(
  type?: string,
  direction?: string,
  duration?: number,
  easing?: string,
): any | null {
  if (type === "INSTANT") return null;
  const transType = type || "DISSOLVE";
  const easingObj = { type: easing || "EASE_OUT" };
  const dur = duration ?? 0.3;

  if (DIRECTIONAL_TRANSITIONS.has(transType)) {
    return {
      type: transType,
      direction: direction || "LEFT",
      matchLayers: transType === "SMART_ANIMATE",
      easing: easingObj,
      duration: dur,
    };
  }
  return {
    type: transType,
    easing: easingObj,
    duration: dur,
  };
}

async function resolveCollectionAndMode(collectionName: string, modeName: string) {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const cName = collectionName.toLowerCase();
  const col = collections.find((c: any) => c.name.toLowerCase() === cName);
  if (!col) throw new Error(`Collection not found: "${collectionName}". Available: ${collections.map((c: any) => c.name).join(", ")}`);
  const mName = modeName.toLowerCase();
  const mode = col.modes.find((m: any) => m.name.toLowerCase() === mName);
  if (!mode) throw new Error(`Mode not found: "${modeName}" in "${col.name}". Available: ${col.modes.map((m: any) => m.name).join(", ")}`);
  return { collectionId: col.id, modeId: mode.modeId };
}

async function buildAction(a: any): Promise<any> {
  const actionType = a.actionType || a.type || "NODE";

  if (actionType === "BACK") return { type: "BACK" };
  if (actionType === "CLOSE") return { type: "CLOSE" };
  if (actionType === "URL") {
    if (!a.url) throw new Error("url is required for URL action");
    return { type: "URL", url: a.url };
  }

  if (actionType === "SET_VARIABLE_MODE") {
    if (!a.collectionName || !a.modeName) throw new Error("collectionName and modeName are required for SET_VARIABLE_MODE");
    const { collectionId, modeId } = await resolveCollectionAndMode(a.collectionName, a.modeName);
    return { type: "SET_VARIABLE_MODE", variableCollectionId: collectionId, variableModeId: modeId };
  }

  // Default: NODE
  if (!a.destination) throw new Error("destination (node ID) is required for NODE action");

  const nav = a.navigation || "NAVIGATE";
  const destNode = await figma.getNodeByIdAsync(a.destination);
  if (!destNode) throw new Error(`Destination node not found: ${a.destination}`);

  if (nav === "CHANGE_TO") {
    // CHANGE_TO swaps to a variant within the same component set.
    // Destination must be a COMPONENT inside a COMPONENT_SET.
    if (destNode.type !== "COMPONENT" || !destNode.parent || destNode.parent.type !== "COMPONENT_SET") {
      throw new Error(
        `CHANGE_TO destination "${destNode.name}" (${a.destination}) must be a variant (COMPONENT inside a COMPONENT_SET). ` +
        `Got ${destNode.type}${destNode.parent ? ` inside ${destNode.parent.type}` : ""}.`
      );
    }
  } else {
    // NAVIGATE / SWAP / OVERLAY / SCROLL_TO: destination must be a top-level frame.
    // Figma silently rejects reactions targeting nested frames with "Reaction was invalid".
    if (!destNode.parent || destNode.parent.type !== "PAGE") {
      const parentDesc = destNode.parent ? `inside "${destNode.parent.name}" (${destNode.parent.type})` : "with no parent";
      const pageId = destNode.parent ? (() => { let p: BaseNode | null = destNode; while (p && p.type !== "PAGE") p = p.parent; return p?.id; })() : null;
      const fix = pageId ? ` Quick fix: frames(method:"clone", id:"${a.destination}", parentId:"${pageId}", name:"${destNode.name}")` : "";
      throw new Error(`Destination "${destNode.name}" (${a.destination}) is not a top-level frame — it is nested ${parentDesc}. Prototype navigation requires the destination to be a direct child of a page.${fix}`);
    }
    // Cross-page check: source and destination must be on the same page.
    // Figma silently rejects cross-page reactions with "Reaction at index N was invalid".
    if (a._sourcePageId && destNode.parent.id !== a._sourcePageId) {
      throw new Error(
        `Destination "${destNode.name}" (${a.destination}) is on page "${destNode.parent.name}" but the source node is on a different page. ` +
        `Prototype interactions only work within the same page. ` +
        `Quick fix: frames(method:"clone", id:"${a.destination}", parentId:"${a._sourcePageId}", name:"${destNode.name}")`
      );
    }
  }

  return {
    type: "NODE",
    destinationId: a.destination,
    navigation: nav,
    transition: buildTransition(a.transition, a.transitionDirection, a.duration, a.easing),
    resetScrollPosition: a.resetScrollPosition ?? true,
  };
}

async function buildReaction(p: any): Promise<any> {
  const trigger = buildTrigger(p.trigger, p);

  // Multi-action: if `actions` array provided, build each
  if (Array.isArray(p.actions)) {
    const actions: any[] = [];
    for (const a of p.actions) {
      if (p._sourcePageId) a._sourcePageId = p._sourcePageId;
      actions.push(await buildAction(a));
    }
    // Provide both `action` (deprecated, for older API compat) and `actions`
    return { trigger, action: actions[0], actions };
  }

  // Single action from flat params
  const action = await buildAction(p);
  return { trigger, action, actions: [action] };
}

function serializeAction(a: any): any {
  const act: any = { type: a.type };
  if (a.destinationId) act.destinationId = a.destinationId;
  if (a.navigation) act.navigation = a.navigation;
  if (a.transition) {
    const t: any = { type: a.transition.type };
    if (a.transition.duration !== undefined) t.duration = a.transition.duration;
    if (a.transition.easing) t.easing = a.transition.easing.type || a.transition.easing;
    if (a.transition.direction) t.direction = a.transition.direction;
    if (a.transition.matchLayers) t.matchLayers = true;
    act.transition = t;
  }
  if (a.url) act.url = a.url;
  if (a.variableCollectionId) act.variableCollectionId = a.variableCollectionId;
  if (a.variableModeId) act.variableModeId = a.variableModeId;
  if (a.variableId) act.variableId = a.variableId;
  if (a.variableValue !== undefined) act.variableValue = a.variableValue;
  if (a.resetScrollPosition === false) act.resetScrollPosition = false;
  if (a.overlayPositionType) act.overlayPositionType = a.overlayPositionType;
  if (a.overlayRelativePosition) act.overlayRelativePosition = a.overlayRelativePosition;
  return act;
}

function serializeReactionForGet(r: any): any {
  const out: any = {};
  if (r.trigger) out.trigger = r.trigger;
  if (r.actions && Array.isArray(r.actions)) {
    out.actions = r.actions.map(serializeAction);
  }
  return out;
}

// ─── Figma Handlers ──────────────────────────────────────────────

async function getReactions(params: any) {
  const id = params.id;
  if (!id) throw new Error("id is required");
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error(`Node not found: ${id}`);

  const result: any = {};

  if ("reactions" in node) {
    const reactions = (node as any).reactions;
    if (Array.isArray(reactions) && reactions.length > 0) {
      result.reactions = reactions.map(serializeReactionForGet);
    } else {
      result.reactions = [];
    }
  } else {
    result.reactions = [];
  }

  if ("overflowDirection" in node) {
    result.overflowDirection = (node as any).overflowDirection;
  }

  return result;
}

async function addReactionSingle(p: any) {
  const id = p.id;
  if (!id) throw new Error("id is required");
  if (!p.trigger) throw new Error("trigger is required");

  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error(`Node not found: ${id}`);
  if (!("reactions" in node)) throw new Error(`Node ${node.type} does not support reactions`);

  // Find source page ID for cross-page validation
  let cursor: BaseNode | null = node;
  while (cursor && cursor.type !== "PAGE") cursor = cursor.parent;
  const sourcePageId = cursor?.id;

  const existing = JSON.parse(JSON.stringify((node as any).reactions || []));
  // Inject source page ID so buildAction can detect cross-page targets
  p._sourcePageId = sourcePageId;
  const newReaction = await buildReaction(p);
  existing.push(newReaction);

  await (node as any).setReactionsAsync(existing);
  return {};
}

async function setReactions(params: any) {
  const id = params.id;
  if (!id) throw new Error("id is required");
  if (!params.reactions) throw new Error("reactions array is required");

  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error(`Node not found: ${id}`);
  if (!("reactions" in node)) throw new Error(`Node ${node.type} does not support reactions`);

  // Validate cross-page destinations in all reactions before applying
  let sourcePage: BaseNode | null = node;
  while (sourcePage && sourcePage.type !== "PAGE") sourcePage = sourcePage.parent;
  if (sourcePage) {
    for (const reaction of params.reactions) {
      const actions = reaction.actions || (reaction.action ? [reaction.action] : []);
      for (const action of actions) {
        if (action.type === "NODE" && action.destinationId) {
          const dest = await figma.getNodeByIdAsync(action.destinationId);
          if (dest) {
            let destPage: BaseNode | null = dest;
            while (destPage && destPage.type !== "PAGE") destPage = destPage.parent;
            if (destPage && destPage.id !== sourcePage.id) {
              throw new Error(
                `Destination "${dest.name}" (${action.destinationId}) is on page "${(destPage as any).name}" but the source node is on page "${(sourcePage as any).name}". ` +
                `Prototype interactions only work within the same page. ` +
                `Quick fix: frames(method:"clone", id:"${action.destinationId}", parentId:"${sourcePage.id}", name:"${dest.name}")`
              );
            }
          }
        }
      }
    }
  }

  await (node as any).setReactionsAsync(params.reactions);
  return "ok";
}

async function removeReaction(params: any) {
  const id = params.id;
  if (!id) throw new Error("id is required");
  if (params.index === undefined) throw new Error("index is required");

  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error(`Node not found: ${id}`);
  if (!("reactions" in node)) throw new Error(`Node ${node.type} does not support reactions`);

  // Deep clone reactions — Figma returns frozen objects, shallow copy causes
  // setReactionsAsync to silently keep the old reaction data.
  const existing = JSON.parse(JSON.stringify((node as any).reactions || []));
  if (params.index < 0 || params.index >= existing.length) {
    throw new Error(`Index ${params.index} out of range (${existing.length} reactions)`);
  }

  existing.splice(params.index, 1);
  await (node as any).setReactionsAsync(existing);

  // Verify the reaction was actually removed — Figma can silently fail
  const after = (node as any).reactions || [];
  if (after.length !== existing.length) {
    throw new Error(`Reaction removal failed — expected ${existing.length} reactions after removal, got ${after.length}. Try prototyping(method:"set", id:"${id}", reactions:[]) to clear all, then re-add the ones you want.`);
  }

  return "ok";
}

export const figmaHandlers: Record<string, (params: any) => Promise<any>> = {
  get_reactions: getReactions,
  add_reaction: (p) => batchHandler(p, addReactionSingle),
  set_reactions: setReactions,
  remove_reaction: removeReaction,
};
