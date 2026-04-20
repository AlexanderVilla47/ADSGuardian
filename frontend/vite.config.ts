import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/n8n': {
        target: 'http://168.138.125.21:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, ''),
      },
    },
  },
});