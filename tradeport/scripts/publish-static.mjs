/**
 * Copy Vite build output from dist/ to tradeport/ root so the app is served at /tradeport/
 */
import { cpSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const tradeportDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(tradeportDir, "dist");
const assetsDir = join(tradeportDir, "assets");

/** Remove old hashed bundles so deploy only serves the latest build. */
if (existsSync(assetsDir)) {
  for (const name of readdirSync(assetsDir)) {
    if (/^index(\.vite)?-[\w-]+\.(js|css)$/.test(name)) {
      unlinkSync(join(assetsDir, name));
    }
  }
}

const entries = ["index.html", "404.html", "favicon.svg", "icons.svg", "assets"];

for (const name of entries) {
  const from = join(distDir, name);
  if (!existsSync(from)) {
    console.warn(`skip (missing): ${name}`);
    continue;
  }
  cpSync(from, join(tradeportDir, name), { recursive: true });
  console.log(`published: ${name}`);
}
