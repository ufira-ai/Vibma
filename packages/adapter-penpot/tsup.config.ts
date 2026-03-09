import { defineConfig } from 'tsup';

export default defineConfig({
  // Penpot plugin code: bundled as IIFE, loaded via dev server (host URL in manifest.json)
  entry: ['src/plugin/code.ts'],
  format: ['iife'],
  outDir: 'dist/plugin',
  outExtension: () => ({ js: '.js' }),
  target: 'es2015',
  sourcemap: false,
  minify: false,
  splitting: false,
  bundle: true,
  globalName: undefined,
  noExternal: [/.*/],
});
