import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy VoiceBox API requests to avoid CORS in development.
      // The browser calls /voicebox-proxy/* and Vite forwards to the local VoiceBox instance.
      '/voicebox-proxy': {
        target: 'http://127.0.0.1:17493',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/voicebox-proxy/, ''),
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
