/**
 * Refresh Koala Day images from Alchemy CDN (reliable) instead of Pinata IPFS.
 * Usage: node nft-twin-finder/scripts/refresh-koala-day-images.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLLECTION_DIR = join(__dirname, "../collections/koala-day");
const ALCHEMY_KEY = "eadmEoxRFK-i4vfpLIovV";
const CONTRACT = "0x50372c1153170840ecce9129c6cc70b912f34273";
const IMAGE_IPFS_CID = "bafybeigjeggkcyj6wyv667ejt4zf2iveldvgjjkq2fj5dn6u7ttjmpkrcy";

function pickImageUrl(nft) {
  const media = nft?.media?.[0];
  const gateway = media?.gateway || nft?.image?.cachedUrl || "";
  if (gateway.includes("nft-cdn.alchemy.com") || gateway.includes("res.cloudinary.com")) {
    return gateway;
  }

  const raw = media?.raw || "";
  if (typeof raw === "string" && raw.startsWith("ipfs://")) {
    return `https://alchemy.mypinata.cloud/ipfs/${raw.slice(7)}`;
  }

  const ipfsPath = extractIpfsPath(gateway);
  if (ipfsPath) {
    return `https://alchemy.mypinata.cloud/ipfs/${ipfsPath}`;
  }

  return gateway || media?.thumbnail || raw || "";
}

/** @param {string} url */
function extractIpfsPath(url) {
  const match = String(url).match(/\/ipfs\/(.+)$/i);
  return match ? match[1] : null;
}

async function fetchAllNfts() {
  /** @type {Record<string, string>} */
  const images = {};
  let startToken = "";
  let page = 0;

  while (page < 50) {
    const url = new URL(`https://base-mainnet.g.alchemy.com/nft/v2/${ALCHEMY_KEY}/getNFTsForCollection`);
    url.searchParams.set("contractAddress", CONTRACT);
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

    console.log(`  page ${page + 1}: ${nfts.length} tokens (${Object.keys(images).length} images total)`);
    if (!data.nextToken || !nfts.length) break;
    startToken = data.nextToken;
    page += 1;
  }

  return images;
}

const collectionPath = join(COLLECTION_DIR, "collection.json");
const imagesPath = join(COLLECTION_DIR, "images.json");
const collection = JSON.parse(readFileSync(collectionPath, "utf8"));

console.log("Fetching Koala Day images from Alchemy CDN…");
const images = await fetchAllNfts();
const missing = Object.keys(images).filter((id) => !images[id]).length;
const alchemyCdn = Object.values(images).filter((url) => url.includes("nft-cdn.alchemy.com")).length;

collection.imageIpfsCid = IMAGE_IPFS_CID;
writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(imagesPath, `${JSON.stringify(images, null, 2)}\n`);

console.log(`Wrote ${Object.keys(images).length} images (${alchemyCdn} Alchemy CDN, ${missing} missing)`);
console.log("Sample #595:", images["595"]);
console.log("Done.");
