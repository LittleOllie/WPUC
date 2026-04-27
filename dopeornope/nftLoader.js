/**
 * Alchemy NFT API key (browser-visible — restrict in Alchemy dashboard: allowed domains + rate limits).
 * Optional override: `window.__ALCHEMY_NFT_KEY__ = "..."` before loading the app (e.g. staging vs prod).
 * If this key was ever shared publicly, rotate it in the Alchemy dashboard.
 */
const DEFAULT_ALCHEMY_NFT_KEY = "XURfWni8o3kPISQb9fAjM";

function alchemyNftKey() {
  if (typeof window !== "undefined" && window.__ALCHEMY_NFT_KEY__) {
    return String(window.__ALCHEMY_NFT_KEY__).trim();
  }
  return DEFAULT_ALCHEMY_NFT_KEY;
}

export function isValidEvmAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value).trim());
}

export function normalizeImageUrl(url) {
  if (!url || typeof url !== "string") return "";

  if (url.startsWith("ipfs://")) {
    const path = url.replace("ipfs://", "");
    return `https://cloudflare-ipfs.com/ipfs/${path}`;
  }

  if (url.startsWith("ar://")) {
    const path = url.replace("ar://", "");
    return `https://arweave.net/${path}`;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return "";
}

function getBestImage(nft) {
  const candidates = [
    nft?.image?.cachedUrl,
    nft?.image?.thumbnailUrl,
    nft?.image?.pngUrl,
    nft?.image?.originalUrl,
    nft?.rawMetadata?.image,
    nft?.metadata?.image,
    nft?.media?.[0]?.gateway,
    nft?.contract?.openSeaMetadata?.imageUrl,
  ];

  for (const item of candidates) {
    const normalized = normalizeImageUrl(item);
    if (normalized) return normalized;
  }

  return "https://picsum.photos/seed/nft-placeholder/400/400";
}

export async function loadNFTsFromWallet(wallet) {
  return await loadNFTsFromWalletOnChain(wallet, "ethereum");
}

export async function loadNFTsFromWalletOnChain(wallet, chain) {
  const cleanWallet = wallet.trim();

  if (!isValidEvmAddress(cleanWallet)) {
    throw new Error("INVALID_WALLET");
  }

  const key = alchemyNftKey();
  const desiredChain = String(chain || "ethereum").trim().toLowerCase();

  let network = "eth-mainnet";
  if (desiredChain === "base") network = "base-mainnet";
  if (desiredChain === "apechain") network = "apechain-mainnet";

  let allOwned = [];
  let pageKey = null;
  let pageCount = 0;
  const MAX_PAGES = 10; // safety limit

  do {
    let url = `https://${network}.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${encodeURIComponent(
      cleanWallet
    )}&withMetadata=true&pageSize=100`;

    if (pageKey) {
      url += `&pageKey=${encodeURIComponent(pageKey)}`;
    }

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("NFT_FETCH_FAILED");
    }

    const data = await res.json();

    const owned = data?.ownedNfts || [];
    allOwned = allOwned.concat(owned);

    pageKey = data?.pageKey || null;
    pageCount++;
  } while (pageKey && pageCount < MAX_PAGES);

  console.log(`Loaded ${allOwned.length} NFTs across ${pageCount} pages from ${desiredChain}`);

  return allOwned
    .map((nft) => {
      const contractAddr = nft?.contract?.address?.toLowerCase() || "";
      const tokenId = String(nft?.tokenId ?? "");
      const chainKey = desiredChain || "ethereum";

      if (!contractAddr || !tokenId) return null;

      return {
        id: `${chainKey}_${contractAddr}_${tokenId}`,
        image: getBestImage(nft),
        collection:
          nft?.collection?.name ||
          nft?.contract?.name ||
          nft?.contract?.openSeaMetadata?.collectionName ||
          "Unknown Collection",
        name: nft?.name || nft?.title || `#${tokenId}`,
        contract: contractAddr,
        tokenId,
        chain: chainKey,
        source: "user",
        votesHot: 0,
        votesCold: 0,
        createdAt: Date.now(),
      };
    })
    .filter(Boolean);
}

export function groupNFTsByCollection(nfts) {
  const groups = {};

  for (const nft of nfts) {
    const collectionName = nft.collection || "Unknown Collection";

    if (!groups[collectionName]) {
      groups[collectionName] = [];
    }

    groups[collectionName].push(nft);
  }

  return groups;
}
