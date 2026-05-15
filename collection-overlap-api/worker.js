/**
 * Little Ollie Labs — Collection Overlap API only.
 * GET /api/collection-overlap — Alchemy getOwnersForContract (ETH → Base → ApeChain). No secrets in browser.
 * GET /api/collection-overlap-solana — Helius DAS (Solana only; separate from EVM).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const ALCHEMY_ETH_HOST = "eth-mainnet.g.alchemy.com";
const ALCHEMY_BASE_HOST = "base-mainnet.g.alchemy.com";
const ALCHEMY_APE_HOST = "apechain-mainnet.g.alchemy.com";

/** Do not fall through to other chains when Alchemy rate-limits (avoid multiplying traffic). */
function isRateLimitError(e) {
  const m = String(e?.message || e || "").toLowerCase();
  return m.includes("429") || m.includes("rate limit");
}

function alchemyNftHostForChain(chain) {
  const c = String(chain || "").toLowerCase();
  if (c === "base") return ALCHEMY_BASE_HOST;
  if (c === "ape") return ALCHEMY_APE_HOST;
  return ALCHEMY_ETH_HOST;
}

function corsResponse(body, status = 200, contentType = "application/json; charset=utf-8") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS },
  });
}

/** Prefer dedicated Alchemy app; else shared ALCHEMY_API_KEY. */
function getAlchemyKey(env) {
  const d = env.ALCHEMY_API_KEY_COLLECTION_OVERLAP;
  const dedicated = d && typeof d === "string" ? d.trim() : "";
  if (dedicated) return dedicated;
  const m = env.ALCHEMY_API_KEY;
  return m && typeof m === "string" ? m.trim() : "";
}

// ---------------------------------------------------------------------------
// Holder overlap (same behaviour as previous FlexGrid-mounted route)
// ---------------------------------------------------------------------------

const OVERLAP_HOLDERS_CACHE = new Map();
const OVERLAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Optional safety cap (set Worker var OVERLAP_MAX_HOLDERS). Unset = paginate until Alchemy has no more pages. */
function getOptionalHolderCap(env) {
  const v = env?.OVERLAP_MAX_HOLDERS;
  if (v == null || v === "") return null;
  const n = parseInt(String(v).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

/** Cached holder pack after ETH→Base→Ape auto-detect (one key per contract address). */
function overlapAutoContractKey(addr) {
  return `overlap:auto:v3:${String(addr || "").trim().toLowerCase()}`;
}

function overlapCacheEntryFresh(entry) {
  if (!entry?.fetchedAt) return false;
  const t = Date.parse(String(entry.fetchedAt));
  if (!Number.isFinite(t)) return false;
  return Date.now() - t < OVERLAP_CACHE_TTL_MS;
}

function validateEthContract42(s) {
  const t = String(s || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(t)) return null;
  return t;
}

function shortenWallet(addr) {
  const a = String(addr || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(a)) return a || "";
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function repairBrokenImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  let s = url.trim();
  if (!s) return url;
  if (s.startsWith("//")) s = `https:${s}`;
  s = s.replace(/^https:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "https://");
  s = s.replace(/^http:\/\/{2,}2F(?=[a-zA-Z0-9])/i, "http://");
  s = s.replace(/^https:\/\/{3,}/i, "https://");
  s = s.replace(/^http:\/\/{3,}/i, "http://");
  return s;
}

/** Logo URL from Alchemy getContractMetadata (OpenSea + fallbacks). */
function pickCollectionLogoFromContractMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const pick = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const u =
      obj.imageUrl ||
      obj.image_url ||
      obj.logo ||
      obj.coverImageUrl ||
      obj.bannerImageUrl;
    const raw = typeof u === "string" && u.trim() ? u.trim() : null;
    return raw ? repairBrokenImageUrl(raw) : null;
  };
  return (
    pick(data.openSeaMetadata) ||
    pick(data.openSea) ||
    pick(data.contract?.openSeaMetadata) ||
    pick(data.contract?.openSea) ||
    pick(data.contractMetadata?.openSeaMetadata) ||
    pick(data.contractMetadata?.openSea) ||
    pick(data.contractMetadata) ||
    (typeof data.imageUrl === "string" && data.imageUrl.trim() ? repairBrokenImageUrl(data.imageUrl.trim()) : null) ||
    (typeof data.logoUrl === "string" && data.logoUrl.trim() ? repairBrokenImageUrl(data.logoUrl.trim()) : null) ||
    null
  );
}

function pickCollectionNameFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const os = data.openSeaMetadata || data.openSea || {};
  const cm = data.contractMetadata || data.contract || {};
  const list = [data.name, cm.name, os.collectionName, os.name, data.title];
  for (const c of list) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function pickCollectionSymbolFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const cm = data.contractMetadata || data.contract || {};
  const s = data.symbol || cm.symbol || data.openSeaMetadata?.symbol;
  if (typeof s === "string" && s.trim()) return s.trim().toUpperCase();
  return null;
}

/**
 * Best-effort display info on one chain (never throws — overlap still works if metadata fails).
 * @returns {{ name: string|null, symbol: string|null, logoUrl: string|null }}
 */
async function fetchContractDisplayOnChain(env, contract, chain) {
  const empty = { name: null, symbol: null, logoUrl: null };
  const apiKey = getAlchemyKey(env);
  if (!apiKey) return empty;
  const host = alchemyNftHostForChain(chain);
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getContractMetadata?contractAddress=${encodeURIComponent(contract)}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(metaUrl, { signal: controller.signal });
    if (!res.ok) return empty;
    const json = await res.json().catch(() => ({}));
    if (json?.error?.message) return empty;
    return {
      name: pickCollectionNameFromMetadata(json),
      symbol: pickCollectionSymbolFromMetadata(json),
      logoUrl: pickCollectionLogoFromContractMetadata(json),
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(tid);
  }
}

/** ETH metadata first; if empty, Base (for /api/contract-display and logos without holder fetch). */
async function fetchContractDisplayAuto(env, contract) {
  const eth = await fetchContractDisplayOnChain(env, contract, "eth");
  if ((eth.name && String(eth.name).trim()) || (eth.logoUrl && String(eth.logoUrl).trim())) {
    return { ...eth, detectedChain: "eth" };
  }
  const base = await fetchContractDisplayOnChain(env, contract, "base");
  if ((base.name && String(base.name).trim()) || (base.logoUrl && String(base.logoUrl).trim())) {
    return { ...base, detectedChain: "base" };
  }
  return { ...eth, detectedChain: "eth" };
}

/** Rows from Alchemy getOwnersForContract (shape varies slightly by chain / flag). */
function ownersRowsFromJson(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.owners)) return data.owners;
  if (Array.isArray(data.ownerAddresses)) return data.ownerAddresses;
  return [];
}

/** One owner entry: string address or object with ownerAddress (withTokenBalances=true). */
function walletFromOwnerRow(row) {
  if (row == null) return "";
  if (typeof row === "string") return row.trim().toLowerCase();
  if (typeof row === "object") {
    const raw =
      row.ownerAddress ??
      row.address ??
      row.owner ??
      row.wallet ??
      row.walletAddress ??
      "";
    return String(raw).trim().toLowerCase();
  }
  return "";
}

