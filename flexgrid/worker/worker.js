export default {
  async fetch(request) {
    const url = new URL(request.url);

    // CORS (lets your website talk to this)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*"
        }
      });
    }

    // CONFIG (THIS is what your app needs)
    if (url.pathname === "/api/config/flex-grid") {
      return new Response(JSON.stringify({
        alchemyApiKey: "GYuepn7j7XCslBzxLw05M",
        network: "eth-mainnet",
        ipfsGateway: "https://ipfs.io/ipfs/",
        workerUrl: "https://loflexgrid.littleollienft.workers.dev/img?url="
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // IMAGE PROXY
    if (url.pathname === "/img") {
      const imageUrl = url.searchParams.get("url");

      if (!imageUrl) {
        return new Response("Missing URL", { status: 400 });
      }

      const res = await fetch(imageUrl);

      return new Response(res.body, {
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "image/png",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};