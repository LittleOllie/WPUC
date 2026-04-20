/**
 * Flex Grid Worker — Alchemy (ETH / Base / Polygon / ApeChain fallback) + Moralis (ApeChain primary) + /img proxy.
 * Image proxy: multi-gateway IPFS, HTTP fetch, timeouts, edge cache, CORS for canvas export.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const ALCHEMY_HOSTS = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
  apechain: "apechain-mainnet.g.alchemy.com",
};

/** ApeChain mainnet chain id 33139 = 0x8173. Moralis accepts slug `ape` or hex id — try several. */
const MORALIS_APE_CHAIN_FALLBACKS = ["ape", "0x8173", "33139", "apechain", "ape_chain"];
const MORALIS_API_BASE = "https://deep-index.moralis.io/api/v2.2";

/** Moralis / CDNs occasionally treat empty Worker UA as bot traffic. */
const MORALIS_OUTBOUND_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function getMoralisApeChainCandidates(env) {
  const o = env?.MORALIS_APECHAIN_CHAIN;
  const s = o && typeof o === "string" ? o.trim().toLowerCase() : "";
  if (s) {
    return [s, ...MORALIS_APE_CHAIN_FALLBACKS.filter((x) => x !== s)];
  }
  return [...MORALIS_APE_CHAIN_FALLBACKS];
}

/**
 * GET Moralis (ApeChain) URL: try each `chain` candidate until 200, or throw with last error.
 * @param {(chain: string) => string} buildUrl
 */
async function moralisApeGetParsed(env, buildUrl, timeoutMs = 30000, chainCandidatesOverride = null) {
  const cands = Array.isArray(chainCandidatesOverride) ? chainCandidatesOverride : getMoralisApeChainCandidates(env);
  const headers = getMoralisHeaders(env);
  let lastErr = "";
  for (const chainParam of cands) {
    const urlStr = buildUrl(chainParam);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(urlStr, { headers, signal: controller.signal });
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error(`[Moralis] ${res.status} ${text.slice(0, 600)}`);
      }
      if (res.ok) {
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          throw new Error("[Moralis ApeChain] invalid JSON body");
        }
        console.log("[FlexGrid][ApeChain] Moralis chain resolved:", chainParam);
        return { data, chainParam };
      }
      lastErr = `[Moralis ApeChain] ${res.status} ${text.slice(0, 800)}`;
      console.warn("[FlexGrid][ApeChain] chain candidate failed:", chainParam, "status=", res.status);
    } catch (e) {
      if (String(e?.message || "").startsWith("[Moralis]")) throw e;
      if (e?.name === "AbortError") {
        throw new Error("[Moralis ApeChain] request timed out");
      }
      lastErr = e?.message || String(e);
      console.warn("[FlexGrid][ApeChain] chain candidate error:", chainParam, lastErr);
    } finally {
      clearTimeout(tid);
    }
  }
  throw new Error(lastErr || "[Moralis ApeChain] all chain candidates failed");
}

function moralisWalletNftRows(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.nft)) return data.nft;
  if (Array.isArray(data.nfts)) return data.nfts;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

/** Build Moralis wallet-NFT URL; `minimal` skips media_items / normalizeMetadata (some chains reject them). */
function buildMoralisWalletNftUrl(ownerVal, chainParam, cursor, contractAddresses, minimal, apiBase = MORALIS_API_BASE) {
  const u = new URL(`${apiBase}/${encodeURIComponent(ownerVal)}/nft`);
  u.searchParams.set("chain", chainParam);
  u.searchParams.set("format", "decimal");
  u.searchParams.set("limit", "100");
  if (cursor) u.searchParams.set("cursor", cursor);
  if (contractAddresses?.length) {
    for (const a of contractAddresses) u.searchParams.append("token_addresses", a);
  }
  if (!minimal) {
    u.searchParams.set("media_items", "true");
    u.searchParams.set("normalizeMetadata", "true");
  }
  return u.toString();
}

/**
 * Alchemy NFT API v3 `getNFTsForOwner` for every supported chain.
 * Previously only ApeChain used v3 while ETH/Base/Polygon used legacy v2 — different payloads
 * meant ApeChain alone exercised `raw.metadata` / stringified `metadata` cleanup. One path
 * keeps normalization and image/logo extraction consistent across chains.
 */
function alchemyGetNftsForOwnerUrl(_chain, host, apiKey) {
  return `https://${host}/nft/v3/${apiKey}/getNFTsForOwner`;
}

/** Alchemy key: main app key for ETH/Base/Polygon; ApeChain uses optional `ALCHEMY_API_KEY_APECHAIN` else main key (Moralis fallback). */
function pickAlchemyApiKeyForChain(env, chain) {
  const c = String(chain || "").trim().toLowerCase();
  const main = env.ALCHEMY_API_KEY;
  const mainTrim = main && typeof main === "string" ? main.trim() : "";
  if (c === "apechain") {
    const ape = env.ALCHEMY_API_KEY_APECHAIN;
    const apeTrim = ape && typeof ape === "string" ? ape.trim() : "";
    return apeTrim || mainTrim || "";
  }
  return mainTrim;
}

function getMoralisApiKey(env) {
  const k = env.MORALIS_API_KEY;
  return k && typeof k === "string" ? k.trim() : "";
}

function getMoralisHeaders(env) {
  const apiKey = getMoralisApiKey(env);
  if (!apiKey) {
    throw new Error("Missing MORALIS_API_KEY (set Cloudflare secret MORALIS_API_KEY for ApeChain).");
  }
  return {
    "X-API-Key": apiKey,
    Accept: "application/json",
    "User-Agent": MORALIS_OUTBOUND_UA,
  };
}

// ---------------------------------------------------------------------------
// Image proxy — config
// ---------------------------------------------------------------------------

