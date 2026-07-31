import { NextRequest, NextResponse } from "next/server";
import { analyseRequestSchema } from "@/lib/wallet-dna/schemas";
import { runWalletDNAAnalysisFull, stripScoreDebug } from "@/lib/wallet-dna/analysis/run-analysis";
import { getWalletDNAEnv, cacheKeyForWallet } from "@/lib/wallet-dna/env";
import { getCachedResult, setCachedResult } from "@/lib/wallet-dna/cache";
import { checkRateLimit } from "@/lib/wallet-dna/rate-limit";
import { mapErrorToResponse } from "@/lib/wallet-dna/api-errors";
import { resolveWalletInput } from "@/lib/wallet-dna/utils/ens";

export const maxDuration = 300;

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_WALLET", message: "Invalid request body." },
      },
      { status: 400 },
    );
  }

  const parsed = analyseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_WALLET",
          message: "Enter a valid Ethereum address or ENS name.",
        },
      },
      { status: 400 },
    );
  }

  const env = getWalletDNAEnv();
  const ip = clientIp(req);

  try {
    const { address } = await resolveWalletInput(parsed.data.wallet);
    const cacheKey = cacheKeyForWallet(address);
    const cached = parsed.data.refresh ? null : getCachedResult(cacheKey);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, cacheHit: true });
    }

    const rate = checkRateLimit(ip);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PROVIDER_RATE_LIMIT",
            message: "Too many analyses. Please wait a few minutes.",
          },
        },
        { status: 429 },
      );
    }

    const { result, includedNfts } = await runWalletDNAAnalysisFull(parsed.data.wallet, env);
    const payload = env.scoreDebug ? result : stripScoreDebug(result);
    setCachedResult(cacheKey, stripScoreDebug(result), includedNfts, env.cacheTtlSeconds);
    return NextResponse.json({ success: true, data: payload, cacheHit: false });
  } catch (err) {
    const mapped = mapErrorToResponse(err);
    return NextResponse.json(
      { success: false, error: { code: mapped.code, message: mapped.message } },
      { status: mapped.status },
    );
  }
}
