import { APP_CONFIG, SCORING_VERSION } from "@/lib/config";
import { getAnalysisLimits } from "@/lib/analysis-limits";
import { assertLiveAnalysisReady, getEnv } from "@/lib/env";
import { getAvatarProxyBase, upgradeTwitterProfileImageUrl } from "@/lib/deployment";
import { assignRings, flattenRingCandidates } from "@/lib/analysis/assign-rings";
import { calculateOverallConfidence } from "@/lib/analysis/confidence";
import { scoreCandidates } from "@/lib/analysis/calculate-score";
import {
  dedupeEvents,
  extractInteractionsFromPosts,
  groupEventsByCounterparty,
} from "@/lib/analysis/extract-interactions";
import type { AnalysisResult, TargetAccount } from "@/lib/analysis/types";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache";
import { generateCircleSvg } from "@/lib/image/svg-generator";
import { getMockAnalysisResult } from "@/lib/mock/mock-analysis";
import { profileUrlForUsername } from "@/lib/security/sanitise";
import { XApiClient } from "@/lib/x-api/client";
import { fetchTargetActivity } from "@/lib/x-api/endpoints";
import { mergePosts, mergeUsers } from "@/lib/x-api/normalise-response";
import { XApiError, type XUser } from "@/lib/x-api/types";

export async function runAnalysis(username: string): Promise<{ result: AnalysisResult; cacheHit: boolean }> {
  const cached = getCachedAnalysis(username);
  if (cached) return { result: cached, cacheHit: true };

  const env = getEnv();
  if (env.isMockMode) {
    const result = await getMockAnalysisResult(username);
    setCachedAnalysis(username, result);
    return { result, cacheHit: false };
  }

  try {
    assertLiveAnalysisReady();
  } catch (err) {
    throw new XApiError(
      err instanceof Error ? err.message : "Live mode is not configured.",
      "X_AUTH_ERROR",
      503,
      false,
    );
  }

  const limits = getAnalysisLimits();
  const client = new XApiClient({ limits });
  const limitations: string[] = [];
  let user: XUser;

  try {
    user = await XApiClient.withRetry(() => client.getUserByUsername(username));
  } catch (err) {
    if (err instanceof XApiError) throw err;
    throw new XApiError("Failed to look up user", "INTERNAL_ERROR", 500, true);
  }

  const target: TargetAccount = {
    id: user.id,
    username: user.username,
    displayName: user.name,
    profileImageUrl: upgradeTwitterProfileImageUrl(user.profile_image_url),
    verified: Boolean(user.verified),
    profileUrl: profileUrlForUsername(user.username),
  };

  const { postsPack, mentionsPack } = await fetchTargetActivity(client, user.id);
  const posts = mergePosts(postsPack.posts, mentionsPack.posts);

  const usersById = mergeUsers(new Map(), [...postsPack.users, ...mentionsPack.users]);
  usersById.set(user.id, user);

  if (posts.length === 0) {
    throw new XApiError(
      "Not enough public activity found for analysis.",
      "INSUFFICIENT_PUBLIC_DATA",
      422,
      false,
    );
  }

  if (
    postsPack.posts.length >= limits.maxPostsPerScan ||
    mentionsPack.posts.length >= limits.maxMentionsPerScan
  ) {
    limitations.push("Analysis stopped at the configured scan limit.");
  }

  const budgetReason = client.budget.snapshot().stoppedReason;
  if (budgetReason) limitations.push(budgetReason);

  const events = dedupeEvents(extractInteractionsFromPosts(user.id, posts, usersById));
  const grouped = groupEventsByCounterparty(user.id, events, usersById);
  const candidates = scoreCandidates(target, grouped);
  const rings = assignRings(candidates);
  const flat = flattenRingCandidates(rings);

  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - limits.analysisDays);

  const result: AnalysisResult = {
    target,
    analysedAt: now.toISOString(),
    analysisWindow: {
      from: from.toISOString(),
      to: now.toISOString(),
      days: limits.analysisDays,
    },
    sourceCounts: {
      postsAnalysed: postsPack.posts.length,
      mentionsAnalysed: mentionsPack.posts.length,
      accountsDiscovered: flat.length,
      interactionsCounted: events.length,
    },
    candidates: flat,
    rings,
    confidence: calculateOverallConfidence(
      events,
      limitations,
      posts.length / limits.maxPostsPerScan,
    ),
    limitations,
    usage: {
      apiRequests: client.usage.apiRequests,
      postsRetrieved: client.usage.postsRetrieved,
      mentionsRetrieved: client.usage.mentionsRetrieved,
      profilesRetrieved: client.usage.profilesRetrieved,
      paginationCount: client.usage.paginationCount,
      durationMs: client.usage.durationMs,
      endpoints: client.usage.endpoints,
      rateLimitRemaining: client.usage.rateLimitRemaining,
    },
    generatedDisclaimer: APP_CONFIG.disclaimer,
    scoringVersion: SCORING_VERSION,
  };

  result.svgMarkup = generateCircleSvg(target, rings, {
    useInitialsOnly: false,
    proxyBase: getAvatarProxyBase(),
  });
  setCachedAnalysis(username, result);
  return { result, cacheHit: false };
}

export { XApiError };
