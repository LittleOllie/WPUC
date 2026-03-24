/**
 * Flex Grid Worker — Alchemy NFT APIs + production image proxy (/img)
 * Image proxy: multi-gateway IPFS, HTTP fetch, timeouts, edge cache, CORS for canvas export.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const WORKER_URL = "https://loflexgrid.littleollienft.workers.dev";

const ALCHEMY_HOSTS = {
  eth: "eth-mainnet.g.alchemy.com",
  base: "base-mainnet.g.alchemy.com",
  polygon: "polygon-mainnet.g.alchemy.com",
};

// ---------------------------------------------------------------------------
// Image proxy — config
// ---------------------------------------------------------------------------

const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
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

  for (const run of attempts) {
    try {
      const res = await run();
      if (isAcceptableImageResponse(res, { allowUnknownContentType: false })) {
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
  if (!/\/ipfs\//i.test(decodedUrl) && !decodedUrl.startsWith("ipfs://")) return null;
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

  const decodedUrl = fullyDecodeUrlParam(rawParam);
  if (!decodedUrl) {
    return imageProxyError(400, "Invalid url");
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

async function handleApiNfts(request, apiKey) {
  const url = new URL(request.url);
  const owner = url.searchParams.get("owner");
  const chain = url.searchParams.get("chain") || "eth";
  const contractAddressesParam = url.searchParams.get("contractAddresses");

  if (!owner || String(owner).trim() === "") {
    return corsResponse(JSON.stringify({ error: "Missing owner" }), 400);
  }

  const ownerVal = owner.trim().toLowerCase();
  const host = ALCHEMY_HOSTS[chain] || ALCHEMY_HOSTS.eth;
  const baseUrl = `https://${host}/v2/${apiKey}/getNFTsForOwner`;
  const allNFTs = [];
  let pageKey = null;

  const contractAddresses = contractAddressesParam
    ? contractAddressesParam.split(",").map((a) => a.trim().toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a))
    : null;

  try {
    do {
      const params = new URLSearchParams({
        owner: ownerVal,
        withMetadata: "true",
        pageSize: "100",
      });
      if (pageKey) params.set("pageKey", pageKey);
      if (contractAddresses?.length) {
        contractAddresses.forEach((addr) => params.append("contractAddresses[]", addr));
      }

      const fetchUrl = `${baseUrl}?${params.toString()}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const res = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const text = await res.text();
        const errMsg = text || `Alchemy ${res.status}`;
        return corsResponse(JSON.stringify({ error: errMsg }), 502);
      }

      const data = await res.json().catch(() => ({}));
      if (data?.error?.message) {
        return corsResponse(JSON.stringify({ error: data.error.message }), 502);
      }
      const nfts = data.ownedNfts || [];
      for (const n of nfts) allNFTs.push(n);

      pageKey = data.pageKey || null;
    } while (pageKey);

    console.log(`total NFTs fetched: ${allNFTs.length}`);

    function collectionOpenSeaImageUrl(nft) {
      const os = nft?.contractMetadata?.openSea || nft?.contractMetadata?.openSeaMetadata || {};
      const u = os.imageUrl || os.image_url;
      return typeof u === "string" && u.trim() ? u.trim() : null;
    }

    function resolveTokenImageUrl(nft, collectionLogo) {
      const candidates = [
        nft?.metadata?.image,
        nft?.metadata?.image_url,
        nft?.media?.[0]?.thumbnail,
        nft?.media?.[0]?.gateway,
        nft?.media?.[0]?.raw,
      ];
      for (const c of candidates) {
        if (c == null) continue;
        const s = String(c).trim();
        if (!s) continue;
        if (collectionLogo && s === collectionLogo) continue;
        return s;
      }
      const img = nft?.image;
      if (img != null) {
        const u =
          typeof img === "string"
            ? img
            : img?.cachedUrl || img?.pngUrl || img?.thumbnailUrl || img?.originalUrl || "";
        const s = String(u).trim();
        if (s && (!collectionLogo || s !== collectionLogo)) return s;
      }
      return null;
    }

    const cleaned = allNFTs.map((nft) => {
      const collectionLogo = collectionOpenSeaImageUrl(nft);
      const image = resolveTokenImageUrl(nft, collectionLogo);

      const meta = { ...(nft?.metadata || {}) };
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
    });

    return corsResponse(JSON.stringify({ nfts: cleaned }));
  } catch (e) {
    const msg =
      e?.name === "AbortError"
        ? "Request timed out. Try again with fewer wallets."
        : e?.message || "NFT fetch failed";
    return corsResponse(JSON.stringify({ error: msg }), 502);
  }
}

async function handleApiNftMetadata(request, apiKey) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const tokenId = url.searchParams.get("tokenId");
  const chain = url.searchParams.get("chain") || "eth";

  if (!contract || !tokenId) {
    return corsResponse(JSON.stringify({ error: "Missing contract or tokenId" }), 400);
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
    return typeof u === "string" && u.trim() ? u.trim() : null;
  };
  return (
    pick(data.openSeaMetadata) ||
    pick(data.openSea) ||
    pick(data.contractMetadata?.openSeaMetadata) ||
    pick(data.contractMetadata?.openSea) ||
    (typeof data.logoUrl === "string" && data.logoUrl.trim() ? data.logoUrl.trim() : null) ||
    null
  );
}

async function handleApiContractMetadata(request, apiKey) {
  const url = new URL(request.url);
  const contract = url.searchParams.get("contract");
  const chain = url.searchParams.get("chain") || "eth";

  if (!contract || !/^0x[a-fA-F0-9]{40}$/.test(String(contract).trim())) {
    return corsResponse(JSON.stringify({ error: "Missing or invalid contract" }), 400);
  }

  const addr = String(contract).trim();
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
    const apiKey = env.ALCHEMY_API_KEY;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const isConfigPath =
      url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";

    if (isConfigPath && request.method === "GET") {
      return corsResponse(
        JSON.stringify({
          workerUrl: `${WORKER_URL}/img?url=`,
          network: "eth-mainnet",
        })
      );
    }

    if (url.pathname === "/img" && request.method === "GET") {
      return handleImageProxy(request, env, ctx);
    }

    if (!apiKey || typeof apiKey !== "string") {
      return corsResponse(JSON.stringify({ error: "Server configuration error. Contact site owner." }), 503);
    }

    if (url.pathname === "/api/nfts" && request.method === "GET") {
      return handleApiNfts(request, apiKey);
    }

    if (url.pathname === "/api/nft-metadata" && request.method === "GET") {
      return handleApiNftMetadata(request, apiKey);
    }

    if (url.pathname === "/api/contract-metadata" && request.method === "GET") {
      return handleApiContractMetadata(request, apiKey);
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
