import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ADD THIS BLOCK TO FIX THE WARNING
  optimizeDeps: {
    include: ['react/jsx-runtime'],
  },
})
