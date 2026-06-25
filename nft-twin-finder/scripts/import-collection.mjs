/**
 * Import a collection from Alchemy into nft-twin-finder/collections/{slug}/.
 * Usage:
 *   node nft-twin-finder/scripts/import-collection.mjs \
 *     --name "Long Lost" --slug long-lost \
 *     --contract 0x... --supply 10000
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTraits } from "../lib/traitNormalizer.js";
import { buildSimilarityIndex } from "../lib/similarityEngine.js";
import { WEIGHT_PROFILE_DEFAULT, resolveWeights } from "../lib/weightProfiles.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS_ROOT = join(__dirname, "../collections");
const ALCHEMY_KEY = "eadmEoxRFK-i4vfpLIovV";
const CONCURRENCY = 12;
const METADATA_CONCURRENCY = 6;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    out[name] = argv[i + 1];
    i += 1;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";
  let s = url.trim();
  if (!s) return "";
  if (s.startsWith("ipfs://")) return `https://gateway.pinata.cloud/ipfs/${s.slice(7)}`;
  if (s.startsWith("ar://")) return `https://arweave.net/${s.slice(5)}`;
  if (s.startsWith("//")) return `https:${s}`;
  return s;
}

function isIpfsHttpUrl(url) {
  return /\/ipfs\//i.test(url);
}

/** Prefer direct HTTPS/CDN URLs over slow IPFS gateways from Alchemy. */
function pickBestImageUrl(...urls) {
  const normalized = urls.map(normalizeImageUrl).filter(Boolean);
  const direct = normalized.find((url) => !isIpfsHttpUrl(url));
  return direct || normalized[0] || "";
}

function resolveMetadataUrl(template, id) {
  return template.replaceAll("{id}", String(id));
}

/** Normalize Alchemy getNFTMetadata payloads (legacy + current shapes). */
function parseAlchemyMetadata(data) {
  let parsed = data?.metadata || data?.rawMetadata || data?.raw?.metadata;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }
  if (!parsed.name && data?.name) {
    parsed = { ...parsed, name: data.name };
  }
  if (!parsed.image && data?.image) {
    parsed = { ...parsed, image: data.image };
  }
  return parsed;
}

function imageFromAlchemyMetadata(data, parsed) {
  const imageField = parsed?.image ?? data?.image;
  if (typeof imageField === "string") {
    return normalizeImageUrl(imageField);
  }
  if (imageField && typeof imageField === "object") {
    return pickBestImageUrl(
      imageField.originalUrl,
      imageField.cachedUrl,
      imageField.pngUrl,
      imageField.thumbnailUrl,
    );
  }
  return pickBestImageUrl(data?.media?.[0]?.raw, data?.media?.[0]?.gateway);
}

async function fetchMetadataRecord(metadataUrl) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const res = await fetch(metadataUrl);
      if (res.ok) return res.json();
      if (res.status === 429 || res.status >= 500) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      throw new Error(`${metadataUrl}: HTTP ${res.status}`);
    } catch (error) {
      if (attempt >= 5) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw new Error(`${metadataUrl}: failed after retries`);
}

async function fetchTokenRecord(contract, id, { alchemyHost, metadataUrlTemplate }) {
  if (metadataUrlTemplate) {
    const parsed = await fetchMetadataRecord(resolveMetadataUrl(metadataUrlTemplate, id));
    return {
      name: parsed?.name || `Token #${id}`,
      traits: normalizeTraits(parsed, { slug }),
      image: normalizeImageUrl(parsed?.image) || "",
    };
  }

  const url = `https://${alchemyHost}/nft/v2/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${contract}&tokenId=${id}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const parsed = parseAlchemyMetadata(data);
      const image = imageFromAlchemyMetadata(data, parsed);
      return {
        name: parsed?.name || data?.title || data?.name || `Token #${id}`,
        traits: normalizeTraits(parsed, { slug }),
        image,
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

async function mapPool(ids, worker, concurrency = CONCURRENCY) {
  const results = new Array(ids.length);
  let next = 0;

  async function run() {
    while (next < ids.length) {
      const index = next++;
      results[index] = await worker(ids[index]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

const args = parseArgs(process.argv.slice(2));
const name = args.name;
const slug = args.slug;
const contract = args.contract?.toLowerCase();
const supply = Number(args.supply);
const startId = Number(args.start ?? 1);
const network = String(args.network || "ethereum").trim().toLowerCase();
const metadataUrlTemplate = args["metadata-url"] || "";

const ALCHEMY_HOSTS = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
};

if (
  !name ||
  !slug ||
  !contract ||
  !/^0x[a-f0-9]{40}$/.test(contract) ||
  !supply ||
  !Number.isFinite(startId) ||
  (!metadataUrlTemplate && !ALCHEMY_HOSTS[network])
) {
  console.error(
    "Usage: node import-collection.mjs --name \"Collection\" --slug slug --contract 0x... --supply 8888 [--start 0] [--network ethereum|base|apechain] [--metadata-url https://.../{id}.json]",
  );
  process.exit(1);
}

const collectionDir = join(COLLECTIONS_ROOT, slug);
mkdirSync(collectionDir, { recursive: true });

const ids = Array.from({ length: supply }, (_, i) => String(startId + i));
const lastId = startId + supply - 1;
console.log(`Importing ${name} (#${startId}–#${lastId}, ${supply} tokens)…`);

const started = Date.now();
let done = 0;
const fetchOptions = {
  alchemyHost: ALCHEMY_HOSTS[network],
  metadataUrlTemplate,
};

const poolSize = metadataUrlTemplate ? METADATA_CONCURRENCY : CONCURRENCY;
const entries = await mapPool(ids, async (id) => {
  const record = await fetchTokenRecord(contract, id, fetchOptions);
  done += 1;
  if (done % 250 === 0 || done === supply) {
    console.log(`  ${done}/${supply}`);
  }
  return [id, record];
}, poolSize);

const metadata = {};
const images = {};
for (const [id, record] of entries) {
  metadata[id] = { name: record.name, traits: record.traits };
  images[id] = record.image;
}

const emptyTraits = Object.values(metadata).filter((entry) => !Object.keys(entry.traits).length).length;
const missingImages = Object.values(images).filter((url) => !url).length;
console.log(
  `Fetched in ${((Date.now() - started) / 1000).toFixed(1)}s (${emptyTraits} empty traits, ${missingImages} missing images)`,
);

const collection = {
  name,
  slug,
  supply,
  contract,
  network,
  weightProfile: WEIGHT_PROFILE_DEFAULT,
  similarityCalculatedAt: new Date().toISOString(),
};

console.log("Building similarity index…");
const weights = resolveWeights(collection);
const similarity = buildSimilarityIndex(metadata, weights, 5);

writeFileSync(join(collectionDir, "collection.json"), `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(join(collectionDir, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
writeFileSync(join(collectionDir, "images.json"), `${JSON.stringify(images, null, 2)}\n`);
writeFileSync(join(collectionDir, "similarity.json"), `${JSON.stringify(similarity, null, 2)}\n`);

const indexPath = join(COLLECTIONS_ROOT, "index.json");
const index = JSON.parse(readFileSync(indexPath, "utf8"));
if (!index.some((entry) => entry.slug === slug)) {
  index.push({ slug, name });
  index.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
}

const sample = similarity["1"]?.slice(0, 3) || [];
console.log(`Added ${slug}. Token #1 twins:`, sample.map((t) => `#${t.id} (${t.score}%)`).join(", "));
console.log("Done.");
