// packages/sidecar-extension/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';
import webExtension from 'vite-plugin-web-extension';

// This function helps generate the manifest with correct script paths
function generateManifest() {
  const manifest = require('./src/manifest.json');
  // In a Vite build, scripts are often in an `assets` subfolder
  // or named differently. This example assumes direct output.
  // A more robust solution might read Vite's build manifest.
  return {
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    manifest_version: 3,
    permissions: manifest.permissions,
    host_permissions: manifest.host_permissions,
    background: { service_worker: 'background/service-worker.js' },
    content_scripts: manifest.content_scripts,
    externally_connectable: manifest.externally_connectable,
  };
}

export default defineConfig({
  // Use the 'public' directory for static assets like manifest.json and icons
  // But we will generate the final manifest with the plugin
  publicDir: 'assets', // A folder for icons, etc.
  build: {
    // We are not building a standard web app
    lib: {
      // Define the entry points for the extension's scripts as an array
      entry: [
        resolve(__dirname, 'src/background/service-worker.js'),
        resolve(__dirname, 'src/content/content.js')
      ],
      // The output format should be 'es' for modern extensions
      formats: ['es'],
    },
    rollupOptions: {
      output: {
        // Ensure consistent output file names
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    // Set the output directory
    outDir: 'dist',
    // Turn off minification for easier debugging
    minify: false,
  },
  plugins: [
    react(),
    webExtension({
      // The plugin will generate the manifest for us
      manifest: generateManifest,
    }),
  ],
});