/** Sum NFT count for this contract from Alchemy owner row (withTokenBalances=true). */
function tokenCountFromOwnerRow(row) {
  if (row == null || typeof row === "string") return 1;
  if (typeof row !== "object") return 1;
  const tb = row.tokenBalances;
  if (!Array.isArray(tb) || tb.length === 0) return 1;
  let n = 0;
  for (const t of tb) {
    const raw = t?.balance ?? t?.tokenBalance ?? t?.value;
    const v = parseInt(String(raw ?? "1"), 10);
    if (Number.isFinite(v) && v > 0) n += v;
    else n += 1;
  }
  return n > 0 ? n : 1;
}

/** Human-readable overlap strength from match score + both directional percents. */
function connectionTierFromStats(matchScore, pctA, pctB) {
  const ms = Number(matchScore);
  const a = Number(pctA);
  const b = Number(pctB);
  const m = Math.min(Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0);
  const avg = Number.isFinite(ms) ? ms : 0;
  if (avg >= 18 || m >= 12) return "Strong bridge";
  if (avg >= 8 || m >= 5) return "Well connected";
  if (avg >= 3 || m >= 1.5) return "Crossing paths";
  if (avg >= 0.75 || m >= 0.5) return "Light overlap";
  return "Niche link";
}

/**
 * Per-wallet depth for overlapping addresses only (same overlap GET — no extra APIs).
 * Uses max(nA, nB) per wallet: NFT count in the heavier of the two collections for that wallet.
 */
function buildSharedDepthStats(sharedAddrs, countA, countB, matchScore, pctA, pctB, partial) {
  let whale3 = 0;
  let whale5 = 0;
  let d1 = 0;
  let d23 = 0;
  let d4p = 0;
  for (const addr of sharedAddrs) {
    const k = typeof addr === "string" && /^0x[a-f0-9]{40}$/i.test(addr) ? addr.toLowerCase() : String(addr || "");
    const rawA = countA && typeof countA === "object" ? countA[k] : undefined;
    const rawB = countB && typeof countB === "object" ? countB[k] : undefined;
    const na = rawA != null ? Number(rawA) : 1;
    const nb = rawB != null ? Number(rawB) : 1;
    const naSafe = Number.isFinite(na) && na > 0 ? na : 1;
    const nbSafe = Number.isFinite(nb) && nb > 0 ? nb : 1;
    const mx = Math.max(naSafe, nbSafe);
    if (mx >= 3) whale3 += 1;
    if (mx >= 5) whale5 += 1;
    if (mx <= 1) d1 += 1;
    else if (mx <= 3) d23 += 1;
    else d4p += 1;
  }
  return {
    connectionTier: connectionTierFromStats(matchScore, pctA, pctB),
    whaleHolds3Plus: whale3,
    whaleHolds5Plus: whale5,
    distHolding1: d1,
    distHolding2to3: d23,
    distHolding4Plus: d4p,
    insightPartial: Boolean(partial),
  };
}

/**
 * Per shared address: NFT counts in A, in B, and total (same overlap response — no extra API).
 * Aligned index-for-index with `sharedHoldersAll`.
 */
function sharedPerWalletHoldingsArrays(addrs, countA, countB) {
  const sharedPerWalletTotalHeld = [];
  const sharedPerWalletCountA = [];
  const sharedPerWalletCountB = [];
  for (const addr of addrs) {
    const k =
      typeof addr === "string" && /^0x[a-f0-9]{40}$/i.test(addr) ? addr.toLowerCase() : String(addr || "");
    const rawA = countA && typeof countA === "object" ? countA[k] : undefined;
    const rawB = countB && typeof countB === "object" ? countB[k] : undefined;
    let na = rawA != null ? Number(rawA) : 1;
    let nb = rawB != null ? Number(rawB) : 1;
    if (!Number.isFinite(na) || na < 1) na = 1;
    if (!Number.isFinite(nb) || nb < 1) nb = 1;
    sharedPerWalletTotalHeld.push(na + nb);
    sharedPerWalletCountA.push(na);
    sharedPerWalletCountB.push(nb);
  }
  return { sharedPerWalletTotalHeld, sharedPerWalletCountA, sharedPerWalletCountB };
}

/**
 * Paginated owners on a single chain.
 * @param {"eth"|"base"|"ape"} chain
 */
