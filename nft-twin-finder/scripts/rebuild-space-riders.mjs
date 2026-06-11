/**
 * Fetch Space Riders traits from Alchemy and rebuild metadata + similarity.
 * Usage: node nft-twin-finder/scripts/rebuild-space-riders.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTraits } from "../lib/traitNormalizer.js";
import { buildSimilarityIndex } from "../lib/similarityEngine.js";
import { resolveWeights } from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_DIR = join(__dirname, "../collections/space-riders");
const CONTRACT = "0x1bf99f0c396e532e6bd31b11108b2ba61976a54b";
const ALCHEMY_KEY = "eadmEoxRFK-i4vfpLIovV";
const SUPPLY = 8888;
const CONCURRENCY = 12;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTokenMeta(id) {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v2/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${CONTRACT}&tokenId=${id}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const raw = data?.metadata || data?.rawMetadata;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return {
        name: parsed?.name || data?.title || `Space Rider #${id}`,
        traits: normalizeTraits(parsed || data),
      };
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(400 * (attempt + 1));
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
      results[index] = await worker(ids[index]);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

const collection = JSON.parse(readFileSync(join(COLLECTION_DIR, "collection.json"), "utf8"));
const ids = Array.from({ length: SUPPLY }, (_, i) => String(i + 1));

console.log(`Fetching Space Riders metadata for ${SUPPLY} tokens…`);
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
const similarity = buildSimilarityIndex(metadata, resolveWeights(collection), 5);

writeFileSync(join(COLLECTION_DIR, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(join(COLLECTION_DIR, "similarity.json"), `${JSON.stringify(similarity, null, 2)}\n`);

const sample = similarity["1"]?.slice(0, 3) || [];
console.log("Token #1 top twins:", sample.map((t) => `#${t.id} (${t.score}%)`).join(", "));
console.log("Done.");
