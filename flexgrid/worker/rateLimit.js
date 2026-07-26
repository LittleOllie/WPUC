/**
 * In-Worker rate limiting (per isolate / edge PoP memory).
 *
 * LIMITATIONS (documented in docs/SECURITY.md):
 * - Not globally authoritative across Cloudflare isolates or PoPs.
 * - Resets when the isolate cold-starts.
 * - Suitable as lightweight abuse protection, not a billing guarantee.
 *
 * Tune via env (optional):
 * - RATE_LIMIT_API_MAX   (default 90/min/IP)
 * - RATE_LIMIT_IMG_MAX   (default 240/min/IP)
 * - RATE_LIMIT_WINDOW_MS (default 60000)
 */

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_API_MAX = 90;
const DEFAULT_IMG_MAX = 360;

/** @type {Map<string, { count: number, resetAt: number }>} */
const apiBuckets = new Map();
/** @type {Map<string, { count: number, resetAt: number }>} */
const imgBuckets = new Map();

function readLimit(env, key, fallback) {
  const raw = env?.[key];
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function clientIp(request) {
  const cf = request.headers.get("CF-Connecting-IP");
  if (cf && cf.trim()) return cf.trim();
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}

/**
 * @param {Map<string, { count: number, resetAt: number }>} store
 * @param {string} bucketKey
 * @param {number} max
 * @param {number} windowMs
 */
function consume(store, bucketKey, max, windowMs) {
  const now = Date.now();
  let bucket = store.get(bucketKey);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  store.set(bucketKey, bucket);
  if (bucket.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return { limited: true, retryAfterSec };
  }
  return { limited: false, retryAfterSec: 0 };
}

/**
 * @param {"api"|"img"} kind
 * @param {Request} request
 * @param {Record<string, string>} env
 */
export function checkRateLimit(kind, request, env) {
  const windowMs = readLimit(env, "RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const max =
    kind === "img"
      ? readLimit(env, "RATE_LIMIT_IMG_MAX", DEFAULT_IMG_MAX)
      : readLimit(env, "RATE_LIMIT_API_MAX", DEFAULT_API_MAX);
  const store = kind === "img" ? imgBuckets : apiBuckets;
  const ip = clientIp(request);
  const bucketKey = `${kind}:${ip}`;
  return consume(store, bucketKey, max, windowMs);
}

/**
 * @param {number} retryAfterSec
 * @param {Record<string, string>} corsHeaders
 */
export function rateLimitResponse(retryAfterSec, corsHeaders) {
  const body = JSON.stringify({
    error: "Too many requests. Please wait a moment and try again.",
    code: "RATE_LIMITED",
  });
  return new Response(body, {
    status: 429,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, retryAfterSec)),
      "Cache-Control": "no-store",
    },
  });
}

export { DEFAULT_API_MAX, DEFAULT_IMG_MAX, DEFAULT_WINDOW_MS };
