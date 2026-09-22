import "dotenv/config";
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {handleChatHttpRequest} from './server/chat-handler.ts';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-chat-endpoint',
        configureServer(server) {
          server.middlewares.use('/api/chat', (req, res) => {
            handleChatHttpRequest(req, res);
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
