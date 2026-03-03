import { defineConfig } from 'tsup';
import { copyFileSync } from 'fs';

export default defineConfig({
  entry: ['src/plugin/code.ts'],
  format: ['iife'],
  outDir: 'plugin',
  outExtension: () => ({ js: '.js' }),
  target: 'es2015',
  sourcemap: false,
  minify: false,
  splitting: false,
  bundle: true,
  globalName: undefined,
  noExternal: [/.*/],
  async onSuccess() {
    copyFileSync('src/plugin/manifest.json', 'plugin/manifest.json');
    copyFileSync('src/plugin/ui.html', 'plugin/ui.html');
  },
});
