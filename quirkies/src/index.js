/** Standalone Quirks checker — Quirkies × Quirklings (+ INX). Alchemy NFT API v3. */

function nftBaseUrl(apiKey) {
  return `https://eth-mainnet.g.alchemy.com/nft/v3/${apiKey}`;
}

function firstOwnerFromResponse(data) {
  const list = data?.owners;
  if (!Array.isArray(list) || list.length === 0) return null;
  const item = list[0];
  if (typeof item === "string") return item;
  if (item && typeof item.ownerAddress === "string") {
    return item.ownerAddress;
  }
  return null;
}

async function readAlchemyJson(res) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Alchemy HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Alchemy returned non-JSON: ${text.slice(0, 120)}`);
  }
}

function pickTokenIdRaw(nft) {
  if (!nft || typeof nft !== "object") return null;
  const candidates = [
    nft.tokenId,
    nft?.id?.tokenId,
    nft?.token?.tokenId,
    nft?.contract?.tokenId,
  ];
  for (const c of candidates) {
    if (c !== undefined && c !== null) return c;
  }
  return null;
}

function canonicalTokenIdFromNft(nft) {
  const raw = pickTokenIdRaw(nft);
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  try {
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s).toString(10);
    if (/^\d+$/.test(s)) return BigInt(s).toString(10);
    return BigInt(s).toString(10);
  } catch {
    return null;
  }
}

function tokenIdStrToJson(decimalStr) {
  try {
    const bi = BigInt(String(decimalStr));
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    if (bi <= max) return Number(bi);
    return bi.toString(10);
  } catch {
    return String(decimalStr);
  }
}

function normalizeImageUrl(u) {
  if (!u || typeof u !== "string") return null;
  const s = u.trim();
  if (!s) return null;
  if (s.startsWith("ipfs://")) {
    const path = s
      .slice(7)
      .replace(/^ipfs\//, "")
      .replace(/^\/+/, "");
    return `https://nftstorage.link/ipfs/${path}`;
  }
  if (s.startsWith("ar://")) {
    return `https://arweave.net/${s.slice(5)}`;
  }
  return s;
}

function isIpfsLikeImageUrl(u) {
  if (!u || typeof u !== "string") return false;
  const s = u.trim().toLowerCase();
  if (s.startsWith("ipfs://")) return true;
  if (s.includes("/ipfs/")) return true;
  return false;
}

/** QuirkKid CDN has no CORS for canvas; fetch via Worker like IPFS. */
function isQuirkiesQuirkKidCdnUrl(u) {
  if (!u || typeof u !== "string") return false;
  try {
    const h = new URL(u.trim()).hostname.toLowerCase();
    return h === "quirkids-images.s3.ap-southeast-2.amazonaws.com";
  } catch {
    return false;
  }
}

function shouldProxyImageUrlForClient(u) {
  return isIpfsLikeImageUrl(u) || isQuirkiesQuirkKidCdnUrl(u);
}

/** Route IPFS + QuirkKid S3 through Worker proxy (CORS-safe canvas); other HTTPS unchanged. */
function proxiedImageUrlForClient(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const n = normalizeImageUrl(rawUrl.trim());
  if (!n) return null;
  if (!shouldProxyImageUrlForClient(n)) return n;
  return `/api/img?url=${encodeURIComponent(n)}`;
}

function extractImageFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [];

  const m = data.media;
  if (Array.isArray(m) && m.length > 0) {
    const first = m[0];
    candidates.push(
      first?.thumbnail,
      first?.cachedUrl,
      first?.gateway,
      first?.raw
    );
  }

  const img = data.image;
  if (typeof img === "string") candidates.push(img);
  else if (img && typeof img === "object") {
    candidates.push(
      img.cachedUrl,
      img.pngUrl,
      img.thumbnailUrl,
      img.originalUrl,
      img.webpUrl
    );
  }

  const rawMeta = data.raw?.metadata;
  if (rawMeta && typeof rawMeta === "object") {
    candidates.push(rawMeta.image, rawMeta.image_url, rawMeta.imageUrl);
  }

  candidates.push(
    data.openSeaMetadata?.imageUrl,
    data.contract?.openSeaMetadata?.imageUrl,
    data.displayImageUrl,
    data.imageUrl
  );

  if (data.metadata && typeof data.metadata === "object") {
    candidates.push(
      data.metadata.image,
      data.metadata.image_url,
      data.metadata.imageUrl
    );
  }

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) {
      const n = normalizeImageUrl(c.trim());
      if (n) return n;
    }
  }
  return null;
}

