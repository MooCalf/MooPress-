import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@dictionary-en': fileURLToPath(new URL('./node_modules/dictionary-en', import.meta.url)) },
  },
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
