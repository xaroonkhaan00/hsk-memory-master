import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Story and conversation text is fetched on demand, so it must stay
          // out of the chunk the first screen waits for.
          if (id.includes('story-mode.json')) return 'story-text';
          if (id.includes('conversations.json')) return 'conversation-text';
          if (id.includes('src/data/generated')) return 'vocab-data';
          if (id.includes('node_modules')) return 'vendor';
          return undefined;
        },
      },
    },
  },
});