const IPFS_GATEWAYS = [
  "https://dweb.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

/** Subrequest hints: cache at Cloudflare edge between Worker and origin/gateway */
const ORIGIN_FETCH_CF = {
  cacheEverything: true,
  cacheTtl: 86400,
};

const IMAGE_FETCH_TIMEOUT_MS = 8000;
const IMAGE_HTTP_RETRY_DELAY_MS = 400;
const MAX_IMAGE_BYTES = 45 * 1024 * 1024; // safety cap (45MB)

const ALLOWED_IMAGE_TYPES = [
  "image/",
  "application/octet-stream", // some IPFS gateways
];

const DEFAULT_IMAGE_CONTENT_TYPE = "image/png";

function imageProxyDebug(env, message, extra) {
  if (env?.IMAGE_PROXY_DEBUG !== "1" && env?.IMAGE_PROXY_DEBUG !== "true") return;
  if (extra !== undefined) console.log("[img]", message, extra);
  else console.log("[img]", message);
}

/**
 * Decode `url` query param (handles double-encoding).
 */
function fullyDecodeUrlParam(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  for (let i = 0; i < 5; i++) {
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch {
      break;
    }
  }
  return s.trim();
}

/**
 * Moralis / metadata sometimes yields protocol-relative hosts, over-escaped paths, or a broken
 * `https:///2F…` prefix (seen with w3s.link subdomain CIDs). Normalize before fetch or proxy.
 */
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

function moralisCoerceUrlString(val) {
  if (val == null) return null;
  if (typeof val === "object" && val) {
    const u = val.url || val.uri || val.gateway || val.cdnUrl;
    if (typeof u === "string" && u.trim()) return repairBrokenImageUrl(u.trim());
    return null;
  }
  if (typeof val !== "string") return null;
  let s = val.trim();
  if (!s || s === "[object Object]") return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      const j = JSON.parse(s);
      if (typeof j === "string") s = j;
      else s = s.slice(1, -1);
    } catch {
      s = s.slice(1, -1);
    }
  }
  s = s.trim();
  return s ? repairBrokenImageUrl(s) : null;
}

/** token_uri almost always points at JSON metadata — only treat as image when it clearly is one. */
function moralisTokenUriAsImageCandidate(uri) {
  const s = moralisCoerceUrlString(uri);
  if (!s) return null;
  if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(s)) return s;
  if (/^ipfs:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(s)) return s;
  return null;
}

/**
 * Extract IPFS path (CID[/subpath]) for gateway concatenation, or null for plain HTTP(S).
 */
function normalizeIPFS(url) {
  if (!url) return null;

  let s = url;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep s */
  }

  if (s.startsWith("ipfs://")) {
    let path = s.slice("ipfs://".length).replace(/^\/+/, "");
    path = path.replace(/^ipfs\//i, "");
    return path || null;
  }

  const match = s.match(/\/ipfs\/(.+)/i);
  if (match) {
    let path = match[1].split("?")[0].split("#")[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      /* keep */
    }
    return path.replace(/^\/+/, "") || null;
  }

  /** `https://<cid>.ipfs.w3s.link/file.jpg` — CID is in the host, not `/ipfs/…`. */
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:") {
      const host = u.hostname.toLowerCase();
      const sub = host.match(/^([a-zA-Z0-9]{30,})\.ipfs\.(w3s\.link|dweb\.link)$/);
      if (sub) {
        const cid = sub[1];
        const tail = (u.pathname || "").replace(/^\/+/, "").split("?")[0].split("#")[0];
        return tail ? `${cid}/${tail}` : cid;
      }
    }
  } catch {
    /* not a URL */
  }

  return null;
}

/**
 * Normalize IPFS path segment for gateway URLs (no leading slash).
 */
function sanitizeIpfsPathForGateway(ipfsPath) {
  if (!ipfsPath) return "";
  return String(ipfsPath).replace(/^\/+/, "").trim();
}

/** OpenSea / Looksrare CDNs often 404 or return HTML unless the request looks browser-like. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function headersForImageOrigin(url) {
  const u = String(url || "");
  if (/arweave\.net|ar-io\.dev/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    };
  }
  if (/\.ipfs\.w3s\.link|\.ipfs\.dweb\.link|\/ipfs\/|ipfs\.io\/ipfs|nftstorage\.link\/ipfs|cloudflare-ipfs/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    };
  }
  if (/seadn\.io|looksrare|cdn\.blur\.io|openseauserdata\.com/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://opensea.io/",
    };
  }
  return { "User-Agent": "FlexGrid-ImageProxy/2.0" };
}

async function fetchWithTimeout(resource, timeoutMs = IMAGE_FETCH_TIMEOUT_MS, headerOverrides = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, {
      redirect: "follow",
      headers: {
        ...headersForImageOrigin(resource),
        ...headerOverrides,
      },
      signal: controller.signal,
      cf: ORIGIN_FETCH_CF,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Accept as image body: correct status, size cap, and plausible Content-Type (or unknown for IPFS).
 */
function isAcceptableImageResponse(res, { allowUnknownContentType } = {}) {
  if (!res || !res.ok) return false;
  const lenHeader = res.headers.get("Content-Length");
  if (lenHeader) {
    const n = parseInt(lenHeader, 10);
    if (Number.isFinite(n) && n > MAX_IMAGE_BYTES) return false;
  }
  const ct = (res.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!ct) return !!allowUnknownContentType;
  if (ALLOWED_IMAGE_TYPES.some((p) => ct.startsWith(p))) return true;
  if (allowUnknownContentType && ct === "") return true;
  // Block obvious HTML/JSON error pages
  if (ct.includes("text/html") || ct.includes("application/json")) return false;
  return !!allowUnknownContentType;
}

