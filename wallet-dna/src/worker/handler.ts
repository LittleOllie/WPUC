import { fetchProxiedImage, isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";
import { handleWalletNftsRequest } from "@/lib/wallet-dna/api/nfts-handler";
import { handleHealthRequest } from "@/lib/wallet-dna/api/health-handler";
import { getWalletDNAEnv, cacheKeyForWallet } from "@/lib/wallet-dna/env";
import { getCachedResult, setCachedResult } from "@/lib/wallet-dna/cache";
import { checkRateLimit } from "@/lib/wallet-dna/rate-limit";
import { runWalletDNAAnalysisFull, stripScoreDebug } from "@/lib/wallet-dna/analysis/run-analysis";
import { resolveWalletInput } from "@/lib/wallet-dna/utils/ens";
import { analyseRequestSchema } from "@/lib/wallet-dna/schemas";
import { mapErrorToResponse } from "@/lib/wallet-dna/api-errors";
import { getRequestId } from "@/lib/wallet-dna/api/request-id";

function jsonWithRequestId(body: Record<string, unknown>, status: number, requestId: string): Response {
  return Response.json({ ...body, requestId }, { status });
}

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function handleAnalyseRequest(
  req: Request,
  rawEnv: Record<string, string | undefined>,
): Promise<Response> {
  const requestId = getRequestId(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithRequestId(
      { success: false, error: { code: "INVALID_WALLET", message: "Invalid JSON", retryable: false } },
      400,
      requestId,
    );
  }

  const parsed = analyseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonWithRequestId(
      {
        success: false,
        error: {
          code: "INVALID_WALLET",
          message: "Enter a valid Ethereum address or ENS name.",
          retryable: false,
        },
      },
      400,
      requestId,
    );
  }

  const env = getWalletDNAEnv({ ...rawEnv, NODE_ENV: rawEnv.NODE_ENV ?? "production" });
  if (!env.alchemyApiKey && !env.useFixtures) {
    return jsonWithRequestId(
      {
        success: false,
        error: {
          code: "MISSING_ALCHEMY_CONFIG",
          message: "Wallet DNA analysis is not configured on the server. The Alchemy API key is missing.",
          retryable: false,
        },
      },
      503,
      requestId,
    );
  }

  const ip = clientIp(req);

  try {
    const { address } = await resolveWalletInput(parsed.data.wallet);
    const cacheKey = cacheKeyForWallet(address);
    const cached = parsed.data.refresh ? null : getCachedResult(cacheKey);
    if (cached) {
      return jsonWithRequestId({ success: true, data: cached, cacheHit: true }, 200, requestId);
    }

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return jsonWithRequestId(
        {
          success: false,
          error: {
            code: "PROVIDER_RATE_LIMIT",
            message: "Too many requests.",
            retryable: true,
          },
        },
        429,
        requestId,
      );
    }

    const { result, includedNfts } = await runWalletDNAAnalysisFull(parsed.data.wallet, env);
    const payload = env.scoreDebug ? result : stripScoreDebug(result);
    setCachedResult(cacheKey, stripScoreDebug(result), includedNfts, env.cacheTtlSeconds);
    return jsonWithRequestId({ success: true, data: payload, cacheHit: false }, 200, requestId);
  } catch (err) {
    const mapped = mapErrorToResponse(err);
    return jsonWithRequestId(
      {
        success: false,
        error: { code: mapped.code, message: mapped.message, retryable: mapped.retryable },
      },
      mapped.status,
      requestId,
    );
  }
}

export async function handleImageProxyRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = url.searchParams.get("url");
  if (!target) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return new Response("Invalid url parameter", { status: 400 });
  }

  if (!isProxiableImageUrl(decoded)) {
    return new Response("URL not allowed", { status: 403 });
  }

  try {
    const result = await fetchProxiedImage(decoded);
    if (!result) {
      return new Response("Image unavailable", { status: 502 });
    }
    return new Response(result.body, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return new Response("Proxy fetch failed", { status: 502 });
  }
}

export default async function handler(req: Request, env: Record<string, string | undefined>): Promise<Response> {
  const pathname = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  if (req.method === "GET" && pathname === "/health") {
    return handleHealthRequest(req, env);
  }
  if (req.method === "GET" && pathname.endsWith("/api/wallet-dna/nfts")) {
    return handleWalletNftsRequest(req);
  }
  if (req.method === "GET" && pathname.endsWith("/api/wallet-dna/image-proxy")) {
    return handleImageProxyRequest(req);
  }
  return handleAnalyseRequest(req, env);
}
