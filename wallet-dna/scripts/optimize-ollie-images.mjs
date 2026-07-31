#!/usr/bin/env node
/**
 * Generate WebP display assets from public/ollie/*.png (keeps PNGs for export).
 * Run: node scripts/optimize-ollie-images.mjs
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ollieDir = join(root, "public/ollie");
const reportPath = join(root, "public/ollie/OPTIMISATION_REPORT.txt");

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

const pngFiles = readdirSync(ollieDir).filter((f) => f.toLowerCase().endsWith(".png"));
let pngTotal = 0;
let webpTotal = 0;
const lines = ["Wallet DNA Ollie asset optimisation", `Generated: ${new Date().toISOString()}`, ""];

for (const file of pngFiles.sort()) {
  const input = join(ollieDir, file);
  const output = join(ollieDir, file.replace(/\.png$/i, ".webp"));
  const pngSize = statSync(input).size;
  pngTotal += pngSize;

  const meta = await sharp(input).metadata();
  const hasAlpha = meta.hasAlpha === true;

  await sharp(input)
    .webp({
      quality: 92,
      alphaQuality: 100,
      lossless: false,
      effort: 6,
    })
    .toFile(output);

  const webpSize = statSync(output).size;
  webpTotal += webpSize;
  const saved = ((1 - webpSize / pngSize) * 100).toFixed(1);

  lines.push(
    `${file}: ${formatBytes(pngSize)} → ${file.replace(/\.png$/i, ".webp")}: ${formatBytes(webpSize)} (${saved}% smaller) | ${meta.width}x${meta.height} alpha=${hasAlpha}`,
  );
}

lines.push("");
lines.push(`PNG total (kept for export): ${formatBytes(pngTotal)}`);
lines.push(`WebP total (display): ${formatBytes(webpTotal)}`);
lines.push(`Combined on disk: ${formatBytes(pngTotal + webpTotal)}`);
lines.push(`Display bandwidth saved vs PNG-only: ${formatBytes(pngTotal - webpTotal)} (${((1 - webpTotal / pngTotal) * 100).toFixed(1)}%)`);

writeFileSync(reportPath, lines.join("\n") + "\n");
console.log(lines.join("\n"));
