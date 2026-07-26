import { describe, it, expect, beforeEach } from "vitest";
import { getAnalysisLimits } from "@/lib/analysis-limits";
import { resetEnvCache } from "@/lib/env";

describe("getAnalysisLimits", () => {
  beforeEach(() => {
    resetEnvCache();
  });

  it("reads scan limits from environment variables", () => {
    process.env.X_MAX_POSTS_PER_SCAN = "12";
    process.env.X_MAX_MENTIONS_PER_SCAN = "8";
    process.env.X_MAX_API_REQUESTS_PER_SCAN = "5";
    process.env.X_MAX_PAGINATION_REQUESTS_PER_SCAN = "2";
    process.env.X_ANALYSIS_DAYS = "30";

    const limits = getAnalysisLimits();
    expect(limits.maxPostsPerScan).toBe(12);
    expect(limits.maxMentionsPerScan).toBe(8);
    expect(limits.maxApiRequestsPerScan).toBe(5);
    expect(limits.maxPaginationRequests).toBe(2);
    expect(limits.analysisDays).toBe(30);
  });
});
