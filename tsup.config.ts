import { defineConfig } from 'tsup';

export default defineConfig([
  // MCP Server → dist/server.{cjs,js}
  {
    entry: ['src/talk_to_figma_mcp/server.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    outDir: 'dist',
    target: 'node18',
    sourcemap: true,
    minify: false,
    splitting: false,
    bundle: true,
  },
  // Figma Plugin → src/cursor_mcp_plugin/code.js (IIFE for Figma sandbox)
  {
    entry: ['src/cursor_mcp_plugin/code.ts'],
    format: ['iife'],
    outDir: 'src/cursor_mcp_plugin',
    outExtension: () => ({ js: '.js' }),
    target: 'es2015',
    sourcemap: false,
    minify: false,
    splitting: false,
    bundle: true,
    // Figma plugin sandbox provides `figma` and `__html__` globals
    globalName: undefined,
    noExternal: [/.*/],
  },
]);
