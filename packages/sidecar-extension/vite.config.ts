import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc'; // Make sure this matches your package.json
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: 'inline',
    minify: false, // Set to true for production builds
    rollupOptions: {
      input: {
        'background/service-worker': resolve(__dirname, 'src/background/service-worker.js'),
        'content/content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
          format: 'es',
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name].js',
          assetFileNames: 'assets/[name][extname]'
        },
      external: [],
    },
  },
  assetsInclude: ['**/*.json'],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'src/manifest.json',
          dest: '.'
        },
        {
          src: 'src/content/configs/*.json',
          dest: 'content/configs'
        }
      ]
    })
  ],
});