/**
 * QuirkKid hero PNGs use a fixed S3 layout (see `quirkies-embed` HTML); they are not in token metadata JSON.
 * Same decimal tokenId as the Quirkie.
 */
const QUIRKIES_QUIRK_KID_IMAGE_BASE =
  "https://quirkids-images.s3.ap-southeast-2.amazonaws.com/";

function quirkiesQuirkKidImageUrlForTokenId(tokenIdStr) {
  if (tokenIdStr == null) return null;
  const s = String(tokenIdStr).trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    if (BigInt(s) < 0n) return null;
  } catch {
    return null;
  }
  return `${QUIRKIES_QUIRK_KID_IMAGE_BASE}${s}.png`;
}

function applyQuirkiesQuirkKidS3FallbackToCollection(col) {
  if (!col?.idKeys || !col.idToKidImage) return;
  for (const id of col.idKeys) {
    if (col.idToKidImage.get(id)) continue;
    const u = quirkiesQuirkKidImageUrlForTokenId(id);
    if (u) col.idToKidImage.set(id, u);
  }
}

/** QuirkKid / companion art (OpenSea “QuirkKid” view) — not the primary `image`. */
function extractQuirkKidImageFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [];

  const push = (v) => {
    if (typeof v === "string" && v.trim()) candidates.push(v.trim());
  };

  let rawObj = data.raw?.metadata;
  if (typeof rawObj === "string") {
    try {
      rawObj = JSON.parse(rawObj);
    } catch {
      rawObj = null;
    }
  }
  if (rawObj && typeof rawObj === "object") {
    push(rawObj.quirkKid);
    push(rawObj.quirk_kid);
    push(rawObj.quirkKidImage);
    push(rawObj.quirk_kid_image);
    push(rawObj.QuirkKid);
    push(rawObj.kidImage);
    push(rawObj.kid_image);
    push(rawObj.companion_image);
    push(rawObj.quirkKidUrl);
    if (rawObj.properties && typeof rawObj.properties === "object") {
      push(rawObj.properties.quirkKid);
      push(rawObj.properties.quirk_kid_image);
      push(rawObj.properties.kidImage);
    }
    if (Array.isArray(rawObj.files)) {
      for (const f of rawObj.files) {
        if (f && typeof f === "object") {
          push(f.uri);
          push(f.src);
          push(f.url);
        } else push(f);
      }
    }
  }

  const meta = data.metadata;
  if (meta && typeof meta === "object") {
    push(meta.quirkKidImage);
    push(meta.quirk_kid_image);
    push(meta.kidImage);
  }

  const m = data.media;
  if (Array.isArray(m) && m.length > 1) {
    for (let mi = 1; mi < m.length; mi++) {
      const sec = m[mi];
      if (sec && typeof sec === "object") {
        push(sec.cachedUrl);
        push(sec.gateway);
        push(sec.thumbnail);
        push(sec.raw);
      }
    }
  }

  const primaryNorm = extractImageFromMetadata(data);
  for (const c of candidates) {
    const n = normalizeImageUrl(c);
    if (!n) continue;
    if (primaryNorm && n === primaryNorm) continue;
    return n;
  }
  return null;
}

