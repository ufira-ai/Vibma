// ─── Penpot create_rectangle & create_ellipse Handlers ──────────
//
// Penpot API notes:
// - `penpot.createRectangle()` → Rectangle shape with x, y, resize(w,h), fills, name.
// - `penpot.createEllipse()` → Ellipse shape with the same base properties.
// - Fills use `{ fillColor: "#rrggbb", fillOpacity: number }`.
// - Shapes are created on currentPage; use insertChild to position in z-order.

import { vibmaColorToPenpotFill } from "./helpers";

async function createSingleRectangle(p: any): Promise<any> {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Rectangle",
    fillColor,
    cornerRadius,
  } = p;

  const rect = penpot.createRectangle();
  rect.name = name;
  rect.x = x;
  rect.y = y;
  rect.resize(width, height);

  if (cornerRadius !== undefined) {
    (rect as any).borderRadius = cornerRadius;
  }

  if (fillColor) {
    rect.fills = [vibmaColorToPenpotFill(fillColor)];
  }

  return { id: rect.id, name: rect.name };
}

async function createSingleEllipse(p: any): Promise<any> {
  const {
    x = 0,
    y = 0,
    width = 100,
    height = 100,
    name = "Ellipse",
    fillColor,
  } = p;

  const ellipse = penpot.createEllipse();
  ellipse.name = name;
  ellipse.x = x;
  ellipse.y = y;
  ellipse.resize(width, height);

  if (fillColor) {
    ellipse.fills = [vibmaColorToPenpotFill(fillColor)];
  }

  return { id: ellipse.id, name: ellipse.name };
}

export const penpotHandlers: Record<string, (params: any) => Promise<any>> = {
  create_rectangle: async (params: any) => {
    if (Array.isArray(params?.items)) {
      return Promise.all(params.items.map((item: any) => createSingleRectangle(item)));
    }
    return createSingleRectangle(params);
  },
  create_ellipse: async (params: any) => {
    if (Array.isArray(params?.items)) {
      return Promise.all(params.items.map((item: any) => createSingleEllipse(item)));
    }
    return createSingleEllipse(params);
  },
};
