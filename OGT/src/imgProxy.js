/**
 * Edge image proxy for OGT FlexGrid: IPFS multi-gateway, HTTP fetch, optional WebP resize,
 * aggressive cache. Used by GET /img?url=…&size=256|512|1024
 */

const CORS_IMG = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Cache-Control",
};

const IPFS_GATEWAYS = [
  "https://cloudflare-ipfs.com/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://w3s.link/ipfs/",
  "https://dweb.link/ipfs/",
  "https://ipfs.io/ipfs/",
];

const ORIGIN_FETCH_CF = {
  cacheEverything: true,
  cacheTtl: 86400,
};

const IMAGE_FETCH_TIMEOUT_MS = 12000;
const IMAGE_HTTP_RETRY_DELAY_MS = 400;
const MAX_IMAGE_BYTES = 45 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/", "application/octet-stream"];

const DEFAULT_IMAGE_CONTENT_TYPE = "image/png";

const ALLOWED_SIZES = new Set([256, 512, 1024]);

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function imageProxyDebug(env, message, extra) {
  if (env?.IMAGE_PROXY_DEBUG !== "1" && env?.IMAGE_PROXY_DEBUG !== "true") return;
  if (extra !== undefined) console.log("[img]", message, extra);
  else console.log("[img]", message);
}

export function fullyDecodeUrlParam(raw) {
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

export function normalizeIPFS(url) {
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

function headersForImageOrigin(url) {
  const u = String(url || "");
  if (/seadn\.io|looksrare|cdn\.blur\.io|openseauserdata\.com/i.test(u)) {
    return {
      "User-Agent": BROWSER_UA,
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: "https://opensea.io/",
    };
  }
  return { "User-Agent": "OGT-ImageProxy/3.0" };
}

/** @param {Record<string, unknown> | null} imageTransform Cloudflare cf.image options */
async function fetchWithTimeout(
  resource,
  timeoutMs = IMAGE_FETCH_TIMEOUT_MS,
  headerOverrides = {},
  imageTransform = null
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const cf = { ...ORIGIN_FETCH_CF };
  if (imageTransform) {
    cf.image = imageTransform;
  }
  try {
    const res = await fetch(resource, {
      redirect: "follow",
      headers: {
        ...headersForImageOrigin(resource),
        ...headerOverrides,
      },
      signal: controller.signal,
      cf,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

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
  if (ct.includes("text/html") || ct.includes("application/json")) return false;
  return !!allowUnknownContentType;
}

function buildImageProxyResponse(originResponse, contentType) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set(
    "Access-Control-Expose-Headers",
    "Content-Type, Content-Length, Cache-Control"
  );
  headers.set("Cache-Control", "public, max-age=86400, immutable");
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
      ...CORS_IMG,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function parseImageSizeParam(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n) || !ALLOWED_SIZES.has(n)) return null;
  return n;
}

function cfImageOptions(size) {
  return {
    width: size,
    height: size,
    fit: "cover",
    quality: 80,
    format: "webp",
  };
}

async function fetchDirectIpfsUrl(decodedUrl, env, imageTransform) {
  if (!/\/ipfs\//i.test(decodedUrl) && !decodedUrl.startsWith("ipfs://")) return null;
  try {
    const res = await fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS, {}, imageTransform);
    if (isAcceptableImageResponse(res, { allowUnknownContentType: true })) return res;
  } catch {
    /* fall through */
  }
  return null;
}

async function fetchIPFS(ipfsPath, env, imageTransform) {
  const path = sanitizeIpfsPathForGateway(ipfsPath);
  if (!path) return null;

  const tryGateways = async (transform) => {
    for (const gateway of IPFS_GATEWAYS) {
      const url = gateway + path;
      try {
        const res = await fetchWithTimeout(url, IMAGE_FETCH_TIMEOUT_MS, {}, transform);
        if (isAcceptableImageResponse(res, { allowUnknownContentType: true })) {
          return res;
        }
      } catch {
        /* next gateway */
      }
    }
    return null;
  };

  const tryOnce = async () => {
    if (imageTransform) {
      const res = await tryGateways(imageTransform);
      if (res) return res;
    }
    return tryGateways(null);
  };

  let res = await tryOnce();
  if (res) return res;

  await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
  res = await tryOnce();
  return res;
}

async function fetchHttpImage(decodedUrl, env, imageTransform) {
  const relaxCtOnRetry = /seadn\.io|openseauserdata\.com/i.test(decodedUrl);

  const tryWithTransform = async (transform) => {
    const attempts = [
      () => fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS, {}, transform),
      async () => {
        await new Promise((r) => setTimeout(r, IMAGE_HTTP_RETRY_DELAY_MS));
        return fetchWithTimeout(decodedUrl, IMAGE_FETCH_TIMEOUT_MS, {}, transform);
      },
    ];
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
  };

  if (imageTransform) {
    const resized = await tryWithTransform(imageTransform);
    if (resized) return resized;
  }
  return tryWithTransform(null);
}

/**
 * Fetch origin bytes; optionally resize via Cloudflare Image Resizing (falls back to
 * original if resize yields no acceptable image).
 */
async function fetchOriginImage(decodedUrl, env, size) {
  const imageTransform = size ? cfImageOptions(size) : null;
  const ipfsPath = normalizeIPFS(decodedUrl);

  imageProxyDebug(env, "fetchOriginImage", { decodedUrl, size, ipfsPath: !!ipfsPath });

  let originRes = null;

  if (ipfsPath) {
    originRes = await fetchDirectIpfsUrl(decodedUrl, env, imageTransform);
    if (!originRes) {
      originRes = await fetchIPFS(ipfsPath, env, imageTransform);
    }
  } else {
    if (!/^https?:\/\//i.test(decodedUrl)) {
      return null;
    }
    originRes = await fetchHttpImage(decodedUrl, env, imageTransform);
  }

  if (!originRes || !originRes.ok) {
    return null;
  }

  const ct =
    originRes.headers.get("Content-Type")?.split(";")[0].trim() || DEFAULT_IMAGE_CONTENT_TYPE;
  return { response: originRes, contentType: ct };
}

/**
 * @param {Request} request
 * @param {Record<string, string>} env
 * @param {ExecutionContext} ctx
 */
export async function handleImageProxy(request, env, ctx) {
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

  const size = parseImageSizeParam(urlObj.searchParams.get("size"));

  imageProxyDebug(env, "GET /img", { size, decodedUrl: decodedUrl.slice(0, 120) });

  let packed = await fetchOriginImage(decodedUrl, env, size);

  if (!packed && size) {
    imageProxyDebug(env, "resize path failed; retrying original", { size });
    packed = await fetchOriginImage(decodedUrl, env, null);
  }

  if (!packed) {
    return imageProxyError(404, "Image not found");
  }

  const { response: originRes, contentType } = packed;
  const out = buildImageProxyResponse(originRes, contentType);

  try {
    ctx.waitUntil(cache.put(cacheKey, out.clone()));
  } catch (e) {
    console.warn("[img] cache.put failed:", e?.message || e);
  }

  return out;
}
