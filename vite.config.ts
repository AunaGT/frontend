import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// removed lovable-tagger import

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Concurrent development servers must not replace each other's optimized modules.
  cacheDir: path.resolve(__dirname, "node_modules", `.vite-dev-${process.pid}`),
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
