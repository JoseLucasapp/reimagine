import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
type ViteConfigContext = { mode: string };
const watchIgnored = ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/.vite/**", "**/coverage/**"];
const usePolling = process.env.VITE_DEV_USE_POLLING === "true" || process.env.CHOKIDAR_USEPOLLING === "true";

export default defineConfig(({ mode }: ViteConfigContext) => ({
  server: {
    host: "::",
    port: 8080,
    watch: {
      ignored: watchIgnored,
      ...(usePolling ? { usePolling: true, interval: 350 } : {}),
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
