/**
 * Wallet DNA API — Cloudflare Worker
 * Routes: GET /health, POST /api/wallet-dna/analyse, GET /api/wallet-dna/nfts, GET /api/wallet-dna/image-proxy
 */
import handler from "../wallet-dna/dist-worker/handler.mjs";

const SCORING_VERSION = "1.0";
const SCHEMA_VERSION = 2;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
  "Access-Control-Max-Age": "86400",
};

function normalizePath(pathname) {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed;
}

function requestId(request) {
  return request.headers.get("cf-ray") ?? request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

function jsonError(status, code, message, requestIdValue, retryable = false) {
  return Response.json(
    {
      success: false,
      error: { code, message, retryable },
      requestId: requestIdValue,
    },
    { status, headers: { "Content-Type": "application/json", ...CORS } },
  );
}

function alchemyConfigured(env) {
  return Boolean(env.ALCHEMY_API_KEY_WALLET_DNA?.trim() || env.ALCHEMY_API_KEY?.trim());
}

function handleHealth(env, id) {
  const configured = alchemyConfigured(env);
  const body = {
    success: configured,
    service: "wallet-dna-api",
    status: configured ? "ok" : "misconfigured",
    scoringVersion: SCORING_VERSION,
    schemaVersion: SCHEMA_VERSION,
    alchemyConfigured: configured,
    deploymentVersion: env.DEPLOYMENT_VERSION ?? null,
    requestId: id,
  };
  return Response.json(body, {
    status: configured ? 200 : 503,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function invokeHandler(request, env, id) {
  if (!alchemyConfigured(env)) {
    return jsonError(
      503,
      "MISSING_ALCHEMY_CONFIG",
      "Wallet DNA analysis is not configured on the server. The Alchemy API key is missing.",
      id,
      false,
    );
  }

  try {
    const res = await handler(request, env);
    const headers = new Headers(res.headers);
    Object.entries(CORS).forEach(([k, v]) => headers.set(k, v));
    headers.set("X-Request-Id", id);

    const contentType = res.headers.get("Content-Type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await res.json();
      return Response.json({ ...payload, requestId: id }, { status: res.status, headers });
    }

    return new Response(res.body, { status: res.status, headers });
  } catch (e) {
    console.error("wallet-dna handler error", id, e instanceof Error ? e.message : String(e));
    return jsonError(500, "INTERNAL_ERROR", "Analysis failed.", id, true);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const id = requestId(request);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { ...CORS, "X-Request-Id": id } });
    }

    if (request.method === "GET" && path === "/health") {
      return handleHealth(env, id);
    }

    if (request.method === "GET" && path === "/api/wallet-dna/nfts") {
      return invokeHandler(request, env, id);
    }

    if (request.method === "GET" && path === "/api/wallet-dna/image-proxy") {
      return invokeHandler(request, env, id);
    }

    if (request.method === "POST" && path === "/api/wallet-dna/analyse") {
      return invokeHandler(request, env, id);
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return jsonError(405, "METHOD_NOT_ALLOWED", "Method not allowed.", id, false);
    }

    return jsonError(404, "INTERNAL_ERROR", "Not found.", id, false);
  },
};
