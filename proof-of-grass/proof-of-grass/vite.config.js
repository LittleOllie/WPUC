import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/proof-of-grass/" : "/",
  plugins: [
    react(),
    tailwindcss(),
    command === "serve" && {
      name: "dev-html-entry",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const path = req.url?.split("?")[0];
          if (path === "/" || path === "/index.html") {
            req.url = "/index.vite.html";
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.vite.html"),
    },
  },
}));
