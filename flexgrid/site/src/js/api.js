/**
 * API layer — NFT fetching from Worker and Zora.
 * No DOM dependencies.
 */

import { getAlchemyNetworkId } from "./alchemyNetworks.js";

export const PRODUCTION_WORKER_BASE = "https://loflexgrid.littleollienft.workers.dev";

/**
 * Client-side cap for `/api/nfts` (single HTTP response).
 * ApeChain uses Moralis with cursor pagination in the Worker (each page can be slow); 35s was too low
 * and caused false timeouts for busy wallets. ETH/Base/Polygon use Alchemy with fewer round-trips.
 */
const NFT_FETCH_TIMEOUT_MS_DEFAULT = 60000;
const NFT_FETCH_TIMEOUT_MS_APECHAIN = 120000;

function nftFetchTimeoutMs(chainParam) {
  return String(chainParam || "").trim().toLowerCase() === "apechain"
    ? NFT_FETCH_TIMEOUT_MS_APECHAIN
    : NFT_FETCH_TIMEOUT_MS_DEFAULT;
}

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
 * NOTE: Do NOT cap `/api/nfts` results client-side.
 * Capping here drops real NFTs/collections and does not reduce Alchemy CU (the Worker already fetched them).
 * We keep a soft warning threshold only for diagnostics.
 */
const NFT_FETCH_SOFT_WARN_THRESHOLD = 3000;

/** In-memory cache: `wallet::chain::contractFilter` → NFT array (defensive copy on read). */
const nftFetchCache = Object.create(null);

/** In-flight dedupe: same key shares one HTTP request (parallel UI calls, duplicate wallets in list). */
const nftFetchInflight = new Map();

// ---------- Local (TTL) cache to reduce repeat loads ----------
const NFT_CACHE_TTL_MS = 5 * 60 * 1000;
const NFT_LS_PREFIX = "flexgrid_nfts_v1::";

