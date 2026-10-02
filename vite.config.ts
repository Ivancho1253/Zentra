import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { brandedHtml, brandManifest } from './shared/brandMetadata.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'zentra-brand',
        transformIndexHtml: brandedHtml,
        configureServer(server) {
          server.middlewares.use('/manifest.webmanifest', (_req, res) => {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.end(JSON.stringify(brandManifest()));
          });
        },
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'manifest.webmanifest',
            source: JSON.stringify(brandManifest()),
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify: file watching is disabled to prevent flickering during agent edits.
      hmr:
        process.env.DISABLE_HMR === 'true'
          ? false
          : { port: Number(process.env.HMR_PORT || 24678) },
    },
    build: {
      rolldownOptions: {
        output: {
          manualChunks(id) {
            const module = id.replace(/\\/g, '/');
            if (!module.includes('/node_modules/')) return;
            if (/\/(?:@firebase|firebase)\//.test(module)) return 'firebase';
            if (/\/(?:react|react-dom|react-router|react-router-dom)\//.test(module))
              return 'react';
            if (module.includes('/recharts/')) return 'charts';
            if (/\/(?:motion|framer-motion)\//.test(module)) return 'motion';
          },
        },
      },
    },
  };
});
