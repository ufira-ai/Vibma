import { defineConfig } from 'tsup';
import { copyFileSync, readFileSync, writeFileSync } from 'fs';

export default defineConfig({
  entry: ['src/plugin/code.ts'],
  format: ['iife'],
  outDir: '../../plugin',
  outExtension: () => ({ js: '.js' }),
  target: 'es2015',
  sourcemap: false,
  minify: false,
  splitting: false,
  bundle: true,
  globalName: undefined,
  noExternal: [/.*/],
  async onSuccess() {
    copyFileSync('src/plugin/manifest.json', '../../plugin/manifest.json');
    copyFileSync('src/plugin/ui.html', '../../plugin/ui.html');
    // Bump manifest.json content so Figma detects the change and hot-reloads the plugin
    const manifest = JSON.parse(readFileSync('../../plugin/manifest.json', 'utf8'));
    manifest._buildTime = Date.now();
    writeFileSync('../../plugin/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
    // If the user imported the *source* manifest at packages/adapter-figma/src/plugin/manifest.json,
    // Figma will try to load packages/adapter-figma/src/plugin/code.js. Ensure it exists after build.
    copyFileSync('../../plugin/code.js', 'src/plugin/code.js');
  },
});
