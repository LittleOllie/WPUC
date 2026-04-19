/**
 * API layer — NFT fetching from Worker and Zora.
 * No DOM dependencies.
 */

import { getAlchemyNetworkId } from "./alchemyNetworks.js";

export const PRODUCTION_WORKER_BASE = "https://loflexgrid.littleollienft.workers.dev";
const NFT_FETCH_TIMEOUT_MS = 35000;

/**
 * Worker origin for `/api/*` and `/img` after config loads.
 * `loadConfig()` picks the first working `/api/config/flex-grid` URL (on localhost, production is tried first).
 */
let resolvedWorkerApiOrigin = null;

export function setResolvedWorkerApiOrigin(origin) {
  const o = origin && String(origin).trim().replace(/\/$/, "");
  resolvedWorkerApiOrigin = o || null;
}

export function getWorkerBase() {
  if (resolvedWorkerApiOrigin) return resolvedWorkerApiOrigin;
  return PRODUCTION_WORKER_BASE;
}

function flexGridLogNetwork(chainParam) {
  try {
    return getAlchemyNetworkId(chainParam);
  } catch {
    return String(chainParam || "");
  }
}

/**
 * Fetches NFTs for a wallet via the FlexGrid Worker (Alchemy for ETH/Base/Polygon; Moralis for ApeChain).
 */
export async function fetchNFTsFromWorker({ wallet, chain }) {
  const chainParam = String(chain || "eth").trim().toLowerCase();
  const networkLabel = flexGridLogNetwork(chainParam);
  const backendHint =
    chainParam === "apechain" ? "Moralis on Worker" : `Alchemy network: ${networkLabel}`;

  console.log(`[FlexGrid] Chain selected: ${chainParam} (${backendHint})`);
  console.log(`[FlexGrid] Fetching NFTs for ${wallet} on chain=${chainParam}`);

  const url = `${getWorkerBase()}/api/nfts?owner=${encodeURIComponent(wallet)}&chain=${encodeURIComponent(chainParam)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NFT_FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error("Request timed out. Try with fewer wallets or try again.");
    }
    throw new Error(e?.message || "NFT fetch failed");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error || `NFT fetch failed (${res.status})`;
    throw new Error(msg);
  }

  let json;
  try {
    json = await res.json();
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  const raw = json.nfts || [];
  console.log(`[FlexGrid] Found ${raw.length} NFT(s) on ${chainParam}`);
  if (raw.length > 0) {
    console.log("[FlexGrid] NFT sample:", raw[0]);
  }
  if (chainParam === "apechain" && raw.length > 0) {
    console.log("[FlexGrid][ApeChain] Sample normalized NFT (Worker payload):", raw[0]);
  }

  return raw;
}

export async function fetchNFTsFromZora({ wallet, contractAddress }) {
  const query = `query($owner: String!, $contract: String!, $after: String) {
    tokens(
      networks: [{network: ETHEREUM, chain: MAINNET}]
      pagination: {limit: 100, after: $after}
      where: {ownerAddresses: [$owner], collectionAddresses: [$contract]}
    ) {
      nodes {
        token {
          collectionAddress
          tokenId
          name
          image { url }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const all = [];
  let after = null;
  for (let page = 0; page < 25; page++) {
    const res = await fetch("https://api.zora.co/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { owner: wallet, contract: contractAddress, after },
      }),
    });
    if (!res.ok) break;
    const json = await res.json().catch(() => ({}));
    const nodes = json?.data?.tokens?.nodes ?? [];
    for (const n of nodes) {
      const t = n?.token;
      if (!t?.tokenId) continue;
      const img = t?.image;
      const imgUrl = typeof img === "object" && img ? img?.url : null;
      all.push({
        contract: { address: (t.collectionAddress || contractAddress).toLowerCase(), name: "" },
        contractAddress: (t.collectionAddress || contractAddress).toLowerCase(),
        tokenId: String(t.tokenId),
        name: t?.name || `#${t.tokenId}`,
        image: imgUrl ? { cachedUrl: imgUrl, originalUrl: imgUrl } : null,
      });
    }
    const hasNext = json?.data?.tokens?.pageInfo?.hasNextPage;
    if (!hasNext) break;
    after = json?.data?.tokens?.pageInfo?.endCursor;
  }
  return all;
}

/**
 * Contract-level collection image via Worker (Alchemy for ETH/Base/Polygon; Moralis for ApeChain).
 * Returns { rawLogoUrl: string | null, error?: string }.
 */
export async function fetchContractMetadataFromWorker({ contract, chain }) {
  const chainParam = String(chain || "eth").trim().toLowerCase();
  const addr = String(contract || "").trim();
  const url = `${getWorkerBase()}/api/contract-metadata?contract=${encodeURIComponent(addr)}&chain=${encodeURIComponent(chainParam)}`;
  console.log("[FlexGrid] contract-metadata request:", chainParam, addr);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 22000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      return { rawLogoUrl: null, error: "Request timed out" };
    }
    return { rawLogoUrl: null, error: e?.message || "Fetch failed" };
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { rawLogoUrl: null, error: json?.error || `Contract metadata failed (${res.status})` };
  }
  const rawLogoUrl =
    typeof json.rawLogoUrl === "string" && json.rawLogoUrl.trim() ? json.rawLogoUrl.trim() : null;
  if (chainParam === "apechain") {
    console.log("[FlexGrid][ApeChain] contract-metadata rawLogoUrl:", rawLogoUrl ? "(set)" : "(null)");
  }
  return { rawLogoUrl };
}

/** @deprecated Use getWorkerBase() after config load. */
export const WORKER_BASE = PRODUCTION_WORKER_BASE;