async function fetchOwnersForContract(contract, env, chain) {
  const apiKey = getAlchemyKey(env);
  if (!apiKey) {
    throw new Error(
      "Missing Alchemy key. Set ALCHEMY_API_KEY_COLLECTION_OVERLAP (recommended) or ALCHEMY_API_KEY on this Worker."
    );
  }

  const host = alchemyNftHostForChain(chain);
  const owners = new Set();
  /** @type {Record<string, number>} */
  const countsByWallet = {};
  let pageKey = null;
  let capped = false;
  const holderCap = getOptionalHolderCap(env);

  while (true) {
    const u = new URL(`https://${host}/nft/v3/${apiKey}/getOwnersForContract`);
    u.searchParams.set("contractAddress", contract);
    /** `true` yields consistent `{ ownerAddress, tokenBalances }[]` across chains (incl. ApeChain). */
    u.searchParams.set("withTokenBalances", "true");
    if (pageKey) u.searchParams.set("pageKey", pageKey);

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 25000);
    let res;
    try {
      res = await fetch(u.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(tid);
    }

    if (res.status === 429) {
      throw new Error("Alchemy rate limited (429). Please wait a minute and try again.");
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Alchemy getOwnersForContract failed (${res.status}): ${txt.slice(0, 600)}`);
    }

    const data = await res.json().catch(() => ({}));
    if (data?.error?.message) {
      throw new Error(String(data.error.message));
    }

    const rows = ownersRowsFromJson(data);

    for (const row of rows) {
      const addr = walletFromOwnerRow(row);
      if (!/^0x[a-f0-9]{40}$/.test(addr)) continue;
      const n = tokenCountFromOwnerRow(row);
      countsByWallet[addr] = (countsByWallet[addr] || 0) + n;
      owners.add(addr);
      if (holderCap != null && owners.size >= holderCap) {
        capped = true;
        break;
      }
    }

    if (capped) break;

    const next = data?.pageKey;
    pageKey = typeof next === "string" && next.trim() ? next.trim() : null;
    if (!pageKey) break;
    if (rows.length === 0) break;
  }

  const holders = Array.from(owners);
  const fetchedAt = new Date().toISOString();
  return {
    contractAddress: contract,
    holders,
    holderCount: holders.length,
    countsByWallet,
    fetchedAt,
    source: "alchemy",
    chain,
    capped,
  };
}

const NOT_FOUND_CHAINS = "Collection not found on supported chains";

/**
 * ETH first; if error or zero holders, Base; then ApeChain. Stops on first chain with holderCount > 0.
 * @returns {Promise<{ contractAddress: string, holders: string[], holderCount: number, fetchedAt: string, source: string, chain: "eth"|"base"|"ape", capped: boolean }>}
 */
async function resolveOwnersAutoChain(contract, env) {
  let ethPack = null;
  try {
    ethPack = await fetchOwnersForContract(contract, env, "eth");
  } catch (e) {
    if (isRateLimitError(e)) throw e;
  }
  if (ethPack && ethPack.holderCount > 0) {
    return ethPack;
  }

  let basePack = null;
  try {
    basePack = await fetchOwnersForContract(contract, env, "base");
  } catch (e) {
    if (isRateLimitError(e)) throw e;
  }
  if (basePack && basePack.holderCount > 0) {
    return basePack;
  }

  let apePack = null;
  try {
    apePack = await fetchOwnersForContract(contract, env, "ape");
  } catch (e) {
    if (isRateLimitError(e)) throw e;
  }
  if (apePack && apePack.holderCount > 0) {
    return apePack;
  }

  throw new Error(NOT_FOUND_CHAINS);
}

async function getOverlapHoldersCachedAuto(contract, env) {
  const key = overlapAutoContractKey(contract);
  const hit = OVERLAP_HOLDERS_CACHE.get(key);
  if (hit && overlapCacheEntryFresh(hit)) return hit;

  const fresh = await resolveOwnersAutoChain(contract, env);
  OVERLAP_HOLDERS_CACHE.set(key, fresh);
  return fresh;
}

async function handleApiCollectionOverlap(request, env) {
  const url = new URL(request.url);
  const rawA = url.searchParams.get("contractA");
  const rawB = url.searchParams.get("contractB");

  const contractA = validateEthContract42(rawA);
  const contractB = validateEthContract42(rawB);
  if (!contractA || !contractB) {
    return corsResponse(
      JSON.stringify({ error: "Invalid contract address. Use 0x + 40 hex characters (42 chars total) for both." }),
      400
    );
  }
  if (contractA === contractB) {
    return corsResponse(JSON.stringify({ error: "Please enter two different contract addresses." }), 400);
  }

  let packA;
  let packB;
  try {
    [packA, packB] = await Promise.all([
      getOverlapHoldersCachedAuto(contractA, env),
      getOverlapHoldersCachedAuto(contractB, env),
    ]);
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Request timed out. Try again." : e?.message || "Failed to fetch owners.";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }

  const [metaA, metaB] = await Promise.all([
    fetchContractDisplayOnChain(env, contractA, packA.chain),
    fetchContractDisplayOnChain(env, contractB, packB.chain),
  ]);

  const setA = new Set(packA.holders || []);
  const setB = new Set(packB.holders || []);

  const holderCountA = setA.size;
  const holderCountB = setB.size;

  const shared = [];
  const [small, big] = holderCountA <= holderCountB ? [setA, setB] : [setB, setA];
  for (const addr of small) {
    if (big.has(addr)) shared.push(addr);
  }
  shared.sort();

  const sharedHolderCount = shared.length;

  const percentOfAHoldingB =
    holderCountA > 0 ? Math.round((sharedHolderCount / holderCountA) * 10000) / 100 : 0;
  const percentOfBHoldingA =
    holderCountB > 0 ? Math.round((sharedHolderCount / holderCountB) * 10000) / 100 : 0;

  const matchScore = Math.round(((percentOfAHoldingB + percentOfBHoldingA) / 2) * 100) / 100;

  const cappedA = !!packA.capped;
  const cappedB = !!packB.capped;
  const dataQuality = cappedA || cappedB ? "capped" : "full";

  const sharedHoldersPreview = shared.slice(0, 10).map(shortenWallet);
  const MAX_COPY = 25000;
  const sharedHoldersAll = shared.slice(0, MAX_COPY);
  const sharedListTruncated = shared.length > MAX_COPY;

  const countA = packA.countsByWallet && typeof packA.countsByWallet === "object" ? packA.countsByWallet : {};
  const countB = packB.countsByWallet && typeof packB.countsByWallet === "object" ? packB.countsByWallet : {};
  const sharedDepth = buildSharedDepthStats(
    shared,
    countA,
    countB,
    matchScore,
    percentOfAHoldingB,
    percentOfBHoldingA,
    cappedA || cappedB
  );

  const { sharedPerWalletTotalHeld, sharedPerWalletCountA, sharedPerWalletCountB } = sharedPerWalletHoldingsArrays(
    sharedHoldersAll,
    countA,
    countB
  );

  const body = {
    success: true,
    detectedChainA: packA.chain,
    detectedChainB: packB.chain,
    contractA,
    contractB,
    collectionNameA: metaA?.name || null,
    collectionNameB: metaB?.name || null,
    collectionSymbolA: metaA?.symbol || null,
    collectionSymbolB: metaB?.symbol || null,
    collectionLogoUrlA: metaA?.logoUrl || null,
    collectionLogoUrlB: metaB?.logoUrl || null,
    holderCountA,
    holderCountB,
    sharedHolderCount,
    percentOfAHoldingB,
    percentOfBHoldingA,
    matchScore,
    sharedHoldersPreview,
    sharedHoldersAll,
    sharedListTruncated,
    cappedA,
    cappedB,
    fetchedAtA: packA.fetchedAt,
    fetchedAtB: packB.fetchedAt,
    dataQuality,
    sharedDepth,
    sharedPerWalletTotalHeld,
    sharedPerWalletCountA,
    sharedPerWalletCountB,
  };

  return corsResponse(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Solana holder overlap (Helius DAS only) — isolated from EVM / Alchemy paths
// ---------------------------------------------------------------------------

const SOLANA_HOLDERS_CACHE = new Map();
const HELIUS_RPC = "https://mainnet.helius-rpc.com";

/** Prefer HELIUS_API_KEY_COLLECTION_OVERLAP; else HELIUS_API_KEY. */
function getHeliusKey(env) {
  const d = env.HELIUS_API_KEY_COLLECTION_OVERLAP;
  const dedicated = d && typeof d === "string" ? d.trim() : "";
  if (dedicated) return dedicated;
  const m = env.HELIUS_API_KEY;
  return m && typeof m === "string" ? m.trim() : "";
}

/** Base58 Solana address; rejects EVM-style 0x + 40 hex. */
function validateSolanaCollectionMint(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(lower)) return null;
  if (/^0x/.test(lower)) return null;
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) return null;
  return s;
}

function solanaHoldersCacheKey(mint) {
  return `overlap:sol:v2:${String(mint || "").trim()}`;
}

async function heliusJsonRpc(env, body, timeoutMs = 25000) {
  const key = getHeliusKey(env);
  if (!key) throw new Error("Missing Helius API key.");
  const url = `${HELIUS_RPC}/?api-key=${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Helius authentication failed. Check HELIUS_API_KEY_COLLECTION_OVERLAP or HELIUS_API_KEY.");
    }
    if (res.status === 429) {
      throw new Error("Helius rate limited (429). Please wait a minute and try again.");
    }
    const text = await res.text().catch(() => "");
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    if (json?.error?.message) {
      throw new Error(String(json.error.message));
    }
    if (!res.ok) {
      throw new Error(`Helius request failed (${res.status}): ${text.slice(0, 400)}`);
    }
    return json;
  } finally {
    clearTimeout(tid);
  }
}

function ownerWalletFromDasAsset(item) {
  if (!item || typeof item !== "object") return "";
  const o = item.ownership;
  if (!o || typeof o !== "object") return "";
  const raw = o.owner ?? o.ownerAddress ?? "";
  return String(raw).trim();
}

/**
 * Unique wallet owners for a verified collection mint via Helius getAssetsByGroup.
 * @returns {Promise<{ collectionMint: string, holders: string[], holderCount: number, fetchedAt: string, capped: boolean }>}
 */
async function fetchSolanaHolders(collectionMint, env) {
  const mint = validateSolanaCollectionMint(collectionMint);
  if (!mint) throw new Error("Invalid Solana collection mint.");

  const owners = new Set();
  /** @type {Record<string, number>} */
  const countsByWallet = {};
  const holderCap = getOptionalHolderCap(env);
  let page = 1;
  const limit = 1000;
  let capped = false;

  while (true) {
    const payload = {
      jsonrpc: "2.0",
      id: `co-sol-${page}`,
      method: "getAssetsByGroup",
      params: {
        groupKey: "collection",
        groupValue: mint,
        page,
        limit,
        sortBy: { sortBy: "none", sortDirection: "asc" },
      },
    };

    const json = await heliusJsonRpc(env, payload);
    const result = json?.result;
    const items = Array.isArray(result?.items) ? result.items : [];

    for (const it of items) {
      const w = ownerWalletFromDasAsset(it);
      if (!w) continue;
      countsByWallet[w] = (countsByWallet[w] || 0) + 1;
      owners.add(w);
      if (holderCap != null && owners.size >= holderCap) {
        capped = true;
        break;
      }
    }

    if (capped) break;
    if (items.length === 0) break;
    if (items.length < limit) break;
    page += 1;
    if (page > 5000) break;
  }

  const holders = Array.from(owners);
  return {
    collectionMint: mint,
    holders,
    holderCount: holders.length,
    countsByWallet,
    fetchedAt: new Date().toISOString(),
    capped,
  };
}

async function getSolanaHoldersCached(collectionMint, env) {
  const key = solanaHoldersCacheKey(collectionMint);
  const hit = SOLANA_HOLDERS_CACHE.get(key);
  if (hit && overlapCacheEntryFresh(hit)) return hit;
  const fresh = await fetchSolanaHolders(collectionMint, env);
  SOLANA_HOLDERS_CACHE.set(key, fresh);
  return fresh;
}

/** Preview list entry: EVM shortened or Solana first/last slice. */
function shortenHolderPreview(addr) {
  const s = String(addr || "").trim();
  if (!s) return "";
  const ev = s.toLowerCase();
  if (/^0x[a-f0-9]{40}$/.test(ev)) return shortenWallet(ev);
  if (s.length > 12) return `${s.slice(0, 4)}...${s.slice(-4)}`;
  return s;
}

/** Best-effort name / image for a collection mint (getAsset on the collection NFT). */
async function fetchSolanaCollectionDisplay(collectionMint, env) {
  const empty = { name: null, symbol: null, logoUrl: null };
  const mint = validateSolanaCollectionMint(collectionMint);
  if (!mint) return empty;
  try {
    const json = await heliusJsonRpc(
      env,
      { jsonrpc: "2.0", id: "co-sol-meta", method: "getAsset", params: { id: mint } },
      12000
    );
    const r = json?.result;
    if (!r || typeof r !== "object") return empty;
    const content = r.content && typeof r.content === "object" ? r.content : {};
    const meta = content.metadata && typeof content.metadata === "object" ? content.metadata : {};
    const displayName = typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : null;
    let symbol = null;
    if (typeof meta.symbol === "string" && meta.symbol.trim()) {
      symbol = meta.symbol.trim().toUpperCase();
    } else if (typeof r.token_info?.symbol === "string" && r.token_info.symbol.trim()) {
      symbol = String(r.token_info.symbol).trim().toUpperCase();
    }
    const files = Array.isArray(content.files) ? content.files : [];
    const firstImg = files.find(
      (f) => f && typeof f === "object" && typeof f.uri === "string" && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(f.uri)
    );
    const rawImg =
      (typeof content.links?.image === "string" && content.links.image.trim()) ||
      (firstImg && typeof firstImg.uri === "string" && firstImg.uri.trim()) ||
      (typeof r.image === "string" && r.image.trim()) ||
      null;
    const logoUrl = rawImg ? repairBrokenImageUrl(String(rawImg).trim()) : null;
    return { name: displayName, symbol, logoUrl };
  } catch {
    return empty;
  }
}

async function handleApiCollectionOverlapSolana(request, env) {
  const url = new URL(request.url);
  const rawA = url.searchParams.get("mintA") ?? url.searchParams.get("collectionA");
  const rawB = url.searchParams.get("mintB") ?? url.searchParams.get("collectionB");

  const mintA = validateSolanaCollectionMint(rawA);
  const mintB = validateSolanaCollectionMint(rawB);

  if (!mintA || !mintB) {
    return corsResponse(
      JSON.stringify({ error: "Solana comparisons must be between Solana collections only" }),
      400
    );
  }
  if (mintA === mintB) {
    return corsResponse(JSON.stringify({ error: "Please enter two different collection mints." }), 400);
  }

  let packA;
  let packB;
  try {
    [packA, packB] = await Promise.all([getSolanaHoldersCached(mintA, env), getSolanaHoldersCached(mintB, env)]);
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Request timed out. Try again." : e?.message || "Failed to fetch Solana holders.";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }

  const [metaA, metaB] = await Promise.all([fetchSolanaCollectionDisplay(mintA, env), fetchSolanaCollectionDisplay(mintB, env)]);

  const setA = new Set(packA.holders || []);
  const setB = new Set(packB.holders || []);

  const holderCountA = setA.size;
  const holderCountB = setB.size;

  const shared = [];
  const [small, big] = holderCountA <= holderCountB ? [setA, setB] : [setB, setA];
  for (const addr of small) {
    if (big.has(addr)) shared.push(addr);
  }
  shared.sort();

  const sharedHolderCount = shared.length;

  const percentOfAHoldingB =
    holderCountA > 0 ? Math.round((sharedHolderCount / holderCountA) * 10000) / 100 : 0;
  const percentOfBHoldingA =
    holderCountB > 0 ? Math.round((sharedHolderCount / holderCountB) * 10000) / 100 : 0;

  const matchScore = Math.round(((percentOfAHoldingB + percentOfBHoldingA) / 2) * 100) / 100;

  const cappedA = !!packA.capped;
  const cappedB = !!packB.capped;
  const dataQuality = cappedA || cappedB ? "capped" : "full";

  const sharedHoldersPreview = shared.slice(0, 10).map(shortenHolderPreview);
  const MAX_COPY = 25000;
  const sharedHoldersAll = shared.slice(0, MAX_COPY);
  const sharedListTruncated = shared.length > MAX_COPY;

  const countSolA = packA.countsByWallet && typeof packA.countsByWallet === "object" ? packA.countsByWallet : {};
  const countSolB = packB.countsByWallet && typeof packB.countsByWallet === "object" ? packB.countsByWallet : {};
  const sharedDepth = buildSharedDepthStats(
    shared,
    countSolA,
    countSolB,
    matchScore,
    percentOfAHoldingB,
    percentOfBHoldingA,
    cappedA || cappedB
  );

  const { sharedPerWalletTotalHeld, sharedPerWalletCountA, sharedPerWalletCountB } = sharedPerWalletHoldingsArrays(
    sharedHoldersAll,
    countSolA,
    countSolB
  );

  const body = {
    success: true,
    detectedChainA: "solana",
    detectedChainB: "solana",
    contractA: mintA,
    contractB: mintB,
    collectionNameA: metaA?.name || null,
    collectionNameB: metaB?.name || null,
    collectionSymbolA: metaA?.symbol || null,
    collectionSymbolB: metaB?.symbol || null,
    collectionLogoUrlA: metaA?.logoUrl || null,
    collectionLogoUrlB: metaB?.logoUrl || null,
    holderCountA,
    holderCountB,
    sharedHolderCount,
    percentOfAHoldingB,
    percentOfBHoldingA,
    matchScore,
    sharedHoldersPreview,
    sharedHoldersAll,
    sharedListTruncated,
    cappedA,
    cappedB,
    fetchedAtA: packA.fetchedAt,
    fetchedAtB: packB.fetchedAt,
    dataQuality,
    sharedDepth,
    sharedPerWalletTotalHeld,
    sharedPerWalletCountA,
    sharedPerWalletCountB,
  };

  return corsResponse(JSON.stringify(body));
}

const SEARCH_MAX_QUERY_LEN = 160;
const SEARCH_MAX_RESULTS = 10;

// ---------------------------------------------------------------------------
// Solana collection search + display (Helius + Magic Eden) — UI parity with EVM search
// ---------------------------------------------------------------------------

function scoreMintFieldKey(key) {
  const k = String(key || "")
    .toLowerCase()
    .replace(/[_\s-]/g, "");
  if (k.includes("onchaincollectionaddress")) return 120;
  if (k.includes("collectionmint")) return 110;
  if (k.includes("verifiedcollectionmint")) return 105;
  if (k.includes("collectionaddress")) return 95;
  if (k.includes("collgroup") && k.includes("mint")) return 90;
  if (k.includes("collection") && k.includes("mint")) return 85;
  if (k.includes("mint") && k.includes("key")) return 80;
  if (k.includes("mint")) return 40;
  if (k.includes("collection")) return 25;
  return 5;
}

/** Walk Magic Eden JSON for a plausible verified collection mint string. */
function extractMintFromMagicEdenBody(data) {
  let bestMint = null;
  let bestScore = -1;
  function consider(key, val) {
    if (typeof val !== "string") return;
    const m = validateSolanaCollectionMint(val.trim());
    if (!m) return;
    const sc = scoreMintFieldKey(key);
    if (sc > bestScore) {
      bestScore = sc;
      bestMint = m;
    }
  }
  function walk(obj, depth) {
    if (depth > 16 || obj == null) return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item, depth + 1);
      return;
    }
    if (typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      consider(k, v);
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  walk(data, 0);
  return bestMint;
}

/**
 * Magic Eden v2 collection JSON from alternate hosts (separate rate limits).
 * @returns {Promise<{ mint: string, name: string, image: string|null }|null>}
 */
async function tryMagicEdenSlugToMint(slug, env) {
  void env;
  const s = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (!s || s.length > 120) return null;

  const hosts = ["https://api-mainnet.magiceden.io", "https://api-mainnet.magiceden.dev"];
  const headers = {
    Accept: "application/json",
    "User-Agent": "LittleOllieLabs-CollectionOverlap/1.0",
  };

  for (const host of hosts) {
    const u = `${host}/v2/collections/${encodeURIComponent(s)}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(u, { method: "GET", headers, signal: controller.signal });
      const text = await res.text().catch(() => "");
      if (res.status === 429) continue;
      if (!res.ok) continue;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        continue;
      }
      const mint = extractMintFromMagicEdenBody(data);
      const name =
        (typeof data.name === "string" && data.name.trim()) ||
        (typeof data.title === "string" && data.title.trim()) ||
        s;
      const rawImg =
        (typeof data.image === "string" && data.image.trim()) ||
        (typeof data.img === "string" && data.img.trim()) ||
        null;
      const image = rawImg ? repairBrokenImageUrl(rawImg) : null;
      if (!mint) continue;
      return { mint, name, image };
    } catch {
      /* try next host */
    } finally {
      clearTimeout(tid);
    }
  }
  return null;
}

/** Verified collection mint from Helius DAS `getAsset` on an NFT in the collection. */
function collectionMintFromDasGetAssetResult(result) {
  if (!result || typeof result !== "object") return null;
  const g = result.grouping;
  if (g && typeof g === "object" && !Array.isArray(g)) {
    const v = g.collection ?? g.collectionKey ?? g.collection_key;
    const m = validateSolanaCollectionMint(String(v || "").trim());
    if (m) return m;
  }
  if (Array.isArray(g)) {
    for (const entry of g) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const key = String(entry[0] || "").toLowerCase();
        if (key === "collection") {
          const m = validateSolanaCollectionMint(String(entry[1] || ""));
          if (m) return m;
        }
      }
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        const k = String(entry.group_key || entry.key || "").toLowerCase();
        const v = entry.group_value ?? entry.value;
        if (k === "collection" && v != null) {
          const m = validateSolanaCollectionMint(String(v));
          if (m) return m;
        }
      }
    }
  }
  const content = result.content && typeof result.content === "object" ? result.content : {};
  const meta = content.metadata && typeof content.metadata === "object" ? content.metadata : {};
  const col = meta.collection;
  if (col && typeof col === "object") {
    const ref = col.key ?? col.address ?? col.id ?? col.mint;
    const m = validateSolanaCollectionMint(String(ref || "").trim());
    if (m) return m;
  }
  return null;
}

/**
 * Sample NFT mint from Magic Eden (listings first, then recent activities).
 * Many collections omit on-chain collection mint in `/v2/collections/{slug}`; listings can be empty
 * while `activities` still includes `tokenMint` (e.g. recent sales/lists).
 * @returns {Promise<string|null>}
 */
async function tryMagicEdenSampleNftMintForSlug(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (!s || s.length > 120) return null;

  const hosts = ["https://api-mainnet.magiceden.io", "https://api-mainnet.magiceden.dev"];
  const headers = {
    Accept: "application/json",
    "User-Agent": "LittleOllieLabs-CollectionOverlap/1.0",
  };

  function mintFromListingRow(row) {
    if (!row || typeof row !== "object") return null;
    const raw = row.tokenMint || row.token?.mintAddress || row.mintAddress || row.mint;
    return validateSolanaCollectionMint(String(raw || "").trim());
  }

  function mintFromActivityRow(row) {
    if (!row || typeof row !== "object") return null;
    const raw = row.tokenMint || row.token?.mintAddress || row.mintAddress || row.mint;
    return validateSolanaCollectionMint(String(raw || "").trim());
  }

  for (const host of hosts) {
    const paths = [
      `/v2/collections/${encodeURIComponent(s)}/listings?offset=0&limit=1`,
      `/v2/collections/${encodeURIComponent(s)}/activities?offset=0&limit=25`,
    ];
    for (const path of paths) {
      const u = `${host}${path}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(u, { method: "GET", headers, signal: controller.signal });
        const text = await res.text().catch(() => "");
        if (res.status === 429 || !res.ok) continue;
        let arr;
        try {
          arr = JSON.parse(text);
        } catch {
          continue;
        }
        if (!Array.isArray(arr) || arr.length === 0) continue;
        if (path.includes("/listings")) {
          const ms = mintFromListingRow(arr[0]);
          if (ms) return ms;
          continue;
        }
        for (const row of arr) {
          const ms = mintFromActivityRow(row);
          if (ms) return ms;
        }
      } catch {
        /* next */
      } finally {
        clearTimeout(tid);
      }
    }
  }
  return null;
}

