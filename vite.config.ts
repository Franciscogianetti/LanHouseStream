import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { setupLanSyncServer } from './server/lanSyncServer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'lan-sync-plugin',
        configureServer(server) {
          if (server.httpServer) {
            setupLanSyncServer(server.httpServer);
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR ativado para desenvolvimento, com watch estrito ignorando pastas de build/logs
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        ignored: ['**/dist/**', '**/server/**', '**/*.log', '**/.git/**'],
      },
    },
  };
});