function buildImageProxyResponse(originResponse, contentType) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Expose-Headers", "Content-Type, Content-Length, Cache-Control");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Type", contentType || DEFAULT_IMAGE_CONTENT_TYPE);

  const len = originResponse.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);

  return new Response(originResponse.body, {
    status: 200,
    statusText: "OK",
    headers,
  });
}

function imageProxyError(status, message) {
  return new Response(message, {
    status,
    headers: {
      ...CORS,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

/**
 * Try IPFS path across gateways; optional quick second pass for flaky networks.
 */
async function fetchIPFS(ipfsPath, env) {
  const path = sanitizeIpfsPathForGateway(ipfsPath);
  if (!path) return null;

  const tryOnce = async () => {
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + path;
      try {
        const res = await fetchWithTimeout(url, IMAGE_FETCH_TIMEOUT_MS);
        if (isAcceptableImageResponse(res, { allowUnknownContentType: true })) {
          return res;
        }
      } catch {
        /* next gateway */
      }
    }
    return null;
  };

  let res = await tryOnce();
  if (res) return res;

  await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
  res = await tryOnce();
  return res;
}

/**
 * Plain HTTP(S) image: one attempt + one retry after delay.
 */
async function fetchHttpImage(decodedUrl, env) {
  const attempts = [
    () => fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS),
    async () => {
      await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
      return fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS);
    },
  ];

  const relaxCtOnRetry = /seadn\.io|openseauserdata\.com/i.test(decodedUrl);

  for (let i = 0; i < attempts.length; i++) {
    try {
      const res = await attempts[i]();
      const allowUnknown = relaxCtOnRetry && i > 0;
      if (isAcceptableImageResponse(res, { allowUnknownContentType: allowUnknown })) {
        return res;
      }
    } catch {
      /* retry */
    }
  }
  return null;
}

/**
 * Optional: try original URL once when it looks like IPFS HTTP URL (before pure gateway path).
 */
async function fetchDirectIpfsUrl(decodedUrl, env) {
  if (!/^https?:\/\//i.test(decodedUrl)) return null;
  const looksIpfs =
    /\/ipfs\//i.test(decodedUrl) ||
    /\.ipfs\.(w3s\.link|dweb\.link)/i.test(decodedUrl) ||
    /ipfs\.io\/ipfs/i.test(decodedUrl);
  if (!looksIpfs) return null;
  try {
    const res = await fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS);
    if (isAcceptableImageResponse(res, { allowUnknownContentType: true })) return res;
  } catch {
    /* fall through */
  }
  return null;
}

async function handleImageProxy(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const urlObj = new URL(request.url);
  const rawParam = urlObj.searchParams.get("url");
  if (!rawParam || !String(rawParam).trim()) {
    return imageProxyError(400, "Missing url");
  }

  let decodedUrl = fullyDecodeUrlParam(rawParam);
  if (!decodedUrl) {
    return imageProxyError(400, "Invalid url");
  }
  decodedUrl = repairBrokenImageUrl(decodedUrl);

  /** Inline raster/SVG — do not fetch; decode here (client should skip proxy for data: URLs). */
  if (/^data:image\//i.test(decodedUrl)) {
    const m = decodedUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i);
    if (m) {
      try {
        const binStr = atob(m[2].replace(/\s/g, ""));
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": m[1],
            "Cache-Control": "public, max-age=86400",
            ...CORS,
          },
        });
      } catch (e) {
        return imageProxyError(400, "Invalid data URL");
      }
    }
    return imageProxyError(400, "Unsupported data URL (use base64 image/* only)");
  }

  // Alchemy / on-chain metadata often uses ar://…; Worker /img only fetches http(s).
  if (/^ar:\/\//i.test(decodedUrl)) {
    const id = decodedUrl.replace(/^ar:\/\//i, "").replace(/^\/+/, "");
    decodedUrl = id ? `https://arweave.net/${id}` : decodedUrl;
  }

  const ipfsPath = normalizeIPFS(decodedUrl);

  imageProxyDebug(env, "Fetching:", decodedUrl);
  imageProxyDebug(env, "IPFS path:", ipfsPath);

  let originRes = null;

  if (ipfsPath) {
    originRes = await fetchDirectIpfsUrl(decodedUrl, env);
    if (!originRes) {
      originRes = await fetchIPFS(ipfsPath, env);
    }
  } else {
    if (!/^https?:\/\//i.test(decodedUrl)) {
      return imageProxyError(400, "Unsupported URL scheme");
    }
    originRes = await fetchHttpImage(decodedUrl, env);
  }

  if (!originRes || !originRes.ok) {
    return imageProxyError(404, "Image not found");
  }

  const ct =
    originRes.headers.get("Content-Type")?.split(";")[0].trim() || DEFAULT_IMAGE_CONTENT_TYPE;
  const out = buildImageProxyResponse(originRes, ct);

  try {
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
  } catch (e) {
    console.warn("[img] cache.put failed:", e?.message || e);
  }

  return out;
}

// ---------------------------------------------------------------------------
// JSON API helpers
// ---------------------------------------------------------------------------

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS },
  });
}

/** Alchemy often returns `metadata` as a JSON string; spreading it into `{}` breaks image fields. */
function tryParseJsonObject(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  if (typeof val !== "string") return null;
  const t = val.trim();
  if (!t || (t[0] !== "{" && t[0] !== "[")) return null;
  try {
    const o = JSON.parse(t);
    return typeof o === "object" && o !== null ? o : null;
  } catch {
    return null;
  }
}