/** @returns {Promise<boolean>} */
async function tryMagicEdenCollectionFetchOk(slug) {
  const s = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (!s || s.length > 120) return false;
  const hosts = ["https://api-mainnet.magiceden.io", "https://api-mainnet.magiceden.dev"];
  const headers = {
    Accept: "application/json",
    "User-Agent": "LittleOllieLabs-CollectionOverlap/1.0",
  };
  for (const host of hosts) {
    const u = `${host}/v2/collections/${encodeURIComponent(s)}`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(u, { method: "GET", headers, signal: controller.signal });
      if (res.status === 429) continue;
      if (res.ok) return true;
    } catch {
      /* next host */
    } finally {
      clearTimeout(tid);
    }
  }
  return false;
}

/**
 * When ME collection JSON has no collection mint, resolve via listing + Helius getAsset grouping.
 * @returns {Promise<{ mint: string, name: string, image: string|null }|null>}
 */
async function resolveCollectionMintFromSlugViaListingHelius(slug, env) {
  if (!getHeliusKey(env)) return null;
  const s = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (!s) return null;

  const nftMint = await tryMagicEdenSampleNftMintForSlug(s);
  if (!nftMint) return null;

  let json;
  try {
    json = await heliusJsonRpc(
      env,
      { jsonrpc: "2.0", id: "co-sol-col-from-listing", method: "getAsset", params: { id: nftMint } },
      18000
    );
  } catch {
    return null;
  }

  const colMint = collectionMintFromDasGetAssetResult(json?.result);
  if (!colMint) return null;

  const d = await fetchSolanaCollectionDisplay(colMint, env);
  return {
    mint: colMint,
    name: (d.name && String(d.name).trim()) || s,
    image: d.logoUrl || null,
  };
}

