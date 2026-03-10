import { defineConfig } from 'tsup';
import { copyFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
  async onSuccess() {
    // Copy static plugin assets alongside the compiled code
    const assets = ['manifest.json', 'ui.html', 'icon.png'];
    for (const asset of assets) {
      const src = resolve('src/plugin', asset);
      const dest = resolve('dist/plugin', asset);
      if (existsSync(src)) copyFileSync(src, dest);
    }
  },
});
