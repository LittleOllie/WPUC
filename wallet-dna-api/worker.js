/**
 * Wallet DNA API — Cloudflare Worker
 * POST /api/wallet-dna/analyse
 */
import handler from "../wallet-dna/dist-worker/handler.mjs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method === "GET" && url.pathname === "/api/wallet-dna/nfts") {
      try {
        const res = await handler(request, env);
        const headers = new Headers(res.headers);
        Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return Response.json({ error: "NFT browse failed" }, { status: 502, headers: CORS });
      }
    }
    if (request.method === "GET" && url.pathname === "/api/wallet-dna/image-proxy") {
      try {
        const res = await handler(request, env);
        const headers = new Headers(res.headers);
        Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return Response.json({ error: "Proxy failed" }, { status: 502, headers: CORS });
      }
    }
    if (request.method === "POST" && url.pathname === "/api/wallet-dna/analyse") {
      try {
        const res = await handler(request, env);
        const headers = new Headers(res.headers);
        Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
        return new Response(res.body, { status: res.status, headers });
      } catch (e) {
        return Response.json(
          { success: false, error: { code: "INTERNAL_ERROR", message: "Analysis failed." } },
          { status: 500, headers: { "Content-Type": "application/json", ...CORS } },
        );
      }
    }
    return new Response("Not found", { status: 404, headers: CORS });
  },
};
