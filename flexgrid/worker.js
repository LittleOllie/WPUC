const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const CONFIG = {
  alchemyApiKey: "2LxYSccU9cpZLJ3HEjV6Q",
  network: "eth-mainnet",
  ipfsGateway: "https://ipfs.io/ipfs/",
  workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url=",
};

function corsResponse(body, status = 200, contentType = "application/json") {
  return new Response(body, {
    status,
    headers: { "Content-Type": contentType, ...CORS },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const isConfigPath =
      url.pathname === "/api/config/flex-grid" || url.pathname === "/api/config/flexgrid";

    if (isConfigPath && request.method === "GET") {
      return corsResponse(JSON.stringify(CONFIG));
    }

    if (url.pathname === "/img" && request.method === "GET") {
      const imageUrl = url.searchParams.get("url");
      if (!imageUrl) {
        return new Response("Missing URL", { status: 400, headers: CORS });
      }
      try {
        const res = await fetch(imageUrl, {
          headers: { "User-Agent": "FlexGrid-ImageProxy/1.0" },
        });
        if (!res.ok) throw new Error("Upstream error");
        const headers = new Headers(res.headers);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return new Response("Proxy error", { status: 502, headers: CORS });
      }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
