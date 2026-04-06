import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages project sites: set VITE_BASE_PATH=/repo-name/ in .env.production */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const raw = env.VITE_BASE_PATH ?? "/";
  const base = raw.endsWith("/") ? raw : `${raw}/`;
  return {
    plugins: [react()],
    base,
  };
});
