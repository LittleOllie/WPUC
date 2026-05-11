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

  /* Full metadata (not `minimal`) — Alchemy’s fast list omits token media; without it the grid has no image URLs and collection cards have no logo. */
  return fetchNFTsFromWorker({
    wallet,
    chain: "polygon",
    contractAddresses: contract,
    bypassCache: opts.bypassCache === true,
  });
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
