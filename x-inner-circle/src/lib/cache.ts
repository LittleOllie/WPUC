import { ANALYSIS_CONFIG, SCORING_VERSION } from "@/lib/config";
import type { AnalysisResult } from "@/lib/analysis/types";

interface CacheEntry {
  result: AnalysisResult;
  generatedAt: number;
  scoringVersion: string;
  sourceLimits: Record<string, number>;
}

/**
 * In-memory cache for local dev / single-instance MVP.
 * Swap for Redis/KV before multi-instance deployment.
 */
const store = new Map<string, CacheEntry>();

export function cacheKey(username: string): string {
  return [
    username.toLowerCase(),
    ANALYSIS_CONFIG.analysisDays,
    ANALYSIS_CONFIG.maxPostsPerScan,
    ANALYSIS_CONFIG.maxMentionsPerScan,
    SCORING_VERSION,
  ].join("::");
}

export function getCachedAnalysis(username: string): AnalysisResult | null {
  const key = cacheKey(username);
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.generatedAt > ANALYSIS_CONFIG.cacheDurationMs) {
    store.delete(key);
    return null;
  }
  return hit.result;
}

export function setCachedAnalysis(username: string, result: AnalysisResult): void {
  store.set(cacheKey(username), {
    result,
    generatedAt: Date.now(),
    scoringVersion: SCORING_VERSION,
    sourceLimits: {
      maxPosts: ANALYSIS_CONFIG.maxPostsPerScan,
      maxMentions: ANALYSIS_CONFIG.maxMentionsPerScan,
    },
  });
}

export function clearAnalysisCache(): void {
  store.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: [...store.keys()] };
}

export type { CacheEntry };
