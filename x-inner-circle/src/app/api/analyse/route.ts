import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RATE_LIMIT_CONFIG } from "@/lib/config";
import { runAnalysis, XApiError } from "@/lib/run-analysis";
import { checkRateLimits, markScanEnd, markScanStart } from "@/lib/security/rate-limit";
import { normaliseUsername } from "@/lib/security/sanitise";
import type { AnalyseResponse, ApiErrorResponse } from "@/types/api";

const bodySchema = z.object({
  input: z.string().min(1).max(200),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

function errorResponse(
  code: ApiErrorResponse["error"]["code"],
  friendlyMessage: string,
  retryable: boolean,
  status: number,
  technicalMessage?: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        friendlyMessage,
        technicalMessage: process.env.NODE_ENV === "development" ? technicalMessage : undefined,
        retryable,
      },
    },
    { status },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse<AnalyseResponse>> {
  if (req.headers.get("content-length")) {
    const len = Number(req.headers.get("content-length"));
    if (Number.isFinite(len) && len > RATE_LIMIT_CONFIG.maxBodyBytes) {
      return errorResponse("INVALID_USERNAME", "Request body too large.", false, 413);
    }
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorResponse("INVALID_USERNAME", "Invalid request body.", false, 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse("INVALID_USERNAME", "Please enter a valid username or profile URL.", false, 400);
  }

  const normalised = normaliseUsername(parsed.data.input);
  if (!normalised.ok) {
    return errorResponse("INVALID_USERNAME", normalised.reason, false, 400);
  }

  const ip = clientIp(req);
  const rate = checkRateLimits(ip, normalised.username);
  if (!rate.allowed) {
    return errorResponse("RATE_LIMITED", rate.reason ?? "Rate limit exceeded.", true, 429);
  }

  markScanStart(ip);
  try {
    const { result, cacheHit } = await runAnalysis(normalised.username);
    return NextResponse.json({ success: true, data: result, cacheHit });
  } catch (err) {
    if (err instanceof XApiError) {
      const code = err.code as ApiErrorResponse["error"]["code"];
      return errorResponse(code, err.message, err.retryable, err.status, err.message);
    }
    return errorResponse(
      "INTERNAL_ERROR",
      "Something went wrong while analysing this account. Please try again.",
      true,
      500,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    markScanEnd(ip);
  }
}
