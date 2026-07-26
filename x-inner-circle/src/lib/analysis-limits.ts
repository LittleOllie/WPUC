/** Runtime scan limits — env overrides with config.ts fallbacks. */

import { ANALYSIS_CONFIG } from "@/lib/config";
import { getEnvSafe } from "@/lib/env";

export interface AnalysisLimits {
  analysisDays: number;
  maxPostsPerScan: number;
  maxMentionsPerScan: number;
  maxProfileLookupsPerScan: number;
  maxPaginationRequests: number;
  maxApiRequestsPerScan: number;
  requestTimeoutMs: number;
}

export function getAnalysisLimits(): AnalysisLimits {
  const env = getEnvSafe();
  return {
    analysisDays: env.X_ANALYSIS_DAYS,
    maxPostsPerScan: env.X_MAX_POSTS_PER_SCAN,
    maxMentionsPerScan: env.X_MAX_MENTIONS_PER_SCAN,
    maxProfileLookupsPerScan: env.X_MAX_PROFILE_LOOKUPS_PER_SCAN,
    maxPaginationRequests: env.X_MAX_PAGINATION_REQUESTS_PER_SCAN,
    maxApiRequestsPerScan: env.X_MAX_API_REQUESTS_PER_SCAN,
    requestTimeoutMs: ANALYSIS_CONFIG.requestTimeoutMs,
  };
}