/** Merge parsed metadata layers (v2/v3); later layers override earlier ones. */
function mergedTokenMetadata(nft) {
  const m0 = tryParseJsonObject(nft?.metadata) || (typeof nft?.metadata === "object" && nft.metadata ? nft.metadata : {});
  const m1 = tryParseJsonObject(nft?.rawMetadata) || (typeof nft?.rawMetadata === "object" && nft.rawMetadata ? nft.rawMetadata : {});
  const m2 = tryParseJsonObject(nft?.raw?.metadata) || (typeof nft?.raw?.metadata === "object" && nft.raw?.metadata ? nft.raw.metadata : {});
  return { ...m0, ...m1, ...m2 };
}

function collectionOpenSeaImageUrl(nft) {
  const os =
    nft?.contractMetadata?.openSea ||
    nft?.contractMetadata?.openSeaMetadata ||
    nft?.contract?.openSea ||
    nft?.contract?.openSeaMetadata ||
    nft?.collection?.openSea ||
    nft?.collection?.openSeaMetadata ||
    {};
  const u = os.imageUrl || os.image_url;
  if (typeof u === "string" && u.trim()) return u.trim();
  const colImg =
    (typeof nft?.collection?.imageUrl === "string" && nft.collection.imageUrl.trim()) ||
    (typeof nft?.collection?.image_url === "string" && nft.collection.image_url.trim()) ||
    null;
  return colImg || null;
}

function resolveTokenImageUrl(nft, collectionLogo) {
  const merged = mergedTokenMetadata(nft);
  const normLogo = collectionLogo ? String(collectionLogo).trim() : "";
  const tryStr = (c) => {
    if (c == null) return null;
    const s = repairBrokenImageUrl(String(c).trim());
    if (!s) return null;
    if (normLogo && s === normLogo) return null;
    return s;
  };
  const rawCandidates = [
    merged.image,
    merged.image_url,
    nft?.raw?.metadata?.image,
    nft?.raw?.metadata?.image_url,
    nft?.media?.[0]?.thumbnail,
    nft?.media?.[0]?.gateway,
    nft?.media?.[0]?.raw,
  ];
  for (const c of rawCandidates) {
    if (c == null) continue;
    if (typeof c === "object" && c && typeof c.url === "string") {
      const s = tryStr(c.url);
      if (s) return s;
      continue;
    }
    const s = tryStr(c);
    if (s) return s;
  }
  const img = nft?.image;
  if (img != null) {
    const u =
      typeof img === "string"
        ? img
        : img?.cachedUrl || img?.pngUrl || img?.thumbnailUrl || img?.originalUrl || "";
    const s = String(u).trim();
    if (s && (!normLogo || s !== normLogo)) return s;
  }
  return null;
}

/** One FlexGrid-shaped NFT (shared by Alchemy + Moralis pseudo-Alchemy payloads). */
function buildCleanedNft(nft) {
  const collectionLogo = collectionOpenSeaImageUrl(nft);
  const image = resolveTokenImageUrl(nft, collectionLogo);
  const merged = mergedTokenMetadata(nft);
  const meta = { ...merged };
  if (typeof meta.image === "string" && collectionLogo && meta.image.trim() === collectionLogo) {
    delete meta.image;
  }
  if (typeof meta.image_url === "string" && collectionLogo && meta.image_url.trim() === collectionLogo) {
    delete meta.image_url;
  }
  if (image) {
    meta.image = image;
  }
  return {
    ...nft,
    contract: nft.contract || { address: nft.contract?.address },
    contractAddress: nft.contract?.address,
    name: nft.title || nft.metadata?.name || nft.name || "Unknown",
    image: image || null,
    metadata: meta,
    media: nft?.media?.length ? nft.media : (image ? [{ gateway: image, raw: image }] : []),
    collection: nft.collection || { name: nft.contractMetadata?.name || "Unknown Collection" },
    contractMetadata: nft.contractMetadata || { name: nft.contractMetadata?.name || "Unknown Collection" },
    tokenId: nft.id?.tokenId ?? nft.tokenId,
    id: nft.id || { tokenId: nft.id?.tokenId ?? nft.tokenId },
    balance: nft.balance ?? "1",
    tokenType: nft.tokenType || nft.id?.tokenMetadata?.tokenType || "ERC721",
  };
}

