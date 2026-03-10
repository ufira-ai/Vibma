// ─── Penpot create_frame Handler ─────────────────────────────────
//
// Penpot API notes vs adapter-figma:
// - `penpot.createBoard()` is the Penpot equivalent of `figma.createFrame()`.
//   The resulting object is a `Board` (type: 'board'), not a 'frame'.
// - Dimensions are set via `board.resize(width, height)` (width/height are readonly).
// - Layout is CSS Flex, not Figma AutoLayout enums:
//     board.addFlexLayout() → FlexLayout  then set .dir / .wrap / alignment props.
// - Fills use `{ fillColor: "#rrggbb", fillOpacity: number }` not Figma Paint[].
// - No variable / style binding APIs in Penpot plugin SDK (not exposed).
// - No cornerRadius property; Penpot uses borderRadius on ShapeBase.
// - Parent appending: boards are created on currentPage by default; to reparent
//   use `parentBoard.appendChild(board)`.  Generic page-level shapes cannot be
//   reparented to arbitrary nodes via the plugin API (gap vs. adapter-figma).

import { mapLayoutMode, mapPrimaryAlign, mapCounterAlign, mapSizing, vibmaColorToPenpotFill } from "./helpers";

async function createSingleFrame(p: any): Promise<any> {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Frame",
    fillColor,
    cornerRadius,
    layoutMode = "NONE",
    layoutWrap,
    paddingTop = 0,
    paddingRight = 0,
    paddingBottom = 0,
    paddingLeft = 0,
    primaryAxisAlignItems,
    counterAxisAlignItems,
    layoutSizingHorizontal,
    layoutSizingVertical,
    itemSpacing = 0,
    parentId,
  } = p;

  const board = penpot.createBoard();
  board.name = name;
  board.x = x;
  board.y = y;
  board.resize(width, height);

  // Corner radius — Penpot uses borderRadius on ShapeBase
  if (cornerRadius !== undefined) {
    board.borderRadius = cornerRadius;
  }

  // Fill color
  if (fillColor) {
    board.fills = [vibmaColorToPenpotFill(fillColor)];
  } else {
    board.fills = []; // no fill by default
  }

  // Flex layout
  const flexDir = mapLayoutMode(layoutMode);
  if (flexDir !== null) {
    const flex = board.addFlexLayout();
    flex.dir = flexDir;

    // Wrap: Vibma "WRAP" → Penpot "wrap", "NO_WRAP" → "nowrap"
    if (layoutWrap) {
      flex.wrap = layoutWrap === "WRAP" ? "wrap" : "nowrap";
    }

    // Padding
    flex.topPadding = paddingTop;
    flex.rightPadding = paddingRight;
    flex.bottomPadding = paddingBottom;
    flex.leftPadding = paddingLeft;

    // Gap (item spacing)
    if (flexDir === "row") {
      flex.columnGap = itemSpacing;
    } else {
      flex.rowGap = itemSpacing;
    }

    // Justify content (primary axis)
    if (primaryAxisAlignItems) {
      flex.justifyContent = mapPrimaryAlign(primaryAxisAlignItems) as any;
    }

    // Align items (counter axis)
    if (counterAxisAlignItems) {
      flex.alignItems = mapCounterAlign(counterAxisAlignItems) as any;
    }

    // Sizing — applied to the flex layout object
    if (layoutSizingHorizontal) {
      flex.horizontalSizing = mapSizing(layoutSizingHorizontal);
    }
    if (layoutSizingVertical) {
      flex.verticalSizing = mapSizing(layoutSizingVertical);
    }
  }

  // Parent reparenting
  // Penpot gap: only Board nodes support appendChild in the plugin API.
  // If parentId is provided we attempt to find a Board shape and reparent.
  if (parentId) {
    const parent = penpot.currentPage?.getShapeById(parentId);
    if (parent && parent.type === "board") {
      const parentBoard = parent as any;
      parentBoard.insertChild(parentBoard.children.length, board);
    }
    // If parent is not a board, we silently leave the frame on the root page
    // (Penpot plugin API does not support appending to non-board shapes).
  }

  return { id: board.id, name: board.name };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  create_frame: async (params: any) => {
    // Support both batch (items array) and single-object invocation
    if (Array.isArray(params?.items)) {
      return Promise.all(params.items.map((item: any) => createSingleFrame(item)));
    }
    return createSingleFrame(params);
  },
};
