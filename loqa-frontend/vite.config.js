import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// vite-plugin-pwa is optional — loaded dynamically so the build never fails
// if the package hasn't been installed yet (e.g. first Vercel deploy).
// Run: npm install vite-plugin-pwa  to enable PWA / service-worker features.
let VitePWA = null;
try {
  const pwa = await import('vite-plugin-pwa');
  VitePWA = pwa.VitePWA;
} catch { /* not installed — PWA features will be skipped */ }

export default defineConfig(({ mode }) => {
  const env    = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'https://loqa-music.onrender.com';

  const pwaPlugin = VitePWA
    ? VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
        manifest: {
          name:             'Loqa Music',
          short_name:       'Loqa',
          description:      'Stream music from YouTube with a Spotify-like experience',
          theme_color:      '#060608',
          background_color: '#060608',
          display:          'standalone',
          orientation:      'portrait',
          start_url:        '/',
          scope:            '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
          categories: ['music', 'entertainment'],
          shortcuts: [
            { name: 'Search',  url: '/?view=search',  icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Library', url: '/?view=library', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/loqa-music\.onrender\.com\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName:            'api-cache',
                networkTimeoutSeconds: 10,
                expiration:           { maxEntries: 100, maxAgeSeconds: 3600 },
              },
            },
            {
              urlPattern: /^https:\/\/i\.ytimg\.com\//,
              handler: 'CacheFirst',
              options: {
                cacheName:  'yt-thumbnails',
                expiration: { maxEntries: 500, maxAgeSeconds: 604800 },
              },
            },
          ],
        },
      })
    : null;

  return {
    plugins: [react(), pwaPlugin].filter(Boolean),

    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': { target: apiUrl, changeOrigin: true, secure: true },
      },
    },

    build: {
      outDir:                 'dist',
      sourcemap:              false,
      chunkSizeWarningLimit:  700,
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
