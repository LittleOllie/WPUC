import { defineConfig, type Connect, type ViteDevServer } from "vite";
import type { ServerResponse } from "node:http";
import react from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Production base path. Default `/` for custom domain (blackwater-labs.com). Override for subpath deploys. */
const deployBase = process.env.VITE_BASE_PATH
  ? process.env.VITE_BASE_PATH.endsWith("/")
    ? process.env.VITE_BASE_PATH
    : `${process.env.VITE_BASE_PATH}/`
  : "/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? deployBase : "/",
  plugins: [
    react(),
    command === "serve" && {
      name: "dev-html-entry",
      configureServer(server: ViteDevServer) {
        server.middlewares.use(
          (req: Connect.IncomingMessage, _res: ServerResponse, next: Connect.NextFunction) => {
          const path = req.url?.split("?")[0];
          if (path === "/" || path === "/index.html") {
            req.url = "/index.vite.html";
          }
          next();
        },
        );
      },
    },
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.vite.html"),
    },
  },
}));
