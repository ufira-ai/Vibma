// ─── Penpot create_text Handler ──────────────────────────────────
//
// Penpot API notes:
// - `penpot.createText(text: string)` creates a Text shape on the current page.
// - Position and size are set via .x, .y, .width, .height on the returned shape.
// - Font properties (.fontSize, .fontFamily) can be set directly on the text shape.
// - Fills use `{ fillColor: "#rrggbb", fillOpacity: number }`.
// - To add to a parent board, use `parent.insertChild(parent.children.length, shape)`.

import { vibmaColorToPenpotFill } from "./helpers";

async function createSingleText(p: any): Promise<any> {
  const {
    x = 0,
    y = 0,
    width = 200,
    height = 40,
    name = "Text",
    content = "",
    fontSize,
    fontFamily,
    fillColor,
    parentId,
  } = p;

  const text = penpot.createText(content);
  text.name = name;
  text.x = x;
  text.y = y;
  (text as any).resize(width, height);

  // Font properties
  if (fontSize !== undefined) {
    (text as any).fontSize = fontSize;
  }
  if (fontFamily !== undefined) {
    (text as any).fontFamily = fontFamily;
  }

  // Fill color
  if (fillColor) {
    text.fills = [vibmaColorToPenpotFill(fillColor)];
  }

  // Parent reparenting via insertChild
  if (parentId) {
    const parent = penpot.currentPage?.getShapeById(parentId);
    if (parent && "children" in parent) {
      const parentShape = parent as any;
      parentShape.insertChild((parentShape.children as any[]).length, text);
    }
  }

  return { id: text.id, name: text.name };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  create_text: async (params: any) => {
    if (Array.isArray(params?.items)) {
      return Promise.all(params.items.map((item: any) => createSingleText(item)));
    }
    return createSingleText(params);
  },
};
