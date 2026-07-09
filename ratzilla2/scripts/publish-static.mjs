/**
 * Copy Vite build output from dist/ into ratzilla2/ for GitHub Pages deploy.
 * Default base path: / (custom domain blackwater-labs.com). See vite.config.ts.
 */
import { cpSync, existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const assetsDir = join(root, "assets");
const cnameSrc = join(root, "CNAME");

if (!existsSync(distDir)) {
  console.error("Run `npm run build` first — dist/ is missing.");
  process.exit(1);
}

/* Drop previous hashed JS/CSS bundles from assets/. */
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (/^index(\.vite)?-[\w-]+\.(js|css)$/.test(name)) {
      unlinkSync(join(assetsDir, name));
    }
  }
}

cpSync(join(distDir, "index.html"), join(root, "index.html"));
cpSync(join(distDir, "404.html"), join(root, "404.html"));

const indexHtml = readFileSync(join(root, "index.html"), "utf8");
if (indexHtml.includes("main.tsx") || indexHtml.includes("/src/")) {
  console.error(
    "ERROR: index.html still references dev source (main.tsx). Build failed.",
  );
  process.exit(1);
}

if (indexHtml.includes("blackwaterinfection")) {
  console.error(
    "ERROR: index.html still references /blackwaterinfection — check vite base path.",
  );
  process.exit(1);
}

console.log("published: index.html, 404.html");

const distAssets = join(distDir, "assets");
if (existsSync(distAssets)) {
  cpSync(distAssets, assetsDir, { recursive: true });
  console.log("published: assets/ (built bundles + static media)");
}

if (existsSync(cnameSrc)) {
  console.log("published: CNAME (custom domain — already at repo root)");
}

const jsMatch = indexHtml.match(/src="([^"]+\.js)"/);

console.log("\n✓ Ready for GitHub Pages. Commit/push these files to repo root:");
console.log("  index.html");
console.log("  404.html");
console.log("  CNAME");
console.log("  assets/   (entire folder)");
if (jsMatch) console.log(`\n  Bundle: ${jsMatch[1]}`);
console.log("\n  Do NOT upload index.vite.html or src/ — dev only.");
console.log("  Live URL: https://blackwater-labs.com/\n");
