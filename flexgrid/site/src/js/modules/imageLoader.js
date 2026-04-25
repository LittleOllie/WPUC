// Lightweight image loader / resolver used by app.js.
// Frontend-only: no backend logic, no API calls beyond fetching the image URLs themselves.

const SESSION_KEY = "flexgrid_imageLoader_cache_v1";

/**
 * In-session cache: rawUrl -> resolvedUrl (string) OR null (known-bad).
 * This is intentionally simple to avoid interfering with any existing business logic.
 */
const memCache = new Map();
const failCache = new Map(); // rawUrl -> timestamp ms

const FAIL_TTL_MS = 60_000;

function now() {
  return Date.now();
}

function isFreshFail(rawUrl) {
  const t = failCache.get(rawUrl);
  return typeof t === "number" && now() - t < FAIL_TTL_MS;
}

function markFail(rawUrl) {
  failCache.set(rawUrl, now());
  memCache.set(rawUrl, null);
}

function markOk(rawUrl, resolvedUrl) {
  if (!rawUrl) return;
  memCache.set(rawUrl, resolvedUrl || rawUrl);
}

function safeParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

export function hydrateImageLoaderFromSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = safeParseJSON(raw);
    if (!parsed || typeof parsed !== "object") return;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== "string") continue;
      if (typeof v === "string") memCache.set(k, v);
      else if (v === null) memCache.set(k, null);
    }
  } catch (_) {
    // ignore
  }
}

function persistSoon() {
  try {
    const obj = Object.create(null);
    for (const [k, v] of memCache.entries()) {
      if (typeof k !== "string") continue;
      if (typeof v === "string" || v === null) obj[k] = v;
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(obj));
  } catch (_) {
    // ignore
  }
}

function tryLoadImage(url, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error("empty url"));
    const img = new Image();
    let done = false;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      try {
        img.src = "";
      } catch (_) {}
      reject(new Error("timeout"));
    }, timeoutMs);

    img.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(url);
    };
    img.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error("error"));
    };

    // Allow CORS images to load without tainting canvas when possible
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  });
}

/**
 * Resolve a "raw" art url against a list of candidate urls.
 * The app builds candidates (ipfs/arweave/http gateways); we only pick the first that actually loads.
 */
export async function resolveImageUrlWithCandidates(rawUrl, candidates = []) {
  const key = String(rawUrl || "").trim();
  if (!key) return null;

  if (memCache.has(key)) return memCache.get(key);
  if (isFreshFail(key)) return null;

  const uniq = [];
  const seen = new Set();
  for (const u of [key, ...(Array.isArray(candidates) ? candidates : [])]) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    uniq.push(s);
  }

  for (const u of uniq) {
    try {
      const ok = await tryLoadImage(u);
      markOk(key, ok);
      persistSoon();
      return ok;
    } catch (_) {
      // keep trying next candidate
    }
  }

  markFail(key);
  persistSoon();
  return null;
}

export function clearImageLoaderFailure(rawUrl) {
  const key = String(rawUrl || "").trim();
  if (!key) return;
  failCache.delete(key);
  if (memCache.get(key) === null) memCache.delete(key);
  persistSoon();
}

/**
 * Used by export flow to warm the cache; best-effort only.
 */
export async function preloadResolvedUrlsForExport(urls = []) {
  const list = Array.isArray(urls) ? urls : [];
  const tasks = [];
  for (const u of list) {
    const key = String(u || "").trim();
    if (!key) continue;
    if (memCache.has(key) && memCache.get(key)) continue;
    tasks.push(
      tryLoadImage(key, 18_000)
        .then(() => {
          markOk(key, key);
        })
        .catch(() => {
          // ignore
        })
    );
  }
  if (tasks.length) {
    await Promise.allSettled(tasks);
    persistSoon();
  }
}

/**
 * Produces a stable-ish cache key for NFT/custom image objects.
 * This is UI-only caching; do not include secrets.
 */
export function cacheKeyFromRawArt(raw) {
  try {
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object") {
      const parts = [];
      if (raw.contract) parts.push(String(raw.contract));
      if (raw.tokenId != null) parts.push(String(raw.tokenId));
      if (raw.token_id != null) parts.push(String(raw.token_id));
      if (raw.image) parts.push(String(raw.image));
      if (raw.imageUrl) parts.push(String(raw.imageUrl));
      if (raw._rawImageUrl) parts.push(String(raw._rawImageUrl));
      if (raw._displayImageUrl) parts.push(String(raw._displayImageUrl));
      return parts.filter(Boolean).join("::");
    }
    return String(raw);
  } catch (_) {
    return "";
  }
}

