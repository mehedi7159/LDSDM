import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { handleAdminBootstrapApi } from './server/adminApi';
import { handleAiAdvisorApi } from './server/aiAssistantApi';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        hmr: false,
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
          manifest: {
            id: '/',
            name: 'মাদ্রাসা ও শিক্ষা ব্যবস্থাপনা প্ল্যাটফর্ম (Madrasah Management System)',
            short_name: 'মাদ্রাসা',
            description: 'স্মার্ট মাদ্রাসা, ফলাফল, হাজিরা, ফিন্যান্স ও শিক্ষা ব্যবস্থাপনা সিস্টেম।',
            theme_color: '#0f172a',
            background_color: '#0f172a',
            display: 'standalone',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: '/pwa-192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: '/pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 15,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200],
                  },
                },
              },
            ],
          },
          devOptions: {
            enabled: true,
            type: 'module',
          },
        }),
        {
          name: 'admin-bootstrap-api',
          configureServer(server) {
            server.middlewares.use('/api/admin/bootstrap-owner', (req, res) => {
              handleAdminBootstrapApi(req, res);
            });
            server.middlewares.use('/api/ai/advisor', (req, res) => {
              handleAiAdvisorApi(req, res);
            });
          },
          configurePreviewServer(server) {
            server.middlewares.use('/api/admin/bootstrap-owner', (req, res) => {
              handleAdminBootstrapApi(req, res);
            });
            server.middlewares.use('/api/ai/advisor', (req, res) => {
              handleAiAdvisorApi(req, res);
            });
          }
        }
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            // Phase 5: split stable vendor libraries into cacheable chunks so
            // app-code updates don't force re-downloading React/Firebase/etc.
            // The PDF chain stays out of the boot path: it is only reachable
            // through dynamic import() and lazy route chunks.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return undefined;
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
              if (/node_modules\/(@firebase|firebase)\//.test(id)) return 'vendor-firebase';
              if (/node_modules\/recharts\//.test(id)) return 'vendor-charts';
              if (/node_modules\/(jspdf|html2canvas|dompurify|canvg|rgbcolor|stackblur-canvas|svg-pathdata|css-line-break|text-segmentation|performance-now|raf)\//.test(id)) return 'vendor-pdf';
              return undefined;
            }
          }
        }
      }
    };
});

