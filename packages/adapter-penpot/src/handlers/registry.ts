/**
 * Penpot handler registry.
 *
 * Pattern mirrors adapter-figma/src/handlers/registry.ts:
 *   import { penpotHandlers as fooHandlers } from "./foo";
 *   export const allPenpotHandlers = { ...fooHandlers, ... };
 */

import { penpotHandlers as connectionHandlers } from "./connection";
import { penpotHandlers as documentHandlers } from "./document";
import { penpotHandlers as createFrameHandlers } from "./create-frame";
import { penpotHandlers as createShapesHandlers } from "./create-shapes";
import { penpotHandlers as createTextHandlers } from "./create-text";
import { penpotHandlers as selectionHandlers } from "./selection";
import { penpotHandlers as searchHandlers } from "./search";
import { penpotHandlers as exportHandlers } from "./export";
import { penpotHandlers as groupsHandlers } from "./groups";

/** Merged dispatch map: command name → handler function */
export const allPenpotHandlers: Record<string, (params: any) => Promise<any>> = {
  ...connectionHandlers,
  ...documentHandlers,
  ...createFrameHandlers,
  ...createShapesHandlers,
  ...createTextHandlers,
  ...selectionHandlers,
  ...searchHandlers,
  ...exportHandlers,
  ...groupsHandlers,
};
