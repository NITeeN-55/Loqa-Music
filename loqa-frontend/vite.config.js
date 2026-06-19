import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'https://loqa-music.onrender.com';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'Loqa Music',
          short_name: 'Loqa',
          description: 'Stream music from YouTube with a Spotify-like experience',
          theme_color: '#060608',
          background_color: '#060608',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          categories: ['music', 'entertainment'],
          shortcuts: [
            { name: 'Search', short_name: 'Search', url: '/?view=search', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Library', short_name: 'Library', url: '/?view=library', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          // Cache app shell assets (JS, CSS, fonts)
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Don't cache API calls — always network-first
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/loqa-music\.onrender\.com\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 }, // 1hr
              },
            },
            {
              // YouTube thumbnails — cache for 7 days
              urlPattern: /^https:\/\/i\.ytimg\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName: 'yt-thumbnails',
                expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
      }),
    ],

    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true, secure: true },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            react:   ['react', 'react-dom'],
            zustand: ['zustand'],
          },
        },
      },
    },

    define: {
      __API_URL__: JSON.stringify(apiUrl),
    },
  };
});
