/**
 * Worker /api/img helpers: request coalescing + CORS + response builders (no storage).
 */

/** @type {Map<string, Promise<unknown>>} */
const INFLIGHT = new Map();

/**
 * Coalesce concurrent fetches for the same logical key (e.g. proxied URL).
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 * @template T
 */
export async function dedupeInflight(key, fn) {
  const ex = INFLIGHT.get(key);
  if (ex) return ex;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      INFLIGHT.delete(key);
    }
  })();
  INFLIGHT.set(key, p);
  return p;
}

const FALLBACK_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function base64ToUint8Array(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const FALLBACK_PNG_BYTES = base64ToUint8Array(FALLBACK_PNG_B64);

export function imageProxyCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

/** 1×1 transparent PNG — avoid broken <img> when all origins fail. */
export function fallbackPngResponse() {
  const headers = new Headers(imageProxyCorsHeaders());
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "no-store");
  return new Response(FALLBACK_PNG_BYTES, { status: 200, headers });
}

export function imageBufferToHttpResponse(buffer, contentType, cacheControl) {
  const headers = new Headers(imageProxyCorsHeaders());
  headers.set("Content-Type", contentType || "image/png");
  headers.set(
    "Cache-Control",
    cacheControl || "public, max-age=31536000, immutable"
  );
  headers.set("Content-Length", String(buffer.byteLength));
  return new Response(buffer, { status: 200, headers });
}
