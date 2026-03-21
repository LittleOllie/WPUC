/**
 * Flex Grid Configuration
 * Production: fetches from https://loflexgrid.littleollienft.workers.dev/api/config/flex-grid
 * Dev: tries localhost first, then Worker
 */

const IS_BROWSER = typeof window !== "undefined";
const HOSTNAME = IS_BROWSER ? window.location.hostname : "";

const WORKER_CONFIG_URL = "https://loflexgrid.littleollienft.workers.dev/api/config/flex-grid";

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
    if (json?.alchemyApiKey && json?.workerUrl) return json;
    throw new Error("Invalid config shape");
  } finally {
    clearTimeout(t);
  }
}

async function loadConfig() {
  if (!IS_BROWSER) throw new Error("Config can only be loaded in the browser.");

  if (HOSTNAME === "localhost" || HOSTNAME === "127.0.0.1") {
    try {
      const cfg = await fetchConfig("http://localhost:3000/api/config/flex-grid", 3000);
      return cfg;
    } catch {
      /* fall through to Worker */
    }
  }

  try {
    const cfg = await fetchConfig(WORKER_CONFIG_URL);
    return cfg;
  } catch (e) {
    const msg = `Configuration not available. Hostname: ${HOSTNAME}. Worker: ${WORKER_CONFIG_URL}`;
    console.error("Config error:", msg, e?.message || e);
    throw new Error(msg);
  }
}

export { loadConfig };
