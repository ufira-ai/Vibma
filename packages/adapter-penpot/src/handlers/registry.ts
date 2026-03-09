/**
 * Penpot handler registry.
 *
 * Scaffold only — no handlers wired yet.
 * Add handler imports and merge them into allPenpotHandlers as implementations land.
 *
 * Pattern mirrors adapter-figma/src/handlers/registry.ts:
 *   import { penpotHandlers as fooHandlers } from "./foo";
 *   export const allPenpotHandlers = { ...fooHandlers, ... };
 */

/** Merged dispatch map: command name → handler function */
export const allPenpotHandlers: Record<string, (params: any) => Promise<any>> = {
  // TODO: register handlers here as they are implemented
};