/**
 * Slug / ME symbol → one search row (verified collection mint + display).
 * Uses ME collection JSON when possible; otherwise listing sample + Helius grouping (needs Helius key).
 */
async function resolveSolanaSlugToSearchRow(slug, env) {
  const s = String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  if (!s || s.length > 120) return null;

  const me = await tryMagicEdenSlugToMint(s, env);
  if (me?.mint) {
    if (!getHeliusKey(env)) {
      return { name: me.name, contractAddress: me.mint, image: me.image };
    }
    const d = await fetchSolanaCollectionDisplay(me.mint, env);
    return {
      name: (d.name && String(d.name).trim()) || me.name,
      contractAddress: me.mint,
      image: d.logoUrl || me.image || null,
    };
  }

  const via = await resolveCollectionMintFromSlugViaListingHelius(s, env);
  if (!via?.mint) return null;

  const d = await fetchSolanaCollectionDisplay(via.mint, env);
  return {
    name: (d.name && String(d.name).trim()) || via.name,
    contractAddress: via.mint,
    image: d.logoUrl || via.image || null,
  };
}

/**
 * @returns {Promise<{ name: string, contractAddress: string, image: string|null }|null>}
 */
async function mapSolanaSearchRowFromMint(mint, env) {
  const m = validateSolanaCollectionMint(mint);
  if (!m) return null;
  const d = await fetchSolanaCollectionDisplay(m, env);
  const name =
    (d.name && String(d.name).trim()) ||
    (d.symbol && String(d.symbol).trim()) ||
    `${m.slice(0, 4)}...${m.slice(-4)}`;
  return { name, contractAddress: m, image: d.logoUrl || null };
}

