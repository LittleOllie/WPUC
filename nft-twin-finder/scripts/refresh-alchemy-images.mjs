/**
 * Refresh collection images from Alchemy CDN (CORS-friendly for canvas export).
 * Usage: node nft-twin-finder/scripts/refresh-alchemy-images.mjs <slug>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTIONS_ROOT = join(__dirname, "../collections");
const ALCHEMY_KEY = "eadmEoxRFK-i4vfpLIovV";

const ALCHEMY_HOSTS = {
  ethereum: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
};

function pickImageUrl(nft) {
  const media = nft?.media?.[0];
  const gateway = media?.gateway || nft?.image?.cachedUrl || "";
  if (gateway.includes("nft-cdn.alchemy.com") || gateway.includes("nft2-cdn.alchemy.com")) {
    return gateway.replace("nft2-cdn.alchemy.com", "nft-cdn.alchemy.com");
  }
  return gateway || media?.thumbnail || media?.raw || "";
}

async function fetchAllImages(contract, network) {
  const host = ALCHEMY_HOSTS[network];
  if (!host) throw new Error(`Unsupported network: ${network}`);

  /** @type {Record<string, string>} */
  const images = {};
  let startToken = "";
  let page = 0;

  while (page < 100) {
    const url = new URL(`https://${host}/nft/v2/${ALCHEMY_KEY}/getNFTsForCollection`);
    url.searchParams.set("contractAddress", contract);
    url.searchParams.set("withMetadata", "true");
    url.searchParams.set("limit", "100");
    if (startToken) url.searchParams.set("startToken", startToken);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
    const data = await res.json();
    const nfts = data.nfts || [];

    for (const nft of nfts) {
      const id = String(nft.id?.tokenId ?? nft.tokenId ?? "");
      if (!id) continue;
      const image = pickImageUrl(nft);
      if (image) images[id] = image;
    }

    console.log(`  page ${page + 1}: ${nfts.length} tokens (${Object.keys(images).length} images)`);
    if (!data.nextToken || !nfts.length) break;
    startToken = data.nextToken;
    page += 1;
  }

  return images;
}

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node refresh-alchemy-images.mjs <slug>");
  process.exit(1);
}

const collectionDir = join(COLLECTIONS_ROOT, slug);
const collection = JSON.parse(readFileSync(join(collectionDir, "collection.json"), "utf8"));
const contract = collection.contract;
const network = collection.network || "ethereum";

if (!contract) throw new Error(`Collection ${slug} has no contract address`);

console.log(`Refreshing ${collection.name} images from Alchemy (${network})…`);
const images = await fetchAllImages(contract, network);
const cdnCount = Object.values(images).filter((u) => u.includes("nft-cdn.alchemy.com")).length;

writeFileSync(join(collectionDir, "images.json"), `${JSON.stringify(images, null, 2)}\n`);
console.log(`Wrote ${Object.keys(images).length} images (${cdnCount} Alchemy CDN)`);
console.log("Done.");