function extractTraitsFromNft(nft) {
  if (!nft || typeof nft !== "object") return [];
  const out = [];
  const seen = new Set();
  const pushPair = (tt, v) => {
    if (tt == null || !String(tt).trim()) return;
    const key = String(tt).trim() + "\0" + String(v ?? "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ trait_type: String(tt).trim(), value: v != null ? v : "" });
  };

  const ingestAttributes = (attrs) => {
    if (!Array.isArray(attrs)) return;
    for (const a of attrs) {
      if (a && typeof a === "object") {
        const tt = a.trait_type ?? a.traitType ?? a.name;
        pushPair(tt, a.value ?? a.string_value);
      }
    }
  };

  const ingestProperties = (props) => {
    if (!props || typeof props !== "object" || Array.isArray(props)) return;
    for (const k of Object.keys(props)) {
      const v = props[k];
      if (v != null && typeof v !== "object") pushPair(k, v);
    }
  };

  const ingestMetaBlob = (blob) => {
    if (blob == null) return;
    if (typeof blob === "string") {
      try {
        ingestMetaBlob(JSON.parse(blob));
      } catch {
        /* not JSON */
      }
      return;
    }
    if (typeof blob === "object") {
      ingestAttributes(blob.attributes);
      ingestAttributes(blob.traits);
      ingestProperties(blob.properties);
    }
  };

  ingestMetaBlob(nft.raw?.metadata);
  ingestMetaBlob(nft.metadata);
  ingestMetaBlob(nft.rawMetadata);
  if (Array.isArray(nft.attributes)) ingestAttributes(nft.attributes);

  return out;
}

async function safeGetNftMetadataImage(nftBase, contract, tokenIdStr) {
  try {
    const params = new URLSearchParams({
      contractAddress: normalizeAddr(contract),
      tokenId: tokenIdStr,
    });
    const res = await fetch(`${nftBase}/getNFTMetadata?${params.toString()}`);
    const data = await readAlchemyJson(res);
    return extractImageFromMetadata(data);
  } catch {
    return null;
  }
}

async function quirkiePrimaryAndKidFromMetadata(nftBase, contract, tokenIdStr) {
  const meta = await safeGetNftMetadataObject(nftBase, contract, tokenIdStr);
  if (!meta) return { image: null, kidImage: null };
  const image = extractImageFromMetadata(meta);
  let kidImage = extractQuirkKidImageFromMetadata(meta);
  if (!kidImage) kidImage = quirkiesQuirkKidImageUrlForTokenId(tokenIdStr);
  return { image, kidImage };
}

function normalizeAddr(a) {
  if (!a || typeof a !== "string") return a;
  return a.toLowerCase();
}

function openseaEthereumItemUrl(contract, decimalTokenId) {
  const c = normalizeAddr(contract);
  const tid = String(decimalTokenId);
  return `https://opensea.io/item/ethereum/${c}/${tid}`;
}

function isOpenSeaTokenUrl(u) {
  if (typeof u !== "string" || !u.includes("opensea.io")) return false;
  return /opensea\.io\/(assets|item)\/ethereum\/0x[a-fA-F0-9]{40}\//i.test(u);
}

function extractOpenSeaPermalinkFromMetadata(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.permalink,
    data.openSea?.permalink,
    data.openSea?.url,
    data.openSeaMetadata?.tokenUrl,
    data.openSeaMetadata?.permalink,
    data.contract?.openSeaMetadata?.externalUrl,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && isOpenSeaTokenUrl(c)) {
      return c.trim().split("?")[0];
    }
  }
  return null;
}

