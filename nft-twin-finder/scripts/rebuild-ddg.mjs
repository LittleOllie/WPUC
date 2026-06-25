/**
 * Re-fetch DropDed Gorgez traits from drop.dedgorgez.com and rebuild similarity.
 * Usage: node nft-twin-finder/scripts/rebuild-ddg.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTraits } from "../lib/traitNormalizer.js";
import { buildSimilarityIndex } from "../lib/similarityEngine.js";
import { resolveWeights } from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_DIR = join(__dirname, "../collections/dropded-gorgez");
const SUPPLY = 8888;
const CONCURRENCY = 40;
const SHARD_SIZE = 500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shardFilename(index) {
  return `shard-${String(index).padStart(4, "0")}.json`;
}

function shardIndex(tokenId) {
  const n = Number(tokenId);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor((n - 1) / SHARD_SIZE) + 1;
}

function writeSimilarityShards(similarity) {
  const outDir = join(COLLECTION_DIR, "similarity");
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

async function fetchTokenMeta(id) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(`https://drop.dedgorgez.com/${id}`);
    if (res.ok) {
      const json = await res.json();
      return {
        name: json.name || `Gorgez ${id}`,
        traits: normalizeTraits(json),
      };
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(300 * (attempt + 1));
      continue;
    }
    throw new Error(`Token ${id}: HTTP ${res.status}`);
  }
  throw new Error(`Token ${id}: failed after retries`);
}

async function mapPool(ids, worker) {
  const results = new Array(ids.length);
  let next = 0;

  async function run() {
    while (next < ids.length) {
      const index = next++;
      const id = ids[index];
      results[index] = await worker(id);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

const collection = JSON.parse(readFileSync(join(COLLECTION_DIR, "collection.json"), "utf8"));
const ids = Array.from({ length: SUPPLY }, (_, i) => String(i + 1));

console.log(`Fetching metadata for ${SUPPLY} tokens…`);
const started = Date.now();
let done = 0;

const entries = await mapPool(ids, async (id) => {
  const meta = await fetchTokenMeta(id);
  done += 1;
  if (done % 200 === 0 || done === SUPPLY) {
    console.log(`  ${done}/${SUPPLY}`);
  }
  return [id, meta];
});

const metadata = Object.fromEntries(entries);
const emptyTraits = Object.values(metadata).filter((entry) => !Object.keys(entry.traits).length).length;
console.log(`Fetched in ${((Date.now() - started) / 1000).toFixed(1)}s (${emptyTraits} empty trait sets)`);

console.log("Building similarity index…");
const weights = resolveWeights(collection);
const similarity = buildSimilarityIndex(metadata, weights, 5);

writeFileSync(join(COLLECTION_DIR, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(join(COLLECTION_DIR, "similarity.json"), `${JSON.stringify(similarity, null, 2)}\n`);
const shardCount = writeSimilarityShards(similarity);

collection.similarityCalculatedAt = new Date().toISOString();
writeFileSync(join(COLLECTION_DIR, "collection.json"), `${JSON.stringify(collection, null, 2)}\n`);

const m3473 = metadata["3473"]?.traits || {};
const sample3473 = similarity["3473"]?.slice(0, 3) || [];
console.log("#3473 traits:", m3473);
console.log("#3473 top twins:", sample3473.map((t) => `#${t.id} (${t.score}%) — ${t.summary}`).join(", "));
console.log(`Wrote similarity shards: ${shardCount}`);
console.log("Done.");
