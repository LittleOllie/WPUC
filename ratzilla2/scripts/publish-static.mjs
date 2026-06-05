/**
 * Copy Vite build output from dist/ into ratzilla2/ for GitHub Pages at /ratzilla2/
 */
import { cpSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const assetsDir = join(root, "assets");

if (!existsSync(distDir)) {
  console.error("Run `npm run build` first — dist/ is missing.");
  process.exit(1);
}

/* Drop previous hashed JS/CSS bundles from assets/. */
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (/^index-[\w-]+\.(js|css)$/.test(name)) {
      unlinkSync(join(assetsDir, name));
    }
  }
}

cpSync(join(distDir, "index.html"), join(root, "index.html"));
cpSync(join(distDir, "404.html"), join(root, "404.html"));
console.log("published: index.html, 404.html");

const distAssets = join(distDir, "assets");
if (existsSync(distAssets)) {
  cpSync(distAssets, assetsDir, { recursive: true });
  console.log("published: assets/ (built bundles + static media)");
}
