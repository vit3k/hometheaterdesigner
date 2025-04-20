import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [], // Add any Vite plugins you use here (e.g., @vitejs/plugin-react)
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
});
