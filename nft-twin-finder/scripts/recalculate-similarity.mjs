/**
 * Re-run the similarity engine using existing metadata (no re-import).
 * Usage:
 *   node nft-twin-finder/scripts/recalculate-similarity.mjs <slug> [--shard]
 *   node nft-twin-finder/scripts/recalculate-similarity.mjs --all [--shard]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSimilarityIndex } from "../lib/similarityEngine.js";
import { resolveWeights } from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const collectionsRoot = join(__dirname, "../collections");
const SHARD_SIZE = 500;

const args = process.argv.slice(2);
const shardAfter = args.includes("--shard");
const slugArg = args.includes("--all") ? "--all" : args.find((arg) => !arg.startsWith("--"));

function shardFilename(index) {
  return `shard-${String(index).padStart(4, "0")}.json`;
}

function shardIndex(tokenId) {
  const n = Number(tokenId);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor((n - 1) / SHARD_SIZE) + 1;
}

function loadKeyedJson(collectionDir, file) {
  const monoPath = join(collectionDir, `${file}.json`);
  if (existsSync(monoPath)) {
    return JSON.parse(readFileSync(monoPath, "utf8"));
  }

  const shardDir = join(collectionDir, file);
  if (!existsSync(shardDir)) {
    throw new Error(`Missing ${file}.json and ${file}/ shards in ${collectionDir}`);
  }

  const merged = {};
  for (const name of readdirSync(shardDir).sort()) {
    if (!name.startsWith("shard-") || !name.endsWith(".json")) continue;
    const shard = JSON.parse(readFileSync(join(shardDir, name), "utf8"));
    Object.assign(merged, shard);
  }

  if (!Object.keys(merged).length) {
    throw new Error(`No shard data found for ${file} in ${collectionDir}`);
  }

  return merged;
}

function writeSimilarityShards(collectionDir, similarity) {
  const outDir = join(collectionDir, "similarity");
  mkdirSync(outDir, { recursive: true });
  const shards = new Map();

  for (const [tokenId, value] of Object.entries(similarity)) {
    const index = shardIndex(tokenId);
    if (!shards.has(index)) shards.set(index, {});
    shards.get(index)[tokenId] = value;
  }

  for (const [index, shard] of [...shards.entries()].sort((a, b) => a[0] - b[0])) {
    writeFileSync(join(outDir, shardFilename(index)), `${JSON.stringify(shard)}\n`);
  }

  return shards.size;
}

function recalculateSlug(slug) {
  const collectionDir = join(collectionsRoot, slug);
  const collectionPath = join(collectionDir, "collection.json");

  if (!existsSync(collectionPath)) {
    throw new Error(`Collection not found: ${slug}`);
  }

  const collection = JSON.parse(readFileSync(collectionPath, "utf8"));
  const weights = resolveWeights(collection);
  const metadata = loadKeyedJson(collectionDir, "metadata");
  const tokenCount = Object.keys(metadata).length;

  console.log(`Recalculating ${slug} (${tokenCount} tokens)…`);
  const started = Date.now();
  const similarity = buildSimilarityIndex(metadata, weights, 5, {
    onProgress: (done, total) => {
      if (done % 500 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total}`);
      }
    },
  });
  process.stdout.write("\n");

  collection.similarityCalculatedAt = new Date().toISOString();
  writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
  writeFileSync(join(collectionDir, "similarity.json"), `${JSON.stringify(similarity, null, 2)}\n`);

  if (shardAfter) {
    const shardCount = writeSimilarityShards(collectionDir, similarity);
    console.log(`  Sharded similarity → ${shardCount} files`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const sample = similarity["1"]?.slice(0, 3) || similarity["0"]?.slice(0, 3) || [];
  console.log(`  Done in ${elapsed}s. Sample twins:`, sample.map((t) => `#${t.id} (${t.score}%)`).join(", "));
}

function main() {
  if (!slugArg) {
    console.error("Usage: node recalculate-similarity.mjs <slug> [--shard]");
    console.error("       node recalculate-similarity.mjs --all [--shard]");
    process.exit(1);
  }

  if (slugArg === "--all") {
    const index = JSON.parse(readFileSync(join(collectionsRoot, "index.json"), "utf8"));
    for (const entry of index) {
      recalculateSlug(entry.slug);
    }
    console.log("All collections recalculated.");
    return;
  }

  recalculateSlug(slugArg);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
