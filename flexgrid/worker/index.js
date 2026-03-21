/**
 * Flex Grid Cloudflare Worker
 * - /api/config/flex-grid: Returns config (alchemyApiKey, workerUrl, network)
 * - /img?url=...: Image proxy with CORS
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const WORKER_BASE = "https://loflexgrid.littleollienft.workers.dev";
const IMG_PROXY_BASE = `${WORKER_BASE}/img?url=`;

const CONFIG_RESPONSE = {
  alchemyApiKey: "2LxYSccU9cpZLJ3HEjV6Q",
  workerUrl: IMG_PROXY_BASE,
  network: "eth-mainnet",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function handleConfig() {
  return jsonResponse(CONFIG_RESPONSE);
}

async function handleImgProxy(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response("Missing url parameter", { status: 400, headers: CORS_HEADERS });
  }
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": "FlexGrid-ImageProxy/1.0",
      },
    });
    if (!res.ok) throw new Error(`Upstream ${res.status}`);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=86400");
    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    return new Response("Proxy error", { status: 502, headers: CORS_HEADERS });
  }
}

function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions();
    }

    if (url.pathname === "/api/config/flex-grid" && request.method === "GET") {
      return handleConfig();
    }

    if (url.pathname === "/img" && request.method === "GET") {
      return handleImgProxy(request);
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
};