function safeJsonParseMoralis(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function pickBestMoralisImage(nft, metadata, normalized) {
  const mediaRoot = nft?.media;
  const mc = mediaRoot?.media_collection;
  const fromMc =
    moralisCoerceUrlString(mc?.high?.url) ||
    moralisCoerceUrlString(mc?.medium?.url) ||
    moralisCoerceUrlString(mc?.low?.url) ||
    moralisCoerceUrlString(mc?.thumbnail?.url);
  const fromMediaRoot =
    moralisCoerceUrlString(mediaRoot?.original_media_url) ||
    moralisCoerceUrlString(mediaRoot?.cached_media_url) ||
    moralisCoerceUrlString(mediaRoot?.media_url) ||
    moralisCoerceUrlString(mediaRoot?.moralis_media_url);
  const fromNorm =
    moralisCoerceUrlString(normalized?.image) || moralisCoerceUrlString(normalized?.image_url);
  const fromMeta =
    moralisCoerceUrlString(metadata?.image) || moralisCoerceUrlString(metadata?.image_url);
  const fromTokenUri = moralisTokenUriAsImageCandidate(nft?.token_uri);
  return fromMc || fromMediaRoot || fromNorm || fromMeta || fromTokenUri || null;
}

function moralisMediaToMediaArray(media, rawImg) {
  if (rawImg) return [{ gateway: rawImg, thumbnail: rawImg, raw: rawImg }];
  const mc = media?.media_collection;
  const u = mc?.medium?.url || mc?.high?.url || mc?.low?.url;
  if (u) return [{ gateway: u, thumbnail: u, raw: u }];
  return [];
}

/** Map one Moralis wallet-NFT row → Alchemy-like object so `buildCleanedNft` stays unified. */
function moralisRowToPseudoAlchemy(m) {
  const tokenAddress = String(m.token_address || "").trim().toLowerCase();
  const tokenId = String(m.token_id ?? "").trim();
  const metadata = safeJsonParseMoralis(m.metadata);
  const normalized = m.normalized_metadata && typeof m.normalized_metadata === "object" ? m.normalized_metadata : {};
  const mergedMeta = { ...metadata, ...normalized };
  for (const k of ["image", "image_url", "collection_image", "collection_logo"]) {
    const coerced = moralisCoerceUrlString(mergedMeta[k]);
    if (coerced) mergedMeta[k] = coerced;
    else if (mergedMeta[k] != null && typeof mergedMeta[k] === "object") delete mergedMeta[k];
  }
  const rawImg = pickBestMoralisImage(m, metadata, normalized);
  const colName =
    normalized.collection_name ||
    mergedMeta.collection_name ||
    m.collection_name ||
    m.symbol ||
    mergedMeta.symbol ||
    "Unknown Collection";
  const tokenName = normalized.name || mergedMeta.name || m.name || `#${tokenId}`;
  const collLogo =
    moralisCoerceUrlString(m.collection_logo) ||
    moralisCoerceUrlString(m.collection_banner_image) ||
    moralisCoerceUrlString(normalized.collection_image) ||
    moralisCoerceUrlString(normalized.collection_logo) ||
    null;
  const tt = String(m.contract_type || "ERC721").toUpperCase() === "ERC1155" ? "ERC1155" : "ERC721";
  const mediaArr = moralisMediaToMediaArray(m.media, rawImg);
  return {
    contract: { address: tokenAddress, name: m.name || colName },
    contractAddress: tokenAddress,
    collection: {
      name: colName,
      address: tokenAddress,
      ...(collLogo ? { imageUrl: collLogo } : {}),
    },
    contractMetadata: {
      name: colName,
      openSeaMetadata: collLogo ? { imageUrl: collLogo } : {},
    },
    tokenId,
    id: { tokenId, tokenMetadata: { tokenType: tt } },
    tokenType: tt,
    title: tokenName,
    name: tokenName,
    metadata: mergedMeta,
    image: rawImg ? { cachedUrl: rawImg, originalUrl: rawImg, thumbnailUrl: rawImg } : null,
    media: mediaArr.length ? mediaArr : undefined,
    rawMetadata: mergedMeta,
    balance: m.amount != null ? String(m.amount) : "1",
  };
}

async function fetchMoralisApeChainNFTsFromMoralis(ownerVal, env, contractAddresses) {
  const all = [];
  let cursor = null;
  let page = 0;
  let lockedChain = null;
  /** Reuse the same Moralis API path + query flags after the first successful page (cursor is tied to that shape). */
  let lockedStrategy = null;
  const MORALIS_API_BASE_LEGACY = "https://deep-index.moralis.io/api/v2";

  do {
    page += 1;
    const chainOpts = lockedChain ? [lockedChain] : null;
    const strategyList = lockedStrategy
      ? [lockedStrategy]
      : [
          { minimal: false, base: MORALIS_API_BASE, name: "full-v2.2" },
          { minimal: true, base: MORALIS_API_BASE, name: "minimal-v2.2" },
          { minimal: true, base: MORALIS_API_BASE_LEGACY, name: "minimal-v2" },
        ];

    let pagePack = null;
    let lastPageErr = "";
    for (const st of strategyList) {
      try {
        pagePack = await moralisApeGetParsed(
          env,
          (chainParam) => {
            const urlStr = buildMoralisWalletNftUrl(ownerVal, chainParam, cursor, contractAddresses, st.minimal, st.base);
            console.log("[FlexGrid][ApeChain] Moralis request:", st.name, urlStr);
            return urlStr;
          },
          30000,
          chainOpts
        );
        lockedStrategy = { minimal: st.minimal, base: st.base, name: st.name };
        if (st.name !== "full-v2.2") {
          console.warn("[FlexGrid][ApeChain] Moralis wallet NFT page used fallback strategy:", st.name);
        }
        break;
      } catch (e) {
        lastPageErr = e?.message || String(e);
        console.warn("[FlexGrid][ApeChain] strategy failed:", st.name, lastPageErr.slice(0, 280));
      }
    }
    if (!pagePack) {
      throw new Error(lastPageErr || "[Moralis ApeChain] all strategies failed for wallet NFT page");
    }

    const { data, chainParam } = pagePack;
    lockedChain = chainParam;
    const pageResults = moralisWalletNftRows(data);
    console.log("[FlexGrid][ApeChain] Moralis page", page, "results:", pageResults.length, "chain=", lockedChain);
    for (const row of pageResults) all.push(row);
    cursor = data.cursor && String(data.cursor).trim() ? String(data.cursor).trim() : null;
  } while (cursor);
  console.log("[FlexGrid][ApeChain] total Moralis rows:", all.length, "owner:", ownerVal);
  return all;
}

/**
 * Single Moralis wallet NFT page (ApeChain).
 * Returns { rows, cursor, chainParam } where cursor is the NEXT cursor (or null).
 */
async function fetchMoralisApeChainNFTPage(ownerVal, env, contractAddresses, cursorIn) {
  const MORALIS_API_BASE_LEGACY = "https://deep-index.moralis.io/api/v2";
  const cursor = cursorIn && String(cursorIn).trim() ? String(cursorIn).trim() : null;
  let lockedChain = null;
  let lockedStrategy = null;

  const chainOpts = lockedChain ? [lockedChain] : null;
  const strategyList = lockedStrategy
    ? [lockedStrategy]
    : [
        { minimal: false, base: MORALIS_API_BASE, name: "full-v2.2" },
        { minimal: true, base: MORALIS_API_BASE, name: "minimal-v2.2" },
        { minimal: true, base: MORALIS_API_BASE_LEGACY, name: "minimal-v2" },
      ];

  let pagePack = null;
  let lastPageErr = "";
  for (const st of strategyList) {
    try {
      pagePack = await moralisApeGetParsed(
        env,
        (chainParam) => {
          const urlStr = buildMoralisWalletNftUrl(ownerVal, chainParam, cursor, contractAddresses, st.minimal, st.base);
          console.log("[FlexGrid][ApeChain] Moralis request (pageOnly):", st.name, urlStr);
          return urlStr;
        },
        30000,
        chainOpts
      );
      lockedStrategy = { minimal: st.minimal, base: st.base, name: st.name };
      if (st.name !== "full-v2.2") {
        console.warn("[FlexGrid][ApeChain] Moralis wallet NFT page used fallback strategy:", st.name);
      }
      break;
    } catch (e) {
      lastPageErr = e?.message || String(e);
      console.warn("[FlexGrid][ApeChain] strategy failed:", st.name, lastPageErr.slice(0, 280));
    }
  }
  if (!pagePack) {
    throw new Error(lastPageErr || "[Moralis ApeChain] all strategies failed for wallet NFT page");
  }

  const { data, chainParam } = pagePack;
  lockedChain = chainParam;
  const pageResults = moralisWalletNftRows(data);
  const nextCursor = data.cursor && String(data.cursor).trim() ? String(data.cursor).trim() : null;
  console.log("[FlexGrid][ApeChain] Moralis pageOnly results:", pageResults.length, "nextCursor?", !!nextCursor, "chain=", lockedChain);
  return { rows: pageResults, cursor: nextCursor, chainParam: lockedChain };
}

async function fetchAlchemyNftsForOwner(env, ownerVal, chain, contractAddresses, opts = {}) {
  const apiKey = pickAlchemyApiKeyForChain(env, chain);
  if (!apiKey) {
    return corsResponse(
      JSON.stringify({
        error: "Missing Alchemy API key. Set ALCHEMY_API_KEY (Cloudflare secret).",
      }),
      503
    );
  }

  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  if (!ALCHEMY_HOSTS[chain]) {
    return corsResponse(JSON.stringify({ error: `Unsupported chain for Alchemy: ${chain}` }), 400);
  }

  const baseUrl = alchemyGetNftsForOwnerUrl(chain, host, apiKey);
  const allNFTs = [];
  const pageOnly = opts && opts.pageOnly === true;
  const minimal = opts && opts.minimal === true;
  let pageKey = opts && typeof opts.pageKey === "string" && opts.pageKey.trim() ? opts.pageKey.trim() : null;

  console.log("[FlexGrid Worker] NFT fetch (Alchemy)", { chain, host, owner: ownerVal });

  try {
    do {
      const params = new URLSearchParams({
        owner: ownerVal,
        withMetadata: minimal ? "false" : "true",
        pageSize: "100",
      });
      if (pageKey) params.set("pageKey", pageKey);
      params.set("tokenUriTimeoutInMs", "20000");
      if (contractAddresses?.length) {
        contractAddresses.forEach((addr) => params.append("contractAddresses[]", addr));
      }

      const fetchUrl = `${baseUrl}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const t = await res.text();
        return corsResponse(JSON.stringify({ error: t || `Alchemy ${res.status}` }), 502);
      }

      const data = await res.json().catch(() => ({}));
      if (data?.error?.message) {
        return corsResponse(JSON.stringify({ error: data.error.message }), 502);
      }
      const nfts = data.ownedNfts || data.nfts || [];
      for (const n of nfts) allNFTs.push(n);

      pageKey = data.pageKey || data.pageToken || null;
      console.log("[FlexGrid Worker] Alchemy NFT page", {
        pageSize: nfts.length,
        totalSoFar: allNFTs.length,
        hasMore: !!pageKey,
      });
      if (pageOnly) break;
    } while (pageKey);

    console.log("[FlexGrid Worker] total Alchemy NFTs:", allNFTs.length, "chain:", chain, "pageOnly:", pageOnly);
    const cleaned = allNFTs.map(buildCleanedNft);
    return corsResponse(JSON.stringify({ nfts: cleaned, pageKey: pageOnly ? pageKey : null }));
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? "Request timed out. Try again with fewer wallets."
        : e?.message || "NFT fetch failed";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }
}

async function handleApiNfts(request, env) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();
  const contractAddressesParam = url.searchParams.get("contractAddresses");
  const pageKey = url.searchParams.get("pageKey");
  const pageOnly = url.searchParams.get("pageOnly") === "1" || url.searchParams.get("pageOnly") === "true";
  const minimal = url.searchParams.get("minimal") === "1" || url.searchParams.get("minimal") === "true";

  if (!owner || String(owner).trim() === "") {
    return corsResponse(JSON.stringify({ error: "Missing owner" }), 400);
  }

  const ownerVal = owner.trim().toLowerCase();
  const contractAddresses = contractAddressesParam
    ? contractAddressesParam.split(",").map((a) => a.trim().toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a))
    : null;

  console.log("[FlexGrid Worker] /api/nfts chain=", chain, "owner=", ownerVal);

  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(
        JSON.stringify({
          error:
            "ApeChain needs MORALIS_API_KEY and/or ALCHEMY_API_KEY. Moralis is tried first; if it fails, Alchemy (apechain-mainnet) is used when a key is set.",
        }),
        503
      );
    }
    if (hasMoralis) {
      try {
        // IMPORTANT: Use pageOnly for ApeChain to avoid Cloudflare Worker subrequest limits on very large wallets.
        // Moralis uses cursor pagination; we expose it through pageKey to the client.
        const pack = pageOnly
          ? await fetchMoralisApeChainNFTPage(ownerVal, env, contractAddresses, pageKey)
          : { rows: await fetchMoralisApeChainNFTsFromMoralis(ownerVal, env, contractAddresses), cursor: null, chainParam: "apechain" };
        const rows = pack.rows || [];
        const cleaned = [];
        for (const row of rows) {
          try {
            const pseudo = moralisRowToPseudoAlchemy(row);
            cleaned.push(buildCleanedNft(pseudo));
          } catch (rowErr) {
            console.warn("[FlexGrid][ApeChain] skip NFT row:", rowErr?.message || rowErr, row?.token_id, row?.token_address);
          }
        }
        const sample = cleaned[0];
        console.log(
          "[FlexGrid][ApeChain] Moralis cleaned sample:",
          sample ? { contract: sample.contractAddress, tokenId: sample.tokenId, hasImage: !!sample.image } : null
        );
        let body;
        try {
          body = JSON.stringify({ nfts: cleaned });
        } catch (serErr) {
          console.error("[FlexGrid][ApeChain] JSON.stringify failed:", serErr?.message || serErr);
          if (!hasAlchemy) {
            return corsResponse(JSON.stringify({ error: "Failed to encode NFT list (unexpected Moralis field types)." }), 502);
          }
          console.warn("[FlexGrid][ApeChain] JSON encode failed; falling back to Alchemy.");
        }
        if (body) {
          // pageKey here is Moralis cursor; only set when pageOnly is requested.
          if (pageOnly) {
            return corsResponse(JSON.stringify({ nfts: cleaned, pageKey: pack.cursor || null }));
          }
          return corsResponse(body);
        }
      } catch (e) {
        const msg = e?.message || "ApeChain Moralis fetch failed";
        console.error("[FlexGrid][ApeChain] Moralis error:", msg);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: msg.slice(0, 4000) }), 502);
        }
        console.warn("[FlexGrid][ApeChain] Falling back to Alchemy getNFTsForOwner (ApeChain).");
      }
    }
    // Moralis cursor pagination doesn't map cleanly to Alchemy pageKey. Keep ApeChain behavior unchanged.
    return fetchAlchemyNftsForOwner(env, ownerVal, "apechain", contractAddresses, { pageKey, pageOnly, minimal });
  }

  return fetchAlchemyNftsForOwner(env, ownerVal, chain, contractAddresses, { pageKey, pageOnly, minimal });
}

async function handleApiNftMetadata(request, env) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();

  if (!contract || !tokenId) {
    return corsResponse(JSON.stringify({ error: "Missing contract or tokenId" }), 400);
  }

  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(JSON.stringify({ error: "Missing MORALIS_API_KEY and ALCHEMY_API_KEY for ApeChain metadata." }), 503);
    }
    if (hasMoralis) {
      try {
        const ct = encodeURIComponent(String(contract).trim());
        const tid = encodeURIComponent(String(tokenId).trim());
        const { data: json } = await moralisApeGetParsed(
          env,
          (chainParam) => {
            const u = new URL(`${MORALIS_API_BASE}/nft/${ct}/${tid}`);
            u.searchParams.set("chain", chainParam);
            u.searchParams.set("format", "decimal");
            u.searchParams.set("media_items", "true");
            u.searchParams.set("normalizeMetadata", "true");
            console.log("[FlexGrid][ApeChain] Moralis NFT metadata:", u.toString());
            return u.toString();
          },
          20000
        );
        return corsResponse(JSON.stringify(json));
      } catch (e) {
        console.warn("[FlexGrid][ApeChain] Moralis NFT metadata failed:", e?.message || e);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: e?.message || "Moralis metadata fetch failed" }), 502);
        }
      }
    }
  }

  const apiKey = pickAlchemyApiKeyForChain(env, chain);
  if (!apiKey) {
    return corsResponse(JSON.stringify({ error: "Missing Alchemy API key for this chain." }), 503);
  }

  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getNFTMetadata?contractAddress=${encodeURIComponent(contract)}&tokenId=${encodeURIComponent(tokenId)}&refreshCache=false`;

  try {
    const res = await fetch(metaUrl);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message || "Metadata error");
    return corsResponse(JSON.stringify(json));
  } catch (e) {
    return corsResponse(JSON.stringify({ error: e?.message || "Metadata fetch failed" }), 502);
  }
}

function pickOpenSeaCollectionLogoFromContractMetadata(data) {
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

function pickLogoFromMoralisContractMeta(json) {
  if (!json || typeof json !== "object") return null;

  const tryPick = (obj) => {
    if (!obj || typeof obj !== "object") return null;
    const fromNormRoot = obj.normalized_metadata || obj.normalizedMetadata;
    const norm = fromNormRoot && typeof fromNormRoot === "object" ? fromNormRoot : null;
    const fromNorm =
      norm &&
      (moralisCoerceUrlString(norm.collection_logo) ||
        moralisCoerceUrlString(norm.collection_image) ||
        moralisCoerceUrlString(norm.image) ||
        moralisCoerceUrlString(norm.image_url));
    return (
      fromNorm ||
      moralisCoerceUrlString(obj.logo) ||
      moralisCoerceUrlString(obj.logo_url) ||
      moralisCoerceUrlString(obj.contract_logo) ||
      moralisCoerceUrlString(obj.collection_logo) ||
      moralisCoerceUrlString(obj.collection_banner_image) ||
      moralisCoerceUrlString(obj.collection_banner_image_url) ||
      moralisCoerceUrlString(obj.collection_image) ||
      moralisCoerceUrlString(obj.image_url) ||
      moralisCoerceUrlString(obj.image) ||
      moralisCoerceUrlString(obj.openSeaMetadata?.imageUrl) ||
      moralisCoerceUrlString(obj.openSea?.imageUrl) ||
      pickOpenSeaCollectionLogoFromContractMetadata(obj)
    );
  };

  let root = json;
  if (Array.isArray(json.result) && json.result.length === 1 && json.result[0] && typeof json.result[0] === "object") {
    root = { ...json, ...json.result[0] };
  } else if (json.result && typeof json.result === "object" && !Array.isArray(json.result)) {
    root = { ...json, ...json.result };
  }
  if (json.data && typeof json.data === "object" && !Array.isArray(json.data)) {
    root = { ...root, ...json.data };
  }

  const direct = tryPick(root);
  if (direct) return direct;

  const metaStr = root.metadata;
  if (typeof metaStr === "string" && metaStr.trim()) {
    const parsed = safeJsonParseMoralis(metaStr);
    const fromStr = tryPick(parsed);
    if (fromStr) return fromStr;
  }
  if (root.metadata && typeof root.metadata === "object") {
    const fromObj = tryPick(root.metadata);
    if (fromObj) return fromObj;
  }

  return pickOpenSeaCollectionLogoFromContractMetadata(json) || pickOpenSeaCollectionLogoFromContractMetadata(root);
}

async function handleApiContractMetadata(request, env) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const chain = String(url.searchParams.get("chain") || "eth").trim().toLowerCase();

  if (!contract || !/^0x[a-fA-F0-9]{40}$/.test(String(contract).trim())) {
    return corsResponse(JSON.stringify({ error: "Missing or invalid contract" }), 400);
  }

  const addr = String(contract).trim();

  if (chain === "apechain") {
    const hasMoralis = !!getMoralisApiKey(env);
    const hasAlchemy = !!pickAlchemyApiKeyForChain(env, "apechain");
    if (!hasMoralis && !hasAlchemy) {
      return corsResponse(JSON.stringify({ error: "Missing MORALIS_API_KEY and ALCHEMY_API_KEY for ApeChain.", rawLogoUrl: null }), 503);
    }
    if (hasMoralis) {
      try {
        const enc = encodeURIComponent(addr);
        const { data: json } = await moralisApeGetParsed(
          env,
          (chainParam) => {
            const metaUrl = new URL(`${MORALIS_API_BASE}/nft/${enc}/metadata`);
            metaUrl.searchParams.set("chain", chainParam);
            metaUrl.searchParams.set("normalizeMetadata", "true");
            console.log("[FlexGrid][ApeChain] Moralis contract metadata:", metaUrl.toString());
            return metaUrl.toString();
          },
          20000
        );
        const rawLogoUrl = pickLogoFromMoralisContractMeta(json);
        console.log("[FlexGrid][ApeChain] contract logo resolved:", !!rawLogoUrl, "contract:", addr);
        return corsResponse(JSON.stringify({ rawLogoUrl: rawLogoUrl || null }));
      } catch (e) {
        const msg =
          e?.name === "AbortError"
            ? "Moralis contract metadata timed out"
            : e?.message || "Moralis contract metadata failed";
        console.warn("[FlexGrid][ApeChain] Moralis contract metadata failed:", msg);
        if (!hasAlchemy) {
          return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
        }
      }
    }
  }

  const apiKey = pickAlchemyApiKeyForChain(env, chain);
  if (!apiKey) {
    return corsResponse(JSON.stringify({ error: "Missing Alchemy API key for this chain.", rawLogoUrl: null }), 503);
  }

  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const metaUrl = `https://${host}/nft/v3/${apiKey}/getContractMetadata?contractAddress=${encodeURIComponent(addr)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(metaUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || json?.error?.message || `Alchemy ${res.status}`;
      return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
    }
    if (json?.error?.message) {
      return corsResponse(JSON.stringify({ error: json.error.message, rawLogoUrl: null }), 502);
    }
    const rawLogoUrl = pickOpenSeaCollectionLogoFromContractMetadata(json);
    return corsResponse(JSON.stringify({ rawLogoUrl }));
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? "Contract metadata request timed out"
        : e?.message || "Contract metadata fetch failed";
    return corsResponse(JSON.stringify({ error: msg, rawLogoUrl: null }), 502);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hasMainKey = env.ALCHEMY_API_KEY && typeof env.ALCHEMY_API_KEY === "string";
    const hasMoralisKey = getMoralisApiKey(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const isConfigPath =
      url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";

    if (isConfigPath && request.method === "GET") {
      if (!hasMainKey && !hasMoralisKey) {
        return corsResponse(
          JSON.stringify({
            error:
              "This Worker has no API keys. Set ALCHEMY_API_KEY (ETH/Base/Polygon) and/or MORALIS_API_KEY (ApeChain). For local dev: wrangler secret put …",
          }),
          503
        );
      }
      const origin = `${url.protocol}//${url.host}`;
      return corsResponse(
        JSON.stringify({
          workerUrl: `${origin}/img?url=`,
          network: "eth-mainnet",
        })
      );
    }

    if (url.pathname === "/img" && request.method === "GET") {
      return handleImageProxy(request, env, ctx);
    }

    if (!hasMainKey && !hasMoralisKey) {
      return corsResponse(JSON.stringify({ error: "Server configuration error. Contact site owner." }), 503);
    }

    if (url.pathname === "/api/nfts" && request.method === "GET") {
      return handleApiNfts(request, env);
    }

    if (url.pathname === "/api/nft-metadata" && request.method === "GET") {
      return handleApiNftMetadata(request, env);
    }

    if (url.pathname === "/api/contract-metadata" && request.method === "GET") {
      return handleApiContractMetadata(request, env);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
