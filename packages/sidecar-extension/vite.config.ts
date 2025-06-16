import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // Make sure this matches your package.json
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    // We will control the build entirely through rollupOptions
    outDir: 'dist',
    sourcemap: 'inline',
    minify: false,

    rollupOptions: {
      // Define the multiple entry points for the extension
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'content/content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        // The output format MUST be 'es' (ES Module) for Chrome Extensions
        format: 'esm',
        // Ensure consistent naming for the output files
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/manifest.json',
          dest: '.'
        }
      ]
    })
  ],
});