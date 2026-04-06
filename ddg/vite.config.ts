import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GitHub Pages serves project sites at: https://<user>.github.io/<repo>/
 * A default Vite `base: "/"` makes JS/CSS load from `https://<user>.github.io/assets/...` (404).
 * Fix: create `.env.production` with VITE_BASE_PATH=/<repo>/ (leading and trailing slashes).
 * Example repo "ddg": VITE_BASE_PATH=/ddg/
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE_PATH?.trim() || "/";

  return {
    plugins: [react()],
    publicDir: "public",
    base,
    server: {
      open: true,
      port: 5173,
    },
    preview: {
      port: 4173,
      open: true,
    },
  };
});
