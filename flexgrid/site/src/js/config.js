import { PRODUCTION_WORKER_BASE, setResolvedWorkerApiOrigin } from "./api.js";

/**
 * Flex Grid Configuration
 * Pins `getWorkerBase()` to the first URL that returns a valid config.
 *
 * On **localhost / 127.0.0.1**, production is tried **first** so opening the site without
 * `wrangler` secrets does not spam 503 on same-origin `/api/config/flex-grid` before the
 * production fallback runs. On ***.workers.dev** previews, same-origin stays first.
 */

const IS_BROWSER = typeof window !== "undefined";

function configCandidateUrls() {
  const urls = [];
  const h = IS_BROWSER && window.location?.hostname ? String(window.location.hostname) : "";
  const isLocalhost = h === "localhost" || h === "127.0.0.1";
  const isWorkersDev = h.endsWith(".workers.dev");

  if (isLocalhost) {
    urls.push(`${PRODUCTION_WORKER_BASE}/api/config/flex-grid`);
    if (window.location?.origin) {
      urls.push(`${window.location.origin}/api/config/flex-grid`);
    }
  } else {
    if (IS_BROWSER && window.location?.origin && isWorkersDev) {
      urls.push(`${window.location.origin}/api/config/flex-grid`);
    }
    urls.push(`${PRODUCTION_WORKER_BASE}/api/config/flex-grid`);
  }
  return urls;
}

async function fetchConfig(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json?.workerUrl) return json;
    throw new Error("Invalid config shape");
  } finally {
    clearTimeout(t);
  }
}

async function loadConfig() {
  if (!IS_BROWSER) throw new Error("Config can only be loaded in the browser.");

  const candidates = configCandidateUrls();
  let lastErr = null;
  for (const fullUrl of candidates) {
    try {
      const cfg = await fetchConfig(fullUrl);
      const origin = new URL(fullUrl).origin;
      setResolvedWorkerApiOrigin(origin);
      if (origin !== PRODUCTION_WORKER_BASE) {
        console.info("[FlexGrid] Using local Worker API at", origin);
      }
      return cfg;
    } catch (e) {
      lastErr = e;
    }
  }
  const msg = `Configuration not available. Tried: ${candidates.join(", ")} — ${lastErr?.message || lastErr}`;
  console.error("Config error:", msg);
  throw new Error(msg);
}

export { loadConfig };
