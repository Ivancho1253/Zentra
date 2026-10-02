import { build } from 'esbuild';
await build({
  entryPoints: ['server/production.ts'],
  outfile: 'dist-server/server.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
});
