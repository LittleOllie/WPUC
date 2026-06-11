/**
 * Refresh image URLs from Alchemy CDN for an existing collection.
 * Usage: node patch-collection-images.mjs --slug ogenies --contract 0x...
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS_ROOT = join(__dirname, "../collections");
const ALCHEMY_KEY = "eadmEoxRFK-i4vfpLIovV";
const CONCURRENCY = 16;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALCHEMY_HOSTS = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
};

async function fetchGateway(contract, id, alchemyHost) {
  const url = `https://${alchemyHost}/nft/v2/${ALCHEMY_KEY}/getNFTMetadata?contractAddress=${contract}&tokenId=${id}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      return data?.media?.[0]?.gateway || "";
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(300 * (attempt + 1));
      continue;
    }
    return "";
  }
  return "";
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

const { slug, contract, network: networkArg } = parseArgs(process.argv.slice(2));
if (!slug || !contract) {
  console.error("Usage: node patch-collection-images.mjs --slug ogenies --contract 0x... [--network base]");
  process.exit(1);
}

const collectionDir = join(COLLECTIONS_ROOT, slug);
const collectionPath = join(collectionDir, "collection.json");
let network = networkArg || "ethereum";
try {
  const collection = JSON.parse(readFileSync(collectionPath, "utf8"));
  network = networkArg || collection.network || "ethereum";
} catch {
  // keep default
}
const alchemyHost = ALCHEMY_HOSTS[network] || ALCHEMY_HOSTS.ethereum;
const imagesPath = join(collectionDir, "images.json");
const images = JSON.parse(readFileSync(imagesPath, "utf8"));
const ids = Object.keys(images).sort((a, b) => Number(a) - Number(b));

console.log(`Patching ${ids.length} images for ${slug}…`);
let done = 0;

await mapPool(ids, async (id) => {
  const gateway = await fetchGateway(contract, id, alchemyHost);
  if (gateway) images[id] = gateway;
  done += 1;
  if (done % 250 === 0 || done === ids.length) console.log(`  ${done}/${ids.length}`);
});

const missing = Object.values(images).filter((url) => !url).length;
writeFileSync(imagesPath, `${JSON.stringify(images, null, 2)}\n`);
console.log(`Updated images.json (${missing} still missing). Re-run shard-collection.mjs next.`);
