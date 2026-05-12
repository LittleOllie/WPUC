import { getWorkerBase } from "./api.js";

/** Fetch Solana collections via Worker `/api/solana-nfts` and return FlexGrid-normalizable NFTs. */
export async function fetchSolanaNFTsFromWorker({ wallet }) {
  const owner = String(wallet || "").trim();
  if (!owner) return [];

  const url = `${getWorkerBase()}/api/solana-nfts?owner=${encodeURIComponent(owner)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") throw new Error("Request timed out. Try again.");
    throw new Error(e?.message || "Solana NFT fetch failed");
  } finally {
    clearTimeout(timeoutId);
  }

  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }

  if (!res.ok || json?.success !== true) {
    const msg = json?.error || `Solana NFT fetch failed (${res.status})`;
    throw new Error(msg);
  }

  const rows = Array.isArray(json?.nfts) ? json.nfts : [];
  return rows
    .map((r) => {
      const key = (r?.collectionKey || "").toString().trim();
      const display = (r?.collectionName || "Unknown Collection").toString().trim() || "Unknown Collection";
      const contractAddress = `sol:${key.toLowerCase()}`;
      const tokenId = (r?.tokenId || r?.id || "").toString().trim() || "unknown";
      const name = (r?.name || r?.title || "").toString().trim() || "Unnamed NFT";
      const imageCandidates = Array.isArray(r?.imageCandidates) ? r.imageCandidates.filter(Boolean) : [];
      const image = (r?.image || r?.imageUrl || (imageCandidates[0] || "")).toString().trim() || null;
      const collectionLogo = (r?.collectionLogo || "").toString().trim() || null;
      return {
        contractAddress,
        tokenId,
        name,
        image,
        imageCandidates,
        _collectionTotalCount: r?._collectionTotalCount,
        qualityScore: r?.qualityScore,
        contract: { address: contractAddress, name: display, imageUrl: collectionLogo },
        collection: { address: contractAddress, name: display, imageUrl: collectionLogo },
        tokenType: "SOLANA",
      };
    })
    .filter((x) => x && x.name && x.image);
}

