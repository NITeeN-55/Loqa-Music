import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    server: {
      port: 5173,
      open: true,
      // Dev proxy: forwards /api calls to local backend
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://loqa-music.onrender.com',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      // Warn if any chunk exceeds 700 kB
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

    // Make VITE_API_URL available everywhere in the app
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL || 'https://loqa-music.onrender.com'),
    },
  };
});
