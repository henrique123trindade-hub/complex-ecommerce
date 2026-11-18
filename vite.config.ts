import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

const HERO_DESKTOP_PRELOAD_SRCSET =
  '/src/assets/images/optimized/complex_campaign_1_5292459e-400w.avif 400w, /src/assets/images/optimized/complex_campaign_1_5292459e-800w.avif 800w, /src/assets/images/optimized/complex_campaign_1_5292459e-1200w.avif 1200w, /src/assets/images/optimized/complex_campaign_1_5292459e-1672w.avif 1672w';

const HERO_MOBILE_PRELOAD_SRCSET =
  '/src/assets/images/optimized/complex_model_hoodie_3_41227f9c-400w.avif 400w, /src/assets/images/optimized/complex_model_hoodie_3_41227f9c-800w.avif 800w, /src/assets/images/optimized/complex_model_hoodie_3_41227f9c-1122w.avif 1122w';

const OG_IMAGE_PATH =
  '/src/assets/images/optimized/complex_campaign_1_5292459e-1200w.webp';

export default defineConfig(({ command }) => {
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Keeps <link rel="preload"> and meta og:image/twitter:image aligned with
      // the unbundled /src/assets/images/optimized/* URLs rendered by OptimizedImage,
      // preventing duplicate downloads and unused preload warnings.
      {
        name: 'align-unbundled-preload-urls',
        apply: 'build',
        transformIndexHtml: {
          order: 'post',
          handler(html: string): string {
            return html
              .replace(
                /imagesrcset="[^"]*complex_campaign_1_5292459e[^"]*"/g,
                `imagesrcset="${HERO_DESKTOP_PRELOAD_SRCSET}"`
              )
              .replace(
                /imagesrcset="[^"]*complex_model_hoodie_3_41227f9c[^"]*"/g,
                `imagesrcset="${HERO_MOBILE_PRELOAD_SRCSET}"`
              )
              .replace(
                /(property="og:image"\s+content=")[^"]*(")/g,
                `$1${OG_IMAGE_PATH}$2`
              )
              .replace(
                /(name="twitter:image"\s+content=")[^"]*(")/g,
                `$1${OG_IMAGE_PATH}$2`
              );
          },
        },
      },
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('/node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
