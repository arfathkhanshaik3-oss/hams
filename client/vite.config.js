import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the browser talks to Vite (port 5173). Vite forwards /api and
// /socket.io to the Express server (port 5000), so the login cookie works without CORS trouble.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:5000', ws: true, changeOrigin: true },
    },
  },
});
