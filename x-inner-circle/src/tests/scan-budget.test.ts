import { describe, it, expect } from "vitest";
import { ScanBudget } from "@/lib/security/scan-budget";
import type { AnalysisLimits } from "@/lib/analysis-limits";
import { XApiError } from "@/lib/x-api/types";

const tightLimits: AnalysisLimits = {
  analysisDays: 30,
  maxPostsPerScan: 5,
  maxMentionsPerScan: 5,
  maxProfileLookupsPerScan: 3,
  maxPaginationRequests: 2,
  maxApiRequestsPerScan: 3,
  requestTimeoutMs: 5000,
};

describe("ScanBudget", () => {
  it("stops further API requests after the cap", () => {
    const budget = new ScanBudget(tightLimits);
    budget.recordApiRequest();
    budget.recordApiRequest();
    budget.recordApiRequest();

    expect(() => budget.assertCanRequest()).toThrow(XApiError);
    expect(budget.snapshot().stoppedReason).toContain("API request limit");
  });

  it("marks pagination limit without throwing mid-page", () => {
    const budget = new ScanBudget(tightLimits);
    budget.recordPagination();
    budget.recordPagination();
    expect(budget.canPaginate()).toBe(false);
    expect(budget.snapshot().stoppedReason).toContain("pagination limit");
  });

  it("records post scan limits", () => {
    const budget = new ScanBudget(tightLimits);
    budget.recordPosts(5);
    expect(budget.canFetchPosts(5)).toBe(false);
    expect(budget.snapshot().stoppedReason).toContain("posts scan limit");
  });
});
