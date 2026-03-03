import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/mcp.ts',
    'src/tools/types.ts',
    'src/tools/endpoint.ts',
    'src/tools/schemas.ts',
    'src/tools/registry.ts',
    'src/utils/color.ts',
    'src/utils/wcag.ts',
    'src/utils/coercion.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outDir: 'dist',
  target: 'node18',
  sourcemap: true,
  minify: false,
  splitting: false,
  bundle: true,
});
