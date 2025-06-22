import { defineConfig } from 'vite';
import { resolve } from 'path';

// This config is specifically for bundling the content script as an IIFE.
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: 'inline',
    minify: false,
    rollupOptions: {
      input: {
        'content/content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        format: 'iife',
        entryFileNames: 'content/content.js',
      },
    },
    // Important: Prevents this build from clearing the output of the main build.
    emptyOutDir: false,
  },
});