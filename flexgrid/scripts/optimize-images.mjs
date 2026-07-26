/**
 * Optimise large FlexGrid decorative PNGs → WebP (keeps originals as fallback).
 * Run: npm run build:images
 */
import sharp from "sharp";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imgDir = join(__dirname, "../site/src/assets/images");

const TARGETS = ["lo1.png", "header.png", "tile.png", "LO.png", "dad.png", "FG.png"];

async function optimise(name) {
  const src = join(imgDir, name);
  try {
    statSync(src);
  } catch {
    console.warn("Skip missing", name);
    return;
  }
  const before = statSync(src).size;
  const base = name.replace(/\.png$/i, "");
  const outWebp = join(imgDir, `${base}.webp`);

  await sharp(src).webp({ quality: 82, effort: 4 }).toFile(outWebp);

  const after = statSync(outWebp).size;
  console.log(`${name}: ${(before / 1024).toFixed(0)} KB → ${base}.webp ${(after / 1024).toFixed(0)} KB`);
}

for (const name of TARGETS) {
  await optimise(name);
}

console.log("Done.");
