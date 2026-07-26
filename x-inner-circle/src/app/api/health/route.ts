import { NextResponse } from "next/server";
import { SCORING_VERSION } from "@/lib/config";
import { getDeploymentMode } from "@/lib/deployment";
import { getEnvSafe } from "@/lib/env";
import type { HealthResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const env = getEnvSafe();
  return NextResponse.json({
    ok: true,
    mode: env.isMockMode ? "mock" : "live",
    liveConfigured: env.isLiveMode && env.hasBearerToken,
    deployment: getDeploymentMode(),
    scoringVersion: SCORING_VERSION,
  });
}
