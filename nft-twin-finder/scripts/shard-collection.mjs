/**
 * Split monolithic collection JSON into shard files for faster lookups.
 * Usage: node nft-twin-finder/scripts/shard-collection.mjs long-lost
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SHARD_SIZE = 500;
const FILES = ["similarity", "images", "metadata"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionsRoot = join(__dirname, "../collections");
const slug = process.argv[2];

if (!slug) {
  console.error("Usage: node shard-collection.mjs <slug>");
  process.exit(1);
}

const collectionDir = join(collectionsRoot, slug);
if (!existsSync(collectionDir)) {
  console.error(`Collection not found: ${collectionDir}`);
  process.exit(1);
}

function shardFilename(index) {
  return `shard-${String(index).padStart(4, "0")}.json`;
}

function shardIndex(tokenId) {
  const n = Number(tokenId);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor((n - 1) / SHARD_SIZE) + 1;
}

for (const file of FILES) {
  const sourcePath = join(collectionDir, `${file}.json`);
  if (!existsSync(sourcePath)) {
    console.warn(`Skipping missing ${file}.json`);
    continue;
  }

  const data = JSON.parse(readFileSync(sourcePath, "utf8"));
  const shards = new Map();

  for (const [tokenId, value] of Object.entries(data)) {
    const index = shardIndex(tokenId);
    if (!shards.has(index)) shards.set(index, {});
    shards.get(index)[tokenId] = value;
  }

  const outDir = join(collectionDir, file);
  mkdirSync(outDir, { recursive: true });

  let count = 0;
  for (const [index, shard] of [...shards.entries()].sort((a, b) => a[0] - b[0])) {
    writeFileSync(join(outDir, shardFilename(index)), `${JSON.stringify(shard)}\n`);
    count += 1;
  }

  console.log(`${file}: ${Object.keys(data).length} tokens → ${count} shards`);
}

console.log(`Done: ${slug}`);
