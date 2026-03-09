#!/usr/bin/env node

/**
 * Penpot MCP server entry point.
 *
 * Architecture differences from adapter-figma:
 * - Penpot plugins load via a host URL (dev server), not a bundled JS file
 * - The plugin communicates with the relay over a plain WebSocket (same relay protocol)
 * - The `penpot` global replaces `figma`; `penpot.ui.open()` replaces `figma.showUI()`
 * - Layout uses CSS Flex/Grid direction strings (`layoutFlexDir`) rather than Figma `layoutMode`
 *
 * This file uses the same WebSocket relay pattern as packages/core/src/mcp.ts but
 * is scoped to a Penpot-specific channel so the relay can route correctly.
 */

// NOTE: This is a scaffold. Handler implementations are not yet wired.
// Import the handler registry once handlers are implemented:
// import { allPenpotHandlers } from "./handlers/registry";

export {};
