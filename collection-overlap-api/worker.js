/**
 * Little Ollie Labs — Collection Overlap API only.
 * GET /api/collection-overlap — Alchemy getOwnersForContract (ETH first, then Base auto-detect). No secrets in browser.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const ALCHEMY_ETH_HOST = "eth-mainnet.g.alchemy.com";
const ALCHEMY_BASE_HOST = "base-mainnet.g.alchemy.com";

/** Do not fall through to Base when Alchemy rate-limits (avoid doubling traffic). */
function isRateLimitError(e) {
  const m = String(e?.message || e || "").toLowerCase();
  return m.includes("429") || m.includes("rate limit");
}

function alchemyNftHostForChain(chain) {
  const c = String(chain || "").toLowerCase();
  return c === "base" ? ALCHEMY_BASE_HOST : ALCHEMY_ETH_HOST;
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

/** Cached holder pack after ETH→Base auto-detect (one key per contract address). */
function overlapAutoContractKey(addr) {
  return `overlap:auto:v1:${String(addr || "").trim().toLowerCase()}`;
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

/**
 * Paginated owners on a single chain.
 * @param {"eth"|"base"} chain
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
  let pageKey = null;
  let capped = false;
  const holderCap = getOptionalHolderCap(env);

  while (true) {
    const u = new URL(`https://${host}/nft/v3/${apiKey}/getOwnersForContract`);
    u.searchParams.set("contractAddress", contract);
    u.searchParams.set("withTokenBalances", "false");
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

    const rows = Array.isArray(data?.owners) ? data.owners : [];
    for (const row of rows) {
      let addr = "";
      if (typeof row === "string") addr = row.trim().toLowerCase();
      else addr = String(row?.ownerAddress || row?.address || "").trim().toLowerCase();
      if (/^0x[a-f0-9]{40}$/.test(addr)) owners.add(addr);
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
    fetchedAt,
    source: "alchemy",
    chain,
    capped,
  };
}

const NOT_FOUND_CHAINS = "Collection not found on supported chains";

/**
 * ETH first; if error or zero holders, Base. Stops as soon as ETH returns holders.
 * @returns {Promise<{ contractAddress: string, holders: string[], holderCount: number, fetchedAt: string, source: string, chain: "eth"|"base", capped: boolean }>}
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
    throw new Error(NOT_FOUND_CHAINS);
  }
  if (basePack && basePack.holderCount > 0) {
    return basePack;
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
  };

    return corsResponse(JSON.stringify(body));
}

// ---------------------------------------------------------------------------
// Collection search (Alchemy searchContractMetadata) — does not touch overlap
// ---------------------------------------------------------------------------

const SEARCH_MAX_QUERY_LEN = 160;
const SEARCH_MAX_RESULTS = 10;

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

  /** Slug-shaped queries: OpenSea first (matches copy-paste from opensea.io/collection/…). */
  const slugShaped = looksLikeOpenseaCollectionSlug(q);
  if (slugShaped) {
    const osHit = await tryOpenSeaSlugToCollection(q, env);
    if (osHit) pushUnique(osHit);
  }

  const alchemyUrl = new URL(`https://${ALCHEMY_ETH_HOST}/nft/v3/${apiKey}/searchContractMetadata`);
  alchemyUrl.searchParams.set("query", q);

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

  if (out.length === 0 && !slugShaped) {
    const osHit = await tryOpenSeaSlugToCollection(q, env);
    if (osHit) pushUnique(osHit);
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
              "GET /api/collection-overlap?contractA=0x...&contractB=0x... · GET /api/search-collections?q=... · GET /api/contract-display?address=0x...",
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

    if (url.pathname === "/api/search-collections" && request.method === "GET") {
      return handleApiSearchCollections(request, env);
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
