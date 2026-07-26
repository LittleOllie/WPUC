import { getAnalysisLimits } from "@/lib/analysis-limits";
import { getEnvSafe } from "@/lib/env";
import { ScanBudget } from "@/lib/security/scan-budget";
import type { XApiResponse, XPost, XRequestMeta, XUsageSummary, XUser } from "@/lib/x-api/types";
import { XApiError } from "@/lib/x-api/types";
import type { AnalysisLimits } from "@/lib/analysis-limits";

const POST_FIELDS = [
  "id",
  "text",
  "author_id",
  "created_at",
  "conversation_id",
  "in_reply_to_user_id",
  "referenced_tweets",
  "entities",
  "public_metrics",
].join(",");

const USER_FIELDS = ["id", "name", "username", "profile_image_url", "verified", "public_metrics"].join(
  ",",
);

const EXPANSIONS = [
  "author_id",
  "in_reply_to_user_id",
  "referenced_tweets.id",
  "referenced_tweets.id.author_id",
  "entities.mentions.username",
].join(",");

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface XApiClientOptions {
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  limits?: AnalysisLimits;
  budget?: ScanBudget;
}

export class XApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly limits: AnalysisLimits;
  readonly budget: ScanBudget;
  readonly usage: XUsageSummary;

  constructor(opts: XApiClientOptions = {}) {
    const env = getEnvSafe();
    this.limits = opts.limits ?? getAnalysisLimits();
    this.budget = opts.budget ?? new ScanBudget(this.limits);
    this.baseUrl = opts.baseUrl ?? env.X_API_BASE_URL;
    this.token = opts.token ?? env.X_BEARER_TOKEN ?? "";
    this.timeoutMs = opts.timeoutMs ?? this.limits.requestTimeoutMs;
    this.usage = {
      apiRequests: 0,
      postsRetrieved: 0,
      mentionsRetrieved: 0,
      profilesRetrieved: 0,
      paginationCount: 0,
      durationMs: 0,
      endpoints: [],
      rateLimitRemaining: null,
      requestLog: [],
    };
  }

  private async request<T>(endpoint: string, init?: RequestInit, paginationIndex = 0): Promise<XApiResponse<T>> {
    this.budget.assertCanRequest();

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : "Request failed";
      throw new XApiError(msg, "X_API_UNAVAILABLE", 503, true);
    } finally {
      clearTimeout(timer);
    }

    this.budget.recordApiRequest();
    const durationMs = Date.now() - started;
    this.usage.apiRequests += 1;
    this.usage.durationMs += durationMs;
    this.usage.endpoints.push(endpoint.split("?")[0] ?? endpoint);

    const remaining = res.headers.get("x-rate-limit-remaining");
    const rateLimitRemaining = remaining != null ? Number(remaining) : null;
    if (rateLimitRemaining != null && !Number.isNaN(rateLimitRemaining)) {
      this.usage.rateLimitRemaining = rateLimitRemaining;
    }

    let json: XApiResponse<T>;
    try {
      json = (await res.json()) as XApiResponse<T>;
    } catch {
      throw new XApiError("Invalid JSON from X API", "X_API_UNAVAILABLE", res.status, res.status >= 500);
    }

    const resourcesReturned = Array.isArray(json.data)
      ? json.data.length
      : json.data
        ? 1
        : 0;

    const meta: XRequestMeta = {
      endpoint: endpoint.split("?")[0] ?? endpoint,
      status: res.status,
      durationMs,
      resourcesReturned,
      paginationIndex,
      rateLimitRemaining,
    };
    this.usage.requestLog.push(meta);

    if (res.status === 401 || res.status === 403) {
      throw new XApiError("X API authentication failed", "X_AUTH_ERROR", res.status, false);
    }
    if (res.status === 429) {
      throw new XApiError("X API rate limit reached", "X_RATE_LIMITED", 429, true);
    }
    if (res.status === 404) {
      throw new XApiError("User not found", "USER_NOT_FOUND", 404, false);
    }
    if (!res.ok) {
      const detail = json.errors?.[0]?.detail ?? json.errors?.[0]?.title ?? res.statusText;
      throw new XApiError(detail || "X API error", "X_API_UNAVAILABLE", res.status, res.status >= 500);
    }

    return json;
  }

  async getUserByUsername(username: string): Promise<XUser> {
    const q = `/users/by/username/${encodeURIComponent(username)}?user.fields=${USER_FIELDS}`;
    const res = await this.request<XUser>(q);
    if (!res.data) throw new XApiError("User not found", "USER_NOT_FOUND", 404, false);
    this.usage.profilesRetrieved += 1;
    this.budget.recordProfiles(1);
    return res.data;
  }

  async getUserPosts(userId: string, max = this.limits.maxPostsPerScan): Promise<{ posts: XPost[]; users: XUser[] }> {
    const posts: XPost[] = [];
    const users = new Map<string, XUser>();
    let nextToken: string | undefined;
    let pages = 0;

    while (this.budget.canFetchPosts(posts.length) && this.budget.canPaginate()) {
      const params = new URLSearchParams({
        max_results: String(Math.min(100, max - posts.length)),
        "tweet.fields": POST_FIELDS,
        expansions: EXPANSIONS,
        "user.fields": USER_FIELDS,
      });
      if (nextToken) params.set("pagination_token", nextToken);

      const res = await this.request<XPost[]>(
        `/users/${userId}/tweets?${params.toString()}`,
        undefined,
        pages,
      );
      pages += 1;
      this.usage.paginationCount += 1;
      this.budget.recordPagination();

      const batch = res.data ?? [];
      for (const p of batch) posts.push(p);
      this.budget.recordPosts(batch.length);
      for (const u of res.includes?.users ?? []) users.set(u.id, u);

      nextToken = res.meta?.next_token;
      if (!nextToken || !this.budget.canFetchPosts(posts.length)) break;
    }

    this.usage.postsRetrieved += posts.length;
    return { posts, users: [...users.values()] };
  }

  async getMentions(userId: string, max = this.limits.maxMentionsPerScan): Promise<{ posts: XPost[]; users: XUser[] }> {
    const posts: XPost[] = [];
    const users = new Map<string, XUser>();
    let nextToken: string | undefined;
    let pages = 0;

    while (this.budget.canFetchMentions(posts.length) && this.budget.canPaginate()) {
      const params = new URLSearchParams({
        max_results: String(Math.min(100, max - posts.length)),
        "tweet.fields": POST_FIELDS,
        expansions: EXPANSIONS,
        "user.fields": USER_FIELDS,
      });
      if (nextToken) params.set("pagination_token", nextToken);

      let res: XApiResponse<XPost[]>;
      try {
        res = await this.request<XPost[]>(
          `/users/${userId}/mentions?${params.toString()}`,
          undefined,
          pages,
        );
      } catch (err) {
        if (err instanceof XApiError && (err.status === 403 || err.status === 401)) {
          return { posts, users: [...users.values()] };
        }
        throw err;
      }

      pages += 1;
      this.usage.paginationCount += 1;
      this.budget.recordPagination();

      const batch = res.data ?? [];
      for (const p of batch) posts.push(p);
      this.budget.recordMentions(batch.length);
      for (const u of res.includes?.users ?? []) users.set(u.id, u);
      nextToken = res.meta?.next_token;
      if (!nextToken || !this.budget.canFetchMentions(posts.length)) break;
    }

    this.usage.mentionsRetrieved += posts.length;
    return { posts, users: [...users.values()] };
  }

  async getUsersByIds(ids: string[]): Promise<XUser[]> {
    if (!ids.length) return [];
    const unique = [...new Set(ids)].slice(0, this.limits.maxProfileLookupsPerScan);
    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));

    const out: XUser[] = [];
    for (const chunk of chunks) {
      if (out.length >= this.limits.maxProfileLookupsPerScan) break;
      const q = `/users?ids=${chunk.join(",")}&user.fields=${USER_FIELDS}`;
      const res = await this.request<XUser[]>(q);
      const batch = res.data ?? [];
      out.push(...batch);
      this.budget.recordProfiles(batch.length);
    }
    this.usage.profilesRetrieved += out.length;
    return out;
  }

  static async withRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof XApiError && err.retryable && retries > 0) {
        await sleep(400);
        return XApiClient.withRetry(fn, retries - 1);
      }
      throw err;
    }
  }
}

export { POST_FIELDS, USER_FIELDS, EXPANSIONS };
