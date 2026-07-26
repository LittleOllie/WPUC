import { ANALYSIS_CONFIG } from "@/lib/config";

export function shouldContinuePagination(
  fetched: number,
  max: number,
  pages: number,
  hasNextToken: boolean,
): boolean {
  if (fetched >= max) return false;
  if (pages >= ANALYSIS_CONFIG.maxPaginationRequests) return false;
  return hasNextToken;
}

export function nextPageSize(fetched: number, max: number): number {
  return Math.min(100, max - fetched);
}
