/**
 * Re-fetch DropDed Gorgez traits from drop.dedgorgez.com and rebuild similarity.json.
 * Usage: node nft-twin-finder/scripts/rebuild-ddg.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTraits } from "../lib/traitNormalizer.js";
import { buildSimilarityIndex } from "../lib/similarityEngine.js";
import { resolveWeights } from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_DIR = join(__dirname, "../collections/dropded-gorgez");
const SUPPLY = 8888;
const CONCURRENCY = 40;

async function fetchTokenMeta(id) {
  const res = await fetch(`https://drop.dedgorgez.com/${id}`);
  if (!res.ok) throw new Error(`Token ${id}: HTTP ${res.status}`);
  const json = await res.json();
  return {
    name: json.name || `Gorgez ${id}`,
    traits: normalizeTraits(json),
  };
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
const images = JSON.parse(readFileSync(join(COLLECTION_DIR, "images.json"), "utf8"));
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
const similarity = buildSimilarityIndex(metadata, resolveWeights(collection), 5);

writeFileSync(join(COLLECTION_DIR, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(join(COLLECTION_DIR, "similarity.json"), `${JSON.stringify(similarity, null, 2)}\n`);

const sample = similarity["334"]?.slice(0, 5) || [];
console.log("Token #334 top twins:", sample.map((t) => `#${t.id} (${t.score}%)`).join(", "));
console.log("Done.");
