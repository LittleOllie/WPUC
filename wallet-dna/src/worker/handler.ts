import { fetchProxiedImage, isProxiableImageUrl } from "@/lib/wallet-dna/utils/image-proxy";
import { handleWalletNftsRequest } from "@/lib/wallet-dna/api/nfts-handler";
import { getWalletDNAEnv, cacheKeyForWallet } from "@/lib/wallet-dna/env";
import { getCachedResult, setCachedResult } from "@/lib/wallet-dna/cache";
import { checkRateLimit } from "@/lib/wallet-dna/rate-limit";
import { runWalletDNAAnalysisFull } from "@/lib/wallet-dna/analysis/run-analysis";
import { resolveWalletInput } from "@/lib/wallet-dna/utils/ens";
import { analyseRequestSchema } from "@/lib/wallet-dna/schemas";
import { mapErrorToResponse } from "@/lib/wallet-dna/api-errors";

function clientIp(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function handleAnalyseRequest(
  req: Request,
  rawEnv: Record<string, string | undefined>,
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "INVALID_WALLET", message: "Invalid JSON" } },
      { status: 400 },
    );
  }

  const parsed = analyseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "INVALID_WALLET", message: "Enter a valid Ethereum address or ENS name." } },
      { status: 400 },
    );
  }

  const env = getWalletDNAEnv({ ...rawEnv, NODE_ENV: rawEnv.NODE_ENV ?? "production" });
  const ip = clientIp(req);

  try {
    const { address } = await resolveWalletInput(parsed.data.wallet);
    const cacheKey = cacheKeyForWallet(address);
    const cached = parsed.data.refresh ? null : getCachedResult(cacheKey);
    if (cached) {
      return Response.json({ success: true, data: cached, cacheHit: true });
    }

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return Response.json(
        { success: false, error: { code: "PROVIDER_RATE_LIMIT", message: "Too many requests." } },
        { status: 429 },
      );
    }

    const { result, includedNfts } = await runWalletDNAAnalysisFull(parsed.data.wallet, env);
    setCachedResult(cacheKey, result, includedNfts, env.cacheTtlSeconds);
    return Response.json({ success: true, data: result, cacheHit: false });
  } catch (err) {
    const mapped = mapErrorToResponse(err);
    return Response.json(
      { success: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
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
  const pathname = new URL(req.url).pathname;
  if (req.method === "GET" && pathname.endsWith("/api/wallet-dna/nfts")) {
    return handleWalletNftsRequest(req);
  }
  if (req.method === "GET" && pathname.endsWith("/api/wallet-dna/image-proxy")) {
    return handleImageProxyRequest(req);
  }
  return handleAnalyseRequest(req, env);
}
