import type { AnalysisLimits } from "@/lib/analysis-limits";
import { XApiError } from "@/lib/x-api/types";

export interface ScanBudgetSnapshot {
  apiRequests: number;
  paginationRequests: number;
  postsRetrieved: number;
  mentionsRetrieved: number;
  profilesRetrieved: number;
  stoppedReason: string | null;
}

/** Hard caps per analysis run — stops before unbounded X API usage. */
export class ScanBudget {
  private apiRequests = 0;
  private paginationRequests = 0;
  private postsRetrieved = 0;
  private mentionsRetrieved = 0;
  private profilesRetrieved = 0;
  stoppedReason: string | null = null;

  constructor(private readonly limits: AnalysisLimits) {}

  snapshot(): ScanBudgetSnapshot {
    return {
      apiRequests: this.apiRequests,
      paginationRequests: this.paginationRequests,
      postsRetrieved: this.postsRetrieved,
      mentionsRetrieved: this.mentionsRetrieved,
      profilesRetrieved: this.profilesRetrieved,
      stoppedReason: this.stoppedReason,
    };
  }

  private markStopped(reason: string): void {
    if (!this.stoppedReason) this.stoppedReason = reason;
  }

  assertCanRequest(): void {
    if (this.stoppedReason) {
      throw new XApiError(this.stoppedReason, "X_BUDGET_LIMIT_REACHED", 429, false);
    }
    if (this.apiRequests >= this.limits.maxApiRequestsPerScan) {
      const msg = "Analysis stopped at the configured API request limit.";
      this.markStopped(msg);
      throw new XApiError(msg, "X_BUDGET_LIMIT_REACHED", 429, false);
    }
  }

  recordApiRequest(): void {
    this.apiRequests += 1;
  }

  canPaginate(): boolean {
    return this.paginationRequests < this.limits.maxPaginationRequests && !this.stoppedReason;
  }

  recordPagination(): void {
    this.paginationRequests += 1;
    if (this.paginationRequests >= this.limits.maxPaginationRequests) {
      this.markStopped("Analysis stopped at the configured pagination limit.");
    }
  }

  canFetchPosts(current: number): boolean {
    return current < this.limits.maxPostsPerScan && !this.stoppedReason;
  }

  canFetchMentions(current: number): boolean {
    return current < this.limits.maxMentionsPerScan && !this.stoppedReason;
  }

  recordPosts(n: number): void {
    this.postsRetrieved += n;
    if (this.postsRetrieved >= this.limits.maxPostsPerScan) {
      this.markStopped("Analysis stopped at the configured posts scan limit.");
    }
  }

  recordMentions(n: number): void {
    this.mentionsRetrieved += n;
    if (this.mentionsRetrieved >= this.limits.maxMentionsPerScan) {
      this.markStopped("Analysis stopped at the configured mentions scan limit.");
    }
  }

  recordProfiles(n: number): void {
    this.profilesRetrieved += n;
    if (this.profilesRetrieved >= this.limits.maxProfileLookupsPerScan) {
      this.markStopped("Analysis stopped at the configured profile lookup limit.");
    }
  }
}
