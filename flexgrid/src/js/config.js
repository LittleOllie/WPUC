/**
 * Flex Grid Configuration
 * Always fetches from https://loflexgrid.littleollienft.workers.dev/api/config/flex-grid
 * (never localhost – avoids 404s when dev server is down)
 */

const IS_BROWSER = typeof window !== "undefined";

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
    if (json?.workerUrl) return json;
    throw new Error("Invalid config shape");
  } finally {
    clearTimeout(t);
  }
}

async function loadConfig() {
  if (!IS_BROWSER) throw new Error("Config can only be loaded in the browser.");

  try {
    return await fetchConfig(WORKER_CONFIG_URL);
  } catch (e) {
    const msg = `Configuration not available. Worker: ${WORKER_CONFIG_URL}`;
    console.error("Config error:", msg, e?.message || e);
    throw new Error(msg);
  }
}

export { loadConfig };