function extractMagicEdenHrefFromPaste(t) {
  let s = String(t || "").trim();
  const urlRe = /https?:\/\/[^\s<>"')\]}]+/gi;
  let m;
  while ((m = urlRe.exec(s)) !== null) {
    let piece = m[0].replace(/[),.;]+$/g, "");
    if (/magiceden\.io/i.test(piece)) return piece;
  }
  if (/magiceden\.io/i.test(s)) {
    let href = s.replace(/[),.;]+$/g, "");
    if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
    return href;
  }
  return null;
}

async function handleApiSearchCollectionsSolana(request, env) {
  const url = new URL(request.url);
  const rawQ = url.searchParams.get("q");
  const q = rawQ != null ? String(rawQ).trim() : "";

  if (!q) {
    return corsResponse(JSON.stringify({ success: true, results: [] }));
  }
  if (q.length > SEARCH_MAX_QUERY_LEN) {
    return corsResponse(JSON.stringify({ error: "Search query is too long." }), 400);
  }

  const out = [];
  const pushUnique = (row) => {
    if (!row?.contractAddress) return;
    const m = validateSolanaCollectionMint(row.contractAddress);
    if (!m) return;
    const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : `${m.slice(0, 4)}...${m.slice(-4)}`;
    const image = typeof row.image === "string" && row.image.trim() ? repairBrokenImageUrl(row.image.trim()) : null;
    out.push({ name, contractAddress: m, image });
  };

  const direct = validateSolanaCollectionMint(q);
  if (direct) {
    if (!getHeliusKey(env)) {
      return corsResponse(
        JSON.stringify({
          error:
            "Helius key missing: set HELIUS_API_KEY in collection-overlap-api/.dev.vars and restart npm run dev.",
        }),
        503
      );
    }
    const row = await mapSolanaSearchRowFromMint(direct, env);
    if (row) pushUnique(row);
    return corsResponse(JSON.stringify({ success: true, results: out.slice(0, SEARCH_MAX_RESULTS) }));
  }

  let slug = null;
  try {
    let h = extractMagicEdenHrefFromPaste(q) || String(q).trim();
    if (/magiceden\.io/i.test(h)) {
      if (!/^https?:\/\//i.test(h)) h = `https://${h.replace(/^\/+/, "")}`;
      const u = new URL(h);
      const host = u.hostname.replace(/^www\./i, "").toLowerCase();
      if (host.endsWith("magiceden.io")) {
        const m = u.pathname.match(/\/(?:marketplace|collections)\/([^/?#]+)/i);
        if (m) {
          try {
            slug = decodeURIComponent(m[1]);
          } catch {
            slug = m[1];
          }
        }
      }
    }
  } catch {
    slug = null;
  }

  if (!slug && looksLikeOpenseaCollectionSlug(q)) {
    slug = String(q).trim().toLowerCase();
  }

  let hint = null;
  if (slug) {
    const row = await resolveSolanaSlugToSearchRow(slug, env);
    if (row) pushUnique(row);
    else if (out.length === 0) {
      const hasHelius = Boolean(getHeliusKey(env));
      if (!hasHelius) {
        const meOk = await tryMagicEdenCollectionFetchOk(slug);
        if (meOk) {
          hint =
            "Magic Eden recognizes this symbol, but resolving the on-chain collection mint requires a Helius API key on the Worker (collection-overlap-api/.dev.vars or wrangler secret put).";
        }
      }
      if (!hint) {
        hint =
          "No match. Try a Magic Eden collection URL, the exact ME symbol, or paste the verified collection mint from Solscan or an NFT in the collection.";
      }
    }
  }

  const payload = { success: true, results: out.slice(0, SEARCH_MAX_RESULTS) };
  if (hint) payload.hint = hint;
  return corsResponse(JSON.stringify(payload));
}

async function handleApiSolanaCollectionDisplay(request, env) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("mint") ?? url.searchParams.get("address");
  const mint = validateSolanaCollectionMint(raw);
  if (!mint) {
    return corsResponse(JSON.stringify({ success: false, error: "Invalid collection mint" }), 400);
  }
  if (!getHeliusKey(env)) {
    return corsResponse(
      JSON.stringify({
        success: false,
        error:
          "Add HELIUS_API_KEY to collection-overlap-api/.dev.vars (local) or wrangler secret put HELIUS_API_KEY (production), then restart the Worker.",
      }),
      503
    );
  }
  const d = await fetchSolanaCollectionDisplay(mint, env);
  return corsResponse(
    JSON.stringify({
      success: true,
      contractAddress: mint,
      name: d.name,
      symbol: d.symbol,
      image: d.logoUrl,
      detectedChain: "solana",
    })
  );
}

// ---------------------------------------------------------------------------
// Collection search (Alchemy searchContractMetadata) — does not touch overlap
// ---------------------------------------------------------------------------

/**
 * Map one Alchemy searchContractMetadata row → API shape.
 * @returns {{ name: string, contractAddress: string, image: string|null }|null}
 */
function mapAlchemySearchContractRow(item) {
  if (!item || typeof item !== "object") return null;
  const addr = validateEthContract42(item.address);
  if (!addr) return null;
  const os = item.openseaMetadata && typeof item.openseaMetadata === "object" ? item.openseaMetadata : {};
  const name =
    (typeof os.collectionName === "string" && os.collectionName.trim()) ||
    (typeof item.name === "string" && item.name.trim()) ||
    (typeof item.symbol === "string" && item.symbol.trim()) ||
    shortenWallet(addr);
  const rawImg =
    (typeof os.imageUrl === "string" && os.imageUrl.trim()) ||
    (typeof item.imageUrl === "string" && item.imageUrl.trim()) ||
    null;
  const image = rawImg ? repairBrokenImageUrl(rawImg) : null;
  return { name, contractAddress: addr, image };
}

/** First `https://…opensea.io/…` (or bare opensea host) in pasted text — same idea as the static client. */
function extractOpenSeaHrefFromPaste(t) {
  let s = String(t || "").trim();
  const urlRe = /https?:\/\/[^\s<>"')\]}]+/gi;
  let m;
  while ((m = urlRe.exec(s)) !== null) {
    let piece = m[0].replace(/[),.;]+$/g, "");
    if (/opensea\.io/i.test(piece)) return piece;
  }
  if (/opensea\.io/i.test(s)) {
    let href = s.replace(/[),.;]+$/g, "");
    if (!/^https?:\/\//i.test(href)) href = `https://${href.replace(/^\/+/, "")}`;
    return href;
  }
  return null;
}

/** ETH or Base contract from `/assets/{chain}/0x…` or `/item/{chain}/0x…`. */
function openSeaEvmContractFromPathname(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "");
  const re = /\/(?:assets|item)\/(?:ethereum|eth|base)\/(0x[a-fA-F0-9]{40})(?:\/|$|\?)/i;
  const mm = p.match(re);
  if (!mm) return null;
  return validateEthContract42(mm[1]);
}

function openSeaCollectionSlugFromPathname(pathname) {
  const col = String(pathname || "").match(/\/collection\/([^/?#]+)/i);
  if (!col) return null;
  try {
    return decodeURIComponent(col[1]);
  } catch {
    return col[1];
  }
}

/**
 * From a raw `q` (slug, full URL, or pasted sentence with URL).
 * @returns {{ contract: string|null, slug: string|null }}
 */
function parseOpenSeaSearchDerivation(q) {
  const href = extractOpenSeaHrefFromPaste(q);
  if (!href) return { contract: null, slug: null };
  try {
    const h = /^https?:\/\//i.test(href) ? href : `https://${href.replace(/^\/+/, "")}`;
    const u = new URL(h);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("opensea.io")) return { contract: null, slug: null };
    const contract = openSeaEvmContractFromPathname(u.pathname);
    if (contract) return { contract, slug: null };
    const rawSlug = openSeaCollectionSlugFromPathname(u.pathname);
    if (!rawSlug) return { contract: null, slug: null };
    const slug = String(rawSlug).trim().toLowerCase();
    if (looksLikeOpenseaCollectionSlug(slug)) return { contract: null, slug };
    const sanitized = slug.replace(/[^a-z0-9._-]/g, "");
    if (sanitized && looksLikeOpenseaCollectionSlug(sanitized)) return { contract: null, slug: sanitized };
    return { contract: null, slug: null };
  } catch {
    return { contract: null, slug: null };
  }
}

/** Prefer a short token for Alchemy text search (full OpenSea URLs return nothing). */
function alchemySearchQueryForEvm(q, osDeriv) {
  if (looksLikeOpenseaCollectionSlug(q)) return q;
  if (osDeriv?.slug && looksLikeOpenseaCollectionSlug(osDeriv.slug)) return osDeriv.slug;
  const direct = validateEthContract42(q);
  if (direct) return direct;
  if (osDeriv?.contract) return osDeriv.contract;
  return q;
}

/** OpenSea-style collection slug (query param), not a URL or raw contract. */
function looksLikeOpenseaCollectionSlug(q) {
  const s = String(q || "").trim().toLowerCase();
  if (s.length < 1 || s.length > 120) return false;
  if (s.startsWith("0x")) return false;
  if (/^https?:\/\//.test(s)) return false;
  if (/[^a-z0-9._-]/.test(s)) return false;
  return true;
}

/**
 * Resolve a collection slug via OpenSea API v2 (ETH contract in `contracts`).
 * Works without a key for many collections; set OPENSEA_API_KEY if OpenSea returns 401.
 * @returns {Promise<{ name: string, contractAddress: string, image: string|null }|null>}
 */
async function tryOpenSeaSlugToCollection(slug, env) {
  if (!looksLikeOpenseaCollectionSlug(slug)) return null;
  const s = String(slug).trim().toLowerCase();

  const headers = { Accept: "application/json" };
  const osKey = typeof env.OPENSEA_API_KEY === "string" ? env.OPENSEA_API_KEY.trim() : "";
  if (osKey) headers["X-API-KEY"] = osKey;

  const osUrl = `https://api.opensea.io/api/v2/collections/${encodeURIComponent(s)}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(osUrl, { headers, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return null;
    if (Array.isArray(data.errors) && data.errors.length) return null;

    const contracts = Array.isArray(data.contracts) ? data.contracts : [];
    const chainNorm = (c) => String(c?.chain || "").toLowerCase();
    const eth = contracts.find((c) => {
      const ch = chainNorm(c);
      return ch === "ethereum" || ch === "eth" || ch === "mainnet";
    });
    const base = contracts.find((c) => chainNorm(c) === "base");
    const pick = eth || base || contracts[0];
    const addr = validateEthContract42(pick?.address);
    if (!addr) return null;

    const name =
      (typeof data.name === "string" && data.name.trim()) ||
      (typeof data.collection === "string" && data.collection.trim()) ||
      s;
    const rawImg = typeof data.image_url === "string" ? data.image_url.trim() : "";
    const image = rawImg ? repairBrokenImageUrl(rawImg) : null;
    return { name, contractAddress: addr, image };
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

async function handleApiSearchCollections(request, env) {
  const url = new URL(request.url);
  const rawQ = url.searchParams.get("q");
  const q = rawQ != null ? String(rawQ).trim() : "";

  const apiKey = getAlchemyKey(env);
  if (!apiKey) {
    return corsResponse(
      JSON.stringify({
        error:
          "Set ALCHEMY_API_KEY_COLLECTION_OVERLAP (recommended) or ALCHEMY_API_KEY as a Worker secret.",
      }),
      503
    );
  }

  if (!q) {
    return corsResponse(JSON.stringify({ success: true, results: [] }));
  }
  if (q.length > SEARCH_MAX_QUERY_LEN) {
    return corsResponse(JSON.stringify({ error: "Search query is too long." }), 400);
  }

  const out = [];
  const seenAddr = new Set();

  const pushUnique = (item) => {
    if (!item?.contractAddress) return;
    const a = validateEthContract42(item.contractAddress);
    if (!a || seenAddr.has(a)) return;
    seenAddr.add(a);
    out.push({ ...item, contractAddress: a });
  };

  const osDeriv = parseOpenSeaSearchDerivation(q);

  if (osDeriv.contract) {
    const meta = await fetchContractDisplayAuto(env, osDeriv.contract);
    pushUnique({
      name: meta.name || shortenWallet(osDeriv.contract),
      contractAddress: osDeriv.contract,
      image: meta.logoUrl,
    });
  }

  /** Slug-shaped `q` or collection slug parsed from a pasted OpenSea URL. */
  const slugForOpenSea =
    looksLikeOpenseaCollectionSlug(q) ? q : osDeriv.slug && looksLikeOpenseaCollectionSlug(osDeriv.slug) ? osDeriv.slug : null;
  if (slugForOpenSea) {
    const osHit = await tryOpenSeaSlugToCollection(slugForOpenSea, env);
    if (osHit) pushUnique(osHit);
  }

  const alchemyQuery = alchemySearchQueryForEvm(q, osDeriv);
  const alchemyUrl = new URL(`https://${ALCHEMY_ETH_HOST}/nft/v3/${apiKey}/searchContractMetadata`);
  alchemyUrl.searchParams.set("query", alchemyQuery);

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(alchemyUrl.toString(), { signal: controller.signal });
  } catch (e) {
    const msg = e?.name === "AbortError" ? "Search timed out. Try again." : e?.message || "Search failed.";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  } finally {
    clearTimeout(tid);
  }

  if (res.status === 429) {
    return corsResponse(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }), 429);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return corsResponse(
      JSON.stringify({ error: `Search failed (${res.status}). ${txt.slice(0, 200)}` }),
      502
    );
  }

  const data = await res.json().catch(() => null);
  if (data && typeof data === "object" && data.error?.message) {
    return corsResponse(JSON.stringify({ error: String(data.error.message) }), 502);
  }

  const rows = Array.isArray(data) ? data : Array.isArray(data?.contracts) ? data.contracts : [];
  for (const row of rows) {
    const mapped = mapAlchemySearchContractRow(row);
    if (mapped) pushUnique(mapped);
    if (out.length >= SEARCH_MAX_RESULTS) break;
  }

  /** Valid 0x address as `q` but Alchemy search empty — resolve like /api/contract-display. */
  if (out.length === 0) {
    const addr = validateEthContract42(q);
    if (addr) {
      const meta = await fetchContractDisplayAuto(env, addr);
      pushUnique({
        name: meta.name || shortenWallet(addr),
        contractAddress: addr,
        image: meta.logoUrl,
      });
    }
  }

  const deduped = dedupeSearchResults(out);
  return corsResponse(JSON.stringify({ success: true, results: deduped }));
}

/** Dedupe by contract address; only valid 0x40 hex; max SEARCH_MAX_RESULTS. */
function dedupeSearchResults(items) {
  const seen = new Set();
  const list = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const addr = validateEthContract42(it.contractAddress);
    if (!addr) continue;
    if (seen.has(addr)) continue;
    seen.add(addr);
    list.push({
      name: typeof it.name === "string" && it.name.trim() ? it.name.trim() : shortenWallet(addr),
      contractAddress: addr,
      image: typeof it.image === "string" && it.image.trim() ? repairBrokenImageUrl(it.image.trim()) : null,
    });
    if (list.length >= SEARCH_MAX_RESULTS) break;
  }
  return list;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/" && request.method === "GET") {
      const wantsJson = (request.headers.get("Accept") || "").includes("application/json");
      if (wantsJson) {
        return corsResponse(
          JSON.stringify({
            service: "collection-overlap",
            docs:
              "GET /api/collection-overlap?contractA=0x...&contractB=0x... · GET /api/collection-overlap-solana?mintA=...&mintB=... · GET /api/search-collections?q=... · GET /api/search-collections-solana?q=... · GET /api/solana-collection-display?mint=... · GET /api/contract-display?address=0x...",
          })
        );
      }
      const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Collection Overlap API</title><style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}code{background:#eee;padding:.15em .35em;border-radius:4px}h1{font-size:1.25rem}</style></head><body><h1>Collection Overlap — API only</h1><p>This URL is the <strong>Cloudflare Worker</strong> (backend). You will not see the Little Ollie UI here.</p><p><strong>For the app:</strong> open <code>collection-overlap/index.html</code> with <strong>Live Server</strong> (or your static host). That page calls this Worker at <code>/api/collection-overlap</code>.</p><p><strong>Health check:</strong> <code>GET /api/collection-overlap?contractA=0x...&contractB=0x...</code> (valid 42-char contracts).</p><p><small>Send <code>Accept: application/json</code> for the compact JSON stub instead of this page.</small></p></body></html>`;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    if (url.pathname === "/api/collection-overlap" && request.method === "GET") {
      if (!getAlchemyKey(env)) {
        return corsResponse(
          JSON.stringify({
            error:
              "Set ALCHEMY_API_KEY_COLLECTION_OVERLAP (recommended) or ALCHEMY_API_KEY as a Worker secret.",
          }),
          503
        );
      }
      return handleApiCollectionOverlap(request, env);
    }

    if (url.pathname === "/api/collection-overlap-solana" && request.method === "GET") {
      if (!getHeliusKey(env)) {
        return corsResponse(
          JSON.stringify({
            error:
              "Helius key missing: set HELIUS_API_KEY in collection-overlap-api/.dev.vars and restart npm run dev.",
          }),
          503
        );
      }
      return handleApiCollectionOverlapSolana(request, env);
    }

    if (url.pathname === "/api/search-collections" && request.method === "GET") {
      return handleApiSearchCollections(request, env);
    }

    if (url.pathname === "/api/search-collections-solana" && request.method === "GET") {
      return handleApiSearchCollectionsSolana(request, env);
    }

    if (url.pathname === "/api/solana-collection-display" && request.method === "GET") {
      return handleApiSolanaCollectionDisplay(request, env);
    }

    if (url.pathname === "/api/contract-display" && request.method === "GET") {
      const addr = validateEthContract42(url.searchParams.get("address"));
      if (!addr) {
        return corsResponse(JSON.stringify({ success: false, error: "Invalid contract address" }), 400);
      }
      if (!getAlchemyKey(env)) {
        return corsResponse(
          JSON.stringify({
            success: false,
            error:
              "Set ALCHEMY_API_KEY_COLLECTION_OVERLAP (recommended) or ALCHEMY_API_KEY as a Worker secret.",
          }),
          503
        );
      }
      const d = await fetchContractDisplayAuto(env, addr);
      return corsResponse(
        JSON.stringify({
          success: true,
          contractAddress: addr,
          name: d.name,
          symbol: d.symbol,
          image: d.logoUrl,
          detectedChain: d.detectedChain || "eth",
        })
      );
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
