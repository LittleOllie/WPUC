import { RATE_LIMIT } from "@/lib/wallet-dna/constants";

const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT.windowMs;
  const list = (hits.get(ip) ?? []).filter((t) => t > windowStart);
  if (list.length >= RATE_LIMIT.maxFreshAnalysesPerIp) {
    const oldest = list[0] ?? now;
    return { allowed: false, retryAfterMs: oldest + RATE_LIMIT.windowMs - now };
  }
  list.push(now);
  hits.set(ip, list);
  return { allowed: true };
}

export function resetRateLimits(): void {
  hits.clear();
}
