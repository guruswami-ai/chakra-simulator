/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // Base path for reverse proxy at /dashboard/
      base: '/',
      server: {
        port: 5173,
        host: '0.0.0.0',
        allowedHosts: true,
      },
      plugins: [tailwindcss(), react()],
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
            manualChunks: {
              // Split heavy charting library — only loaded by ClusterTopologyCard and ClusterDetailedView
              recharts: ['recharts'],
              // Split XState — only loaded by character engine
              xstate: ['xstate', '@xstate/react'],
            },
          },
        },
      },
      test: {
        environment: 'happy-dom',
        globals: true,
        setupFiles: ['./__tests__/setup.ts'],
        exclude: ['e2e/**', 'node_modules/**'],
      }
    };
});