async function safeGetNftMetadataObject(nftBase, contract, tokenIdStr) {
  try {
    const params = new URLSearchParams({
      contractAddress: normalizeAddr(contract),
      tokenId: String(tokenIdStr),
    });
    const res = await fetch(`${nftBase}/getNFTMetadata?${params.toString()}`);
    const text = await res.text();
    if (!res.ok) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function resolveOpenSeaNftUrl(nftBase, contract, tokenIdStr) {
  const fallback = openseaEthereumItemUrl(contract, tokenIdStr);
  const data = await safeGetNftMetadataObject(nftBase, contract, tokenIdStr);
  if (!data) return fallback;
  const perm = extractOpenSeaPermalinkFromMetadata(data);
  return perm || fallback;
}

async function getOwnerForToken(nftBase, contract, tokenIdStr) {
  let dec;
  try {
    dec = String(tokenIdStr);
    BigInt(dec);
  } catch {
    return null;
  }
  const hex = "0x" + BigInt(dec).toString(16);

  for (const tid of [dec, hex]) {
    try {
      const params = new URLSearchParams({
        contractAddress: normalizeAddr(contract),
        tokenId: tid,
      });
      const res = await fetch(
        `${nftBase}/getOwnersForNFT?${params.toString()}`
      );
      const data = await readAlchemyJson(res);
      const owner = firstOwnerFromResponse(data);
      if (owner) return owner;
    } catch {
      /* ignore */
    }
  }
  return null;
}

const COUNTERPART_OWNER_CONCURRENCY = 10;
/** Per-token getNFTMetadata calls for tokens missing art after getNFTsForOwner (common for some collections). */
const HYDRATE_IMAGE_CONCURRENCY = 22;

async function mapWithConcurrency(items, limit, asyncFn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await asyncFn(items[idx], idx);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function fetchOwnedCollection(nftBase, owner, contract) {
  const idToImage = new Map();
  const idToKidImage = new Map();
  const idToTraits = new Map();
  const idSet = new Set();
  let pageKey = null;
  const ownerNorm = normalizeAddr(owner);
  const contractNorm = normalizeAddr(contract);

  do {
    const params = new URLSearchParams({
      owner: ownerNorm,
      pageSize: "100",
      withMetadata: "true",
      tokenUriTimeoutInMs: "15000",
    });
    params.append("contractAddresses[]", contractNorm);
    if (pageKey) params.set("pageKey", pageKey);

    const endpoint = `${nftBase}/getNFTsForOwner?${params.toString()}`;
    const res = await fetch(endpoint);
    const data = await readAlchemyJson(res);

    for (const nft of data.ownedNfts || []) {
      const key = canonicalTokenIdFromNft(nft);
      if (!key) continue;
      idSet.add(key);
      const img = extractImageFromMetadata(nft);
      if (img) idToImage.set(key, img);
      const kid = extractQuirkKidImageFromMetadata(nft);
      if (kid) idToKidImage.set(key, kid);
      const traits = extractTraitsFromNft(nft);
      idToTraits.set(key, traits);
    }

    pageKey = data.pageKey || null;
  } while (pageKey);

  const idKeys = [...idSet].sort((x, y) => {
    const cmp = BigInt(x) - BigInt(y);
    if (cmp < 0n) return -1;
    if (cmp > 0n) return 1;
    return 0;
  });

  return { idKeys, idToImage, idToTraits, idToKidImage };
}

/**
 * Fill idToImage for tokens where list metadata had no URL (reduces “slow blank then loads” in UI).
 */
async function hydrateMissingCollectionImages(nftBase, contract, col) {
  if (!col?.idKeys?.length) return;
  const missing = col.idKeys.filter((id) => !col.idToImage.get(id));
  if (missing.length === 0) return;
  await mapWithConcurrency(
    missing,
    HYDRATE_IMAGE_CONCURRENCY,
    async (id) => {
      const img = await safeGetNftMetadataImage(nftBase, contract, id);
      if (img) col.idToImage.set(id, img);
    }
  );
}

/** Fill QuirkKid art from full metadata when list view omitted it. */
async function hydrateQuirkKidImagesFromMetadata(nftBase, contract, col) {
  if (!col?.idKeys?.length || !col.idToKidImage) return;
  const need = col.idKeys.filter(
    (id) => !col.idToKidImage.get(id) && col.idToImage.get(id)
  );
  if (need.length === 0) return;
  await mapWithConcurrency(
    need,
    14,
    async (id) => {
      const meta = await safeGetNftMetadataObject(nftBase, contract, id);
      if (!meta) return;
      const kid = extractQuirkKidImageFromMetadata(meta);
      if (kid) col.idToKidImage.set(id, kid);
    }
  );
}

// --- Image proxy (IPFS multi-gateway + HTTPS art) — same idea as FlexGrid worker /img ---

/** Order: try Cloudflare first, then common public gateways + Pinata, then ipfs.io. */
const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
];

const IMG_PROXY_TIMEOUT_MS = 5500;
const IMG_PROXY_MAX_BYTES = 25 * 1024 * 1024;
const IMG_PROXY_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const CF_CACHE_FETCH = { cacheEverything: true, cacheTtl: 86400 };

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

function normalizeIPFSPathFromUrl(url) {
  if (!url) return null;
  let s = url;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* keep */
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

function sanitizeIpfsPathForGateway(ipfsPath) {
  if (!ipfsPath) return "";
  return String(ipfsPath).replace(/^\/+/, "").trim();
}

function imgProxyHeadersForUrl(resourceUrl) {
  const u = String(resourceUrl || "");
  if (/seadn\.io|looksrare|cdn\.blur\.io|openseauserdata\.com/i.test(u)) {
    return {
      "User-Agent": IMG_PROXY_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://opensea.io/",
    };
  }
  return { "User-Agent": "Quirks-ImageProxy/1.0" };
}

function isOkImageResponse(res) {
  if (!res || !res.ok) return false;
  const lenH = res.headers.get("Content-Length");
  if (lenH) {
    const n = parseInt(lenH, 10);
    if (Number.isFinite(n) && n > IMG_PROXY_MAX_BYTES) return false;
  }
  const ct = (res.headers.get("Content-Type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ct) return true;
  if (ct.startsWith("image/")) return true;
  if (ct === "application/octet-stream") return true;
  if (ct.includes("text/html") || ct.includes("application/json")) return false;
  return true;
}

async function fetchWithImgTimeout(resource, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resource, {
      redirect: "follow",
      headers: imgProxyHeadersForUrl(resource),
      signal: controller.signal,
      cf: CF_CACHE_FETCH,
    });
    clearTimeout(id);
    return res;
  } catch {
    clearTimeout(id);
    throw new Error("fetch failed");
  }
}

async function tryIpfsGateways(ipfsPath) {
  const path = sanitizeIpfsPathForGateway(ipfsPath);
  if (!path) return null;
  for (const gateway of IPFS_GATEWAYS) {
    const url = gateway + path;
    try {
      const res = await fetchWithImgTimeout(url, IMG_PROXY_TIMEOUT_MS);
      if (isOkImageResponse(res)) return res;
    } catch {
      /* next */
    }
  }
  return null;
}

async function tryDirectThenGateways(decodedUrl, ipfsPath) {
  if (/\/ipfs\//i.test(decodedUrl) || decodedUrl.startsWith("ipfs://")) {
    try {
      const norm = normalizeImageUrl(decodedUrl);
      if (norm && /^https?:\/\//i.test(norm)) {
        const res = await fetchWithImgTimeout(norm, IMG_PROXY_TIMEOUT_MS);
        if (isOkImageResponse(res)) return res;
      }
    } catch {
      /* fall through */
    }
  }
  if (ipfsPath) return tryIpfsGateways(ipfsPath);
  return null;
}

async function fetchHttpsImage(decodedUrl) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 350));
    }
    try {
      const res = await fetchWithImgTimeout(decodedUrl, IMG_PROXY_TIMEOUT_MS);
      if (isOkImageResponse(res)) return res;
    } catch {
      /* retry */
    }
  }
  return null;
}

