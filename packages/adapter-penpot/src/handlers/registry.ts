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

/** Merged dispatch map: command name → handler function */
export const allPenpotHandlers: Record<string, (params: any) => Promise<any>> = {
  ...connectionHandlers,
  ...documentHandlers,
  ...createFrameHandlers,
};