function readLocalNftCache(cacheKey) {
  try {
    const raw = localStorage.getItem(NFT_LS_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const ts = Number(parsed?.timestamp || 0);
    const data = parsed?.data;
    if (!ts || Date.now() - ts > NFT_CACHE_TTL_MS) return null;
    return Array.isArray(data) ? data : null;
  } catch (_) {
    return null;
  }
}

function writeLocalNftCache(cacheKey, data) {
  try {
    if (!Array.isArray(data)) return;
    localStorage.setItem(
      NFT_LS_PREFIX + cacheKey,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (_) {
    // ignore quota / blocked storage
  }
}

export function getNftFetchCacheKey(wallet, chain, contractAddresses) {
  const w = String(wallet || "")
    .trim()
    .toLowerCase();
  const c = String(chain || "eth")
    .trim()
    .toLowerCase();
  const f = String(contractAddresses || "")
    .trim()
    .toLowerCase();
  return `${w}::${c}::${f}`;
}

function warnIfHugeNftResponse(list, chainParam) {
  if (!Array.isArray(list)) return;
  if (list.length > NFT_FETCH_SOFT_WARN_THRESHOLD) {
    console.warn("[FlexGrid] Very large NFT response (no cap applied)", {
      chain: chainParam,
      count: list.length,
      threshold: NFT_FETCH_SOFT_WARN_THRESHOLD,
    });
  }
}

/**
 * Single HTTP call to Worker `/api/nfts` (no cache / dedupe).
 * @param {string} [contractAddresses] Optional comma-separated contract filter (matches Worker query param).
 */
async function fetchNFTsFromWorkerHttp({ wallet, chain, contractAddresses }) {
  const chainParam = String(chain || "eth").trim().toLowerCase();
  const networkLabel = flexGridLogNetwork(chainParam);
  const backendHint =
    chainParam === "apechain" ? "Moralis on Worker" : `Alchemy network: ${networkLabel}`;

  let url = `${getWorkerBase()}/api/nfts?owner=${encodeURIComponent(wallet)}&chain=${encodeURIComponent(chainParam)}`;
  const contractFilter = String(contractAddresses || "").trim();
  if (contractFilter) {
    url += `&contractAddresses=${encodeURIComponent(contractFilter.toLowerCase())}`;
  }
  if (typeof arguments[0]?.pageKey === "string" && arguments[0].pageKey.trim()) {
    url += `&pageKey=${encodeURIComponent(arguments[0].pageKey.trim())}`;
  }
  if (arguments[0]?.pageOnly === true) {
    url += `&pageOnly=1`;
  }
  if (arguments[0]?.minimal === true) {
    url += `&minimal=1`;
  }

  const controller = new AbortController();
  const timeoutMs = nftFetchTimeoutMs(chainParam);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (e) {
    if (e?.name === "AbortError") {
      const hint =
        chainParam === "apechain"
          ? "Request timed out (ApeChain can be slow with many NFTs). Try again or load fewer wallets at once."
          : "Request timed out. Try with fewer wallets or try again.";
      throw new Error(hint);
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
  const nextPageKey = typeof json.pageKey === "string" && json.pageKey.trim() ? json.pageKey.trim() : null;
  console.log(`[FlexGrid] Worker /api/nfts OK: ${raw.length} row(s) (${backendHint}, network ${networkLabel})`);
  if (raw.length > 0 && chainParam === "apechain") {
    console.log("[FlexGrid][ApeChain] Sample NFT (Worker payload):", raw[0]);
  }

  return { nfts: raw, pageKey: nextPageKey };
}

/**
 * Fetches NFTs for a wallet via the FlexGrid Worker (Alchemy for ETH/Base/Polygon; Moralis for ApeChain).
 * Uses in-memory cache + in-flight coalescing to avoid duplicate Worker/Alchemy work.
 *
 * @param {{ wallet: string, chain?: string, contractAddresses?: string, bypassCache?: boolean }} opts
 */
export async function fetchNFTsFromWorker(opts = {}) {
  const wallet = String(opts.wallet || "").trim();
  const chainParam = String(opts.chain || "eth").trim().toLowerCase();
  const contractFilter = String(opts.contractAddresses || "").trim();
  const bypassCache = opts.bypassCache === true;
  const cacheKey = getNftFetchCacheKey(wallet, chainParam, contractFilter);

  if (!wallet) {
    console.warn("[FlexGrid] fetchNFTsFromWorker: missing wallet");
    return [];
  }

  if (!bypassCache && nftFetchCache[cacheKey]) {
    const cached = nftFetchCache[cacheKey];
    // Safety: earlier builds accidentally capped at 300; if we see exactly 300, refetch once.
    if (Array.isArray(cached) && cached.length === 300) {
      console.warn("[FlexGrid] Ignoring legacy capped cache entry (300). Refetching.", { cacheKey });
      delete nftFetchCache[cacheKey];
    } else {
    console.log("[FlexGrid] Using cached NFTs", {
      cacheKey,
      count: Array.isArray(cached) ? cached.length : 0,
      time: Date.now(),
    });
    return Array.isArray(cached) ? cached.slice() : [];
    }
  }

  if (!bypassCache) {
    const ls = readLocalNftCache(cacheKey);
    if (ls) {
      console.log("[FlexGrid] Using localStorage cached NFTs", { cacheKey, count: ls.length, time: Date.now() });
      nftFetchCache[cacheKey] = ls.slice();
      return ls.slice();
    }
  }

  const existing = nftFetchInflight.get(cacheKey);
  if (existing) {
    console.warn("[FlexGrid] Coalescing duplicate NFT fetch (same wallet/chain/filter already in flight)", {
      cacheKey,
      time: Date.now(),
    });
    return existing;
  }

  const run = (async () => {
    console.log("[FlexGrid] Fetching NFTs START", {
      owner: wallet,
      chain: chainParam,
      contractFilter: contractFilter || null,
      bypassCache,
      time: Date.now(),
    });
    try {
      const pack = await fetchNFTsFromWorkerHttp({
        wallet,
        chain: chainParam,
        contractAddresses: contractFilter || undefined,
      });
      const raw = pack?.nfts || [];
      warnIfHugeNftResponse(raw, chainParam);
      const limited = Array.isArray(raw) ? raw : [];
      if (!bypassCache) {
        nftFetchCache[cacheKey] = limited.slice();
        writeLocalNftCache(cacheKey, limited);
      }
      console.log("[FlexGrid] Fetching NFTs DONE", {
        cacheKey,
        count: limited.length,
        cached: !bypassCache,
      });
      return limited.slice();
    } catch (err) {
      console.error("[FlexGrid] Fetching NFTs ERROR", { cacheKey, message: err?.message || String(err) });
      throw err;
    } finally {
      nftFetchInflight.delete(cacheKey);
    }
  })();

  nftFetchInflight.set(cacheKey, run);
  return run;
}

/**
 * Paged NFT loading (best for 300–1000+). Uses Worker pageKey support to avoid one massive response.
 * IMPORTANT: This does not change watermark/export logic.
 *
 * @param {{ wallet: string, chain?: string, contractAddresses?: string, minimal?: boolean }} opts
 */
export async function fetchNFTsInBatches(opts = {}) {
  const wallet = String(opts.wallet || "").trim();
  const chainParam = String(opts.chain || "eth").trim().toLowerCase();
  const contractFilter = String(opts.contractAddresses || "").trim();
  const minimal = opts.minimal === true;
  if (!wallet) return [];

  const cacheKey = getNftFetchCacheKey(wallet, chainParam, contractFilter);
  if (nftFetchCache[cacheKey]) return nftFetchCache[cacheKey].slice();
  const ls = readLocalNftCache(cacheKey);
  if (ls) {
    console.log("[FlexGrid] Using localStorage cached NFTs", { cacheKey, count: ls.length, time: Date.now() });
    nftFetchCache[cacheKey] = ls.slice();
    return ls.slice();
  }

  const existing = nftFetchInflight.get(cacheKey);
  if (existing) return existing;

  const run = (async () => {
    if (chainParam === "apechain") {
      console.log("[Moralis Calls Triggered]", { wallet, chain: chainParam, time: Date.now() });
    }
    console.log("[FlexGrid] Fetching NFTs (paged) START", { wallet, chain: chainParam, minimal, time: Date.now() });
    const all = [];
    let pageKey = null;
    let page = 0;
    try {
      do {
        const pack = await fetchNFTsFromWorkerHttp({
          wallet,
          chain: chainParam,
          contractAddresses: contractFilter || undefined,
          pageKey: pageKey || undefined,
          pageOnly: true,
          minimal,
        });
        const rows = Array.isArray(pack?.nfts) ? pack.nfts : [];
        for (const r of rows) all.push(r);
        pageKey = pack?.pageKey || null;
        page++;
        console.log("[FlexGrid] Fetching NFTs (paged) page", { page, got: rows.length, total: all.length, hasMore: !!pageKey });
        // small delay to avoid spikes
        if (pageKey) await new Promise((r) => setTimeout(r, 150));
      } while (pageKey);
      warnIfHugeNftResponse(all, chainParam);
      nftFetchCache[cacheKey] = all.slice();
      writeLocalNftCache(cacheKey, all);
      console.log("[FlexGrid] Fetching NFTs (paged) DONE", { cacheKey, count: all.length });
      return all.slice();
    } finally {
      nftFetchInflight.delete(cacheKey);
    }
  })();

  nftFetchInflight.set(cacheKey, run);
  return run;
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
