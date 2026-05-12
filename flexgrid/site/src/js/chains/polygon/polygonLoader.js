/**
 * Polygon collection-scoped NFT loading (owner + contract only).
 *
 * Uses the same **one-shot** Worker path as ETH/Base (`fetchNFTsFromWorker`): the Worker
 * paginates Alchemy internally in one browser → Worker round-trip. The previous
 * `fetchNFTsInBatches` (pageOnly) path added extra HTTP hops + 150ms pauses per page,
 * which made even ~85 NFTs feel sluggish.
 */

import { fetchNFTsFromWorker } from "../../api.js";
import { normalizePolygonContract } from "./polygonService.js";

const POLYGON_WALLET_PARALLEL = 3;

/**
 * @param {{ wallet: string, contract: string, bypassCache?: boolean }} opts
 * @returns {Promise<any[]>}
 */
export async function loadPolygonWalletContractNfts(opts = {}) {
  const wallet = String(opts.wallet || "").trim();
  const contract = normalizePolygonContract(opts.contract);
  if (!wallet || !contract) return [];

  // Fast path: `thumbOnly` skips heavy media_items/normalizeMetadata expansion in Alchemy.
  // If it returns NFTs without enough image candidates, we immediately retry with full metadata.
  const bypassCache = opts.bypassCache === true;

  const quick = await fetchNFTsFromWorker({
    wallet,
    chain: "polygon",
    contractAddresses: contract,
    bypassCache,
    thumbOnly: true,
  });

  const sample = Array.isArray(quick) ? quick : [];
  const artCount = sample.slice(0, 10).reduce((acc, n) => {
    if (!n || typeof n !== "object") return acc;
    const has =
      (typeof n.image === "string" && n.image.trim()) ||
      (typeof n.image_url === "string" && n.image_url.trim()) ||
      (typeof n.tokenUri?.gateway === "string" && n.tokenUri.gateway.trim()) ||
      (typeof n?.metadata?.image === "string" && n.metadata.image.trim()) ||
      (typeof n?.rawMetadata?.image === "string" && n.rawMetadata.image.trim()) ||
      (Array.isArray(n?.media) && n.media.length > 0) ||
      (typeof n?.media?.[0]?.raw === "string" && n.media[0].raw.trim());
    return acc + (has ? 1 : 0);
  }, 0);

  // Only fall back to full metadata when the quick response provides *no* usable art hints.
  // Otherwise we keep the fast path (speed) and let the in-grid image loader resolve media lazily.
  const needFallback = sample.length > 0 && artCount === 0;
  if (needFallback) {
    return fetchNFTsFromWorker({
      wallet,
      chain: "polygon",
      contractAddresses: contract,
      bypassCache,
    });
  }

  return sample;
}

/**
 * Loads multiple wallets for the same contract (up to `POLYGON_WALLET_PARALLEL` at a time),
 * matching ETH/Base batching — still contract-scoped so payloads stay bounded.
 *
 * @param {{ wallets: string[], contract: string, onProgress?: (info: { batchIndex: number, batchSize: number, total: number, walletCount: number }) => void, bypassCache?: boolean }} opts
 */
export async function loadPolygonWalletsContractSequential(opts = {}) {
  const wallets = Array.isArray(opts.wallets) ? opts.wallets.map((w) => String(w || "").trim()).filter(Boolean) : [];
  const contract = normalizePolygonContract(opts.contract);
  if (!wallets.length || !contract) return [];

  const all = [];
  let batchIdx = 0;
  for (let i = 0; i < wallets.length; i += POLYGON_WALLET_PARALLEL) {
    const slice = wallets.slice(i, i + POLYGON_WALLET_PARALLEL);
    batchIdx++;
    const results = await Promise.all(
      slice.map((w) =>
        loadPolygonWalletContractNfts({
          wallet: w,
          contract,
          bypassCache: opts.bypassCache === true,
        })
      )
    );
    for (const nfts of results) {
      for (const row of nfts || []) all.push(row);
    }
    if (typeof opts.onProgress === "function") {
      try {
        opts.onProgress({
          batchIndex: batchIdx,
          batchSize: slice.length,
          total: all.length,
          walletCount: wallets.length,
        });
      } catch (_) {}
    }
  }
  return all;
}