async function handleImageProxy(request, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(request.url, { method: "GET" });
  try {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  } catch {
    /* no cache */
  }

  const urlObj = new URL(request.url);
  const rawParam = urlObj.searchParams.get("url");
  if (!rawParam || !String(rawParam).trim()) {
    return new Response("Missing url", {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const decodedUrl = fullyDecodeUrlParam(rawParam);
  if (!decodedUrl || !/^https?:\/\//i.test(decodedUrl)) {
    return new Response("Invalid url", {
      status: 400,
      headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ipfsPath = normalizeIPFSPathFromUrl(decodedUrl);
  let originRes = null;
  if (ipfsPath) {
    originRes = await tryDirectThenGateways(decodedUrl, ipfsPath);
  } else {
    originRes = await fetchHttpsImage(decodedUrl);
  }

  if (!originRes || !originRes.ok) {
    return new Response("Image not found", {
      status: 404,
      headers: { ...corsHeaders(), "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const ct =
    originRes.headers.get("Content-Type")?.split(";")[0].trim() ||
    "image/png";
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("Content-Type", ct);
  const len = originRes.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);

  const out = new Response(originRes.body, { status: 200, headers });

  try {
    if (ctx?.waitUntil) ctx.waitUntil(cache.put(cacheKey, out.clone()));
  } catch {
    /* ignore */
  }
  return out;
}

function normalizePath(pathname) {
  return pathname.replace(/\/$/, "") || "/";
}

function parseTokenIdParam(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return { ok: false, error: "Missing id query parameter" };
  }
  const s = String(raw).trim();
  let bi;
  try {
    if (s.startsWith("0x") || s.startsWith("0X")) bi = BigInt(s);
    else if (/^\d+$/.test(s)) bi = BigInt(s);
    else {
      return {
        ok: false,
        error: "Invalid id: use a decimal number or 0x-prefixed hex",
      };
    }
  } catch {
    return { ok: false, error: "Invalid id" };
  }
  if (bi < 0n) {
    return { ok: false, error: "Invalid id: must be non-negative" };
  }
  const str = bi.toString(10);
  const tokenIdJson =
    bi <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(bi) : str;
  return { ok: true, tokenIdJson, tokenIdStr: str };
}

function addressesMatch(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function isValidEthAddress(addr) {
  return typeof addr === "string" && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function emptyOwnedCollection() {
  return {
    idKeys: [],
    idToImage: new Map(),
    idToTraits: new Map(),
    idToKidImage: new Map(),
  };
}

const PAIR_MAX_TOKEN_ID = 5000n;

function requireQuirksAlchemyEnv(env) {
  const key = env.ALCHEMY_API_KEY;
  if (!key) {
    return {
      ok: false,
      response: json(
        {
          error: "Server misconfiguration: ALCHEMY_API_KEY is not set",
          hint:
            "Local dev: create `quirks-app/.dev.vars` or `quirks-app/.env` with ALCHEMY_API_KEY=your_key (same folder as wrangler.toml). Wrangler does not load `.dev.vars.example`. Deployed: run `wrangler secret put ALCHEMY_API_KEY`.",
        },
        500
      ),
    };
  }
  const quirkies = env.QUIRKIES_CONTRACT;
  const quirklings = env.QUIRKLINGS_CONTRACT;
  if (!quirkies || !quirklings) {
    return {
      ok: false,
      response: json(
        { error: "Server misconfiguration: Quirks contract addresses missing" },
        500
      ),
    };
  }
  const inxRaw = env.INX_CONTRACT;
  const inx =
    inxRaw && String(inxRaw).trim() && String(inxRaw).trim().startsWith("0x")
      ? String(inxRaw).trim()
      : null;
  const qkidsRaw = env.QUIRKKIDS_CONTRACT;
  const QUIRKKIDS =
    qkidsRaw &&
    String(qkidsRaw).trim() &&
    String(qkidsRaw).trim().startsWith("0x")
      ? String(qkidsRaw).trim()
      : null;
  return {
    ok: true,
    nftBase: nftBaseUrl(key),
    QUIRKIES: quirkies,
    QUIRKLINGS: quirklings,
    INX: inx,
    QUIRKKIDS,
  };
}

function rowFromCol(col, id) {
  const rawImg = col.idToImage.get(id) ?? null;
  const rawKid = col.idToKidImage?.get(id) ?? null;
  return {
    tokenId: tokenIdStrToJson(id),
    image: rawImg ? proxiedImageUrlForClient(rawImg) : null,
    kidImage: rawKid ? proxiedImageUrlForClient(rawKid) : null,
    traits: col.idToTraits.get(id) ?? [],
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const path = normalizePath(url.pathname);

    if (path === "/api/img") {
      return handleImageProxy(request, ctx);
    }

    if (path === "/api/nft-metadata") {
      try {
        const contractRaw = url.searchParams.get("contract");
        const tokenIdRaw =
          url.searchParams.get("tokenId") || url.searchParams.get("id");
        if (!contractRaw || !String(contractRaw).trim()) {
          return json({ error: "Missing contract" }, 400);
        }
        if (tokenIdRaw === null || String(tokenIdRaw).trim() === "") {
          return json({ error: "Missing tokenId" }, 400);
        }
        const envCheck = requireQuirksAlchemyEnv(env);
        if (!envCheck.ok) return envCheck.response;
        const { nftBase } = envCheck;
        const contract = String(contractRaw).trim();
        const tokenIdStr = String(tokenIdRaw).trim();
        const meta = await safeGetNftMetadataObject(
          nftBase,
          contract,
          tokenIdStr
        );
        if (!meta) {
          return json({ error: "Metadata not found" }, 404);
        }
        const rawImage = extractImageFromMetadata(meta);
        return json({
          image: rawImage ? proxiedImageUrlForClient(rawImage) : null,
          rawImage,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: "Server error", detail: msg }, 500);
      }
    }

    if (path === "/api/token") {
      try {
        const parsed = parseTokenIdParam(url.searchParams.get("id"));
        if (!parsed.ok) {
          return json({ error: parsed.error }, 400);
        }

        const envCheck = requireQuirksAlchemyEnv(env);
        if (!envCheck.ok) return envCheck.response;

        const { nftBase, QUIRKIES, QUIRKLINGS, INX, QUIRKKIDS } = envCheck;
        const tid = parsed.tokenIdStr;
        const tidBi = BigInt(tid);
        const inPairRange = tidBi <= PAIR_MAX_TOKEN_ID;

        const jobs = [
          getOwnerForToken(nftBase, QUIRKIES, tid),
          quirkiePrimaryAndKidFromMetadata(nftBase, QUIRKIES, tid),
          inPairRange
            ? getOwnerForToken(nftBase, QUIRKLINGS, tid)
            : Promise.resolve(null),
          inPairRange
            ? safeGetNftMetadataImage(nftBase, QUIRKLINGS, tid)
            : Promise.resolve(null),
        ];
        if (INX) {
          jobs.push(getOwnerForToken(nftBase, INX, tid));
          jobs.push(safeGetNftMetadataImage(nftBase, INX, tid));
        }

        const qKidContractPromise =
          QUIRKKIDS &&
          normalizeAddr(QUIRKKIDS) !== normalizeAddr(QUIRKIES)
            ? safeGetNftMetadataImage(nftBase, QUIRKKIDS, tid)
            : Promise.resolve(null);

        const results = await Promise.all(jobs);
        const qOwner = results[0];
        const qMedia = results[1];
        const qImg = qMedia?.image ?? null;
        let qKid = qMedia?.kidImage ?? null;
        const qlOwner = results[2];
        const qlImg = results[3];
        const qKidFromContract = await qKidContractPromise;
        if (qKidFromContract) qKid = qKidFromContract;

        const quirkie = {
          owner: qOwner,
          image: qImg ? proxiedImageUrlForClient(qImg) : null,
          kidImage: qKid ? proxiedImageUrlForClient(qKid) : null,
          opensea: qOwner ? `https://opensea.io/${qOwner}` : null,
          openseaNft: openseaEthereumItemUrl(QUIRKIES, tid),
        };

        let quirking = null;
        if (inPairRange) {
          quirking = {
            owner: qlOwner,
            image: qlImg ? proxiedImageUrlForClient(qlImg) : null,
            opensea: qlOwner ? `https://opensea.io/${qlOwner}` : null,
            openseaNft: openseaEthereumItemUrl(QUIRKLINGS, tid),
          };
        }

        let inx = null;
        if (INX) {
          const iOff = 4;
          const iOwner = results[iOff];
          const iImg = results[iOff + 1];
          inx = {
            owner: iOwner,
            image: iImg ? proxiedImageUrlForClient(iImg) : null,
            opensea: iOwner ? `https://opensea.io/${iOwner}` : null,
            openseaNft: openseaEthereumItemUrl(INX, tid),
          };
        }

        const pairMatch =
          inPairRange &&
          quirking &&
          addressesMatch(quirkie.owner, quirking.owner);

        return json({
          tokenId: parsed.tokenIdJson,
          pairMaxTokenId:
            PAIR_MAX_TOKEN_ID <= BigInt(Number.MAX_SAFE_INTEGER)
              ? Number(PAIR_MAX_TOKEN_ID)
              : PAIR_MAX_TOKEN_ID.toString(10),
          inPairRange,
          contracts: {
            quirkies: QUIRKIES,
            quirklings: QUIRKLINGS,
            inx: INX || null,
          },
          quirkie,
          quirking,
          inx,
          pairOwnersMatch: pairMatch,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: "Server error", detail: msg }, 500);
      }
    }

    if (path === "/api/wallet") {
      try {
        const addressRaw = url.searchParams.get("address");

        if (!addressRaw || !String(addressRaw).trim()) {
          return json({ error: "Missing wallet address" }, 400);
        }

        const address = normalizeAddr(addressRaw.trim());
        if (!isValidEthAddress(address)) {
          return json({ error: "Invalid wallet address" }, 400);
        }

        const envCheck = requireQuirksAlchemyEnv(env);
        if (!envCheck.ok) return envCheck.response;

        const { nftBase, QUIRKIES, QUIRKLINGS, INX, QUIRKKIDS } = envCheck;

        const inxPromise = INX
          ? fetchOwnedCollection(nftBase, address, INX)
          : Promise.resolve(emptyOwnedCollection());

        const [quirkiesCol, quirklingsCol, inxCol] = await Promise.all([
          fetchOwnedCollection(nftBase, address, QUIRKIES),
          fetchOwnedCollection(nftBase, address, QUIRKLINGS),
          inxPromise,
        ]);

        await Promise.all([
          hydrateMissingCollectionImages(nftBase, QUIRKIES, quirkiesCol),
          hydrateMissingCollectionImages(nftBase, QUIRKLINGS, quirklingsCol),
          INX
            ? hydrateMissingCollectionImages(nftBase, INX, inxCol)
            : Promise.resolve(),
        ]);

        await hydrateQuirkKidImagesFromMetadata(nftBase, QUIRKIES, quirkiesCol);

        if (
          QUIRKKIDS &&
          normalizeAddr(QUIRKKIDS) !== normalizeAddr(QUIRKIES)
        ) {
          const kidsCol = await fetchOwnedCollection(
            nftBase,
            address,
            QUIRKKIDS
          );
          await hydrateMissingCollectionImages(nftBase, QUIRKKIDS, kidsCol);
          for (const id of quirkiesCol.idKeys) {
            const im = kidsCol.idToImage.get(id);
            if (im) quirkiesCol.idToKidImage.set(id, im);
          }
        }

        applyQuirkiesQuirkKidS3FallbackToCollection(quirkiesCol);

        const qSet = new Set(quirkiesCol.idKeys);
        const qlSet = new Set(quirklingsCol.idKeys);
        const inxSet = new Set(inxCol.idKeys);

        const quirkies = quirkiesCol.idKeys.map((id) =>
          rowFromCol(quirkiesCol, id)
        );
        const quirklings = quirklingsCol.idKeys.map((id) =>
          rowFromCol(quirklingsCol, id)
        );
        const inxList = inxCol.idKeys.map((id) => rowFromCol(inxCol, id));

        const matched = [];
        for (const id of quirkiesCol.idKeys) {
          let bi;
          try {
            bi = BigInt(id);
          } catch {
            continue;
          }
          if (bi > PAIR_MAX_TOKEN_ID) continue;
          if (!qlSet.has(id)) continue;
          const inxRow = inxSet.has(id) ? rowFromCol(inxCol, id) : null;
          matched.push({
            tokenId: tokenIdStrToJson(id),
            quirkie: rowFromCol(quirkiesCol, id),
            quirking: rowFromCol(quirklingsCol, id),
            inx: inxRow,
            openseaQuirkie: openseaEthereumItemUrl(QUIRKIES, id),
            openseaQuirkling: openseaEthereumItemUrl(QUIRKLINGS, id),
            openseaInx:
              INX && inxRow ? openseaEthereumItemUrl(INX, id) : null,
          });
        }

        matched.sort((a, b) => {
          const ba = BigInt(String(a.tokenId));
          const bb = BigInt(String(b.tokenId));
          if (ba < bb) return -1;
          if (ba > bb) return 1;
          return 0;
        });

        const matchedPairIds = new Set(
          matched.map((m) => String(m.tokenId))
        );

        const loneQuirkieIds = quirkiesCol.idKeys.filter((id) => {
          let bi;
          try {
            bi = BigInt(id);
          } catch {
            return false;
          }
          if (bi > PAIR_MAX_TOKEN_ID) return false;
          return !qlSet.has(id);
        });

        const missingQuirkieIds = quirklingsCol.idKeys.filter((id) => {
          let bi;
          try {
            bi = BigInt(id);
          } catch {
            return false;
          }
          if (bi > PAIR_MAX_TOKEN_ID) return false;
          return !qSet.has(id);
        });

        const highQuirklingIds = quirklingsCol.idKeys.filter((id) => {
          try {
            return BigInt(id) > PAIR_MAX_TOKEN_ID;
          } catch {
            return false;
          }
        });

        const inxOnlyIds = inxCol.idKeys.filter(
          (id) => !matchedPairIds.has(String(id))
        );

        const missingQuirkieRows = await mapWithConcurrency(
          missingQuirkieIds,
          COUNTERPART_OWNER_CONCURRENCY,
          async (id) => {
            const [openseaNft, counterpartImage] = await Promise.all([
              resolveOpenSeaNftUrl(nftBase, QUIRKIES, id),
              safeGetNftMetadataImage(nftBase, QUIRKIES, id),
            ]);
            return { openseaNft, counterpartImage };
          }
        );
        const missingQuirkie = missingQuirkieIds.map((id, i) => ({
          tokenId: tokenIdStrToJson(id),
          quirking: rowFromCol(quirklingsCol, id),
          openseaQuirkling: openseaEthereumItemUrl(QUIRKLINGS, id),
          openseaQuirkie: openseaEthereumItemUrl(QUIRKIES, id),
          openseaNft: missingQuirkieRows[i].openseaNft,
          counterpartImage: proxiedImageUrlForClient(
            missingQuirkieRows[i].counterpartImage
          ),
        }));

        const loneQuirkieRows = await mapWithConcurrency(
          loneQuirkieIds,
          COUNTERPART_OWNER_CONCURRENCY,
          async (id) => {
            const [openseaNft, counterpartImage] = await Promise.all([
              resolveOpenSeaNftUrl(nftBase, QUIRKLINGS, id),
              safeGetNftMetadataImage(nftBase, QUIRKLINGS, id),
            ]);
            return { openseaNft, counterpartImage };
          }
        );
        const loneQuirkies = loneQuirkieIds.map((id, i) => ({
          tokenId: tokenIdStrToJson(id),
          quirkie: rowFromCol(quirkiesCol, id),
          openseaQuirkie: openseaEthereumItemUrl(QUIRKIES, id),
          openseaQuirkling: openseaEthereumItemUrl(QUIRKLINGS, id),
          openseaNft: loneQuirkieRows[i].openseaNft,
          counterpartImage: proxiedImageUrlForClient(
            loneQuirkieRows[i].counterpartImage
          ),
        }));

        const quirklingsHigh = highQuirklingIds.map((id) => ({
          tokenId: tokenIdStrToJson(id),
          quirking: rowFromCol(quirklingsCol, id),
          openseaQuirkling: openseaEthereumItemUrl(QUIRKLINGS, id),
        }));

        const inxOnly = inxOnlyIds.map((id) => ({
          tokenId: tokenIdStrToJson(id),
          inx: rowFromCol(inxCol, id),
          openseaInx: INX ? openseaEthereumItemUrl(INX, id) : null,
        }));

        const pairMaxJson =
          PAIR_MAX_TOKEN_ID <= BigInt(Number.MAX_SAFE_INTEGER)
            ? Number(PAIR_MAX_TOKEN_ID)
            : PAIR_MAX_TOKEN_ID.toString(10);

        return json({
          wallet: address,
          pairMaxTokenId: pairMaxJson,
          contracts: {
            quirkies: QUIRKIES,
            quirklings: QUIRKLINGS,
            inx: INX || null,
          },
          quirkies,
          quirklings,
          inx: inxList,
          matched,
          missingQuirkie,
          loneQuirkies,
          quirklingsHigh,
          inxOnly,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return json({ error: "Server error", detail: msg }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}
