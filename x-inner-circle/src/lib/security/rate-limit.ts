import { RATE_LIMIT_CONFIG } from "@/lib/config";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter for MVP.
 * Replace with Upstash Redis / KV before multi-instance public deployment.
 */
const ipBuckets = new Map<string, Bucket>();
const usernameBuckets = new Map<string, Bucket>();
const activeIpScans = new Map<string, number>();

function consume(store: Map<string, Bucket>, key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  let bucket = store.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  store.set(key, bucket);
  return bucket.count <= max;
}

export function checkRateLimits(ip: string, username: string): { allowed: boolean; reason?: string } {
  const hour = 60 * 60 * 1000;
  const ipKey = ip || "unknown";

  if ((activeIpScans.get(ipKey) ?? 0) >= RATE_LIMIT_CONFIG.maxActiveScansPerIp) {
    return { allowed: false, reason: "A scan is already in progress for this connection." };
  }

  if (!consume(ipBuckets, ipKey, RATE_LIMIT_CONFIG.scansPerIpPerHour, hour)) {
    return { allowed: false, reason: "Too many scans from this connection. Please try again later." };
  }

  if (!consume(usernameBuckets, username.toLowerCase(), RATE_LIMIT_CONFIG.scansPerUsernamePerHour, hour)) {
    return { allowed: false, reason: "This username was scanned recently. Please wait before trying again." };
  }

  return { allowed: true };
}

export function markScanStart(ip: string): void {
  const ipKey = ip || "unknown";
  activeIpScans.set(ipKey, (activeIpScans.get(ipKey) ?? 0) + 1);
}

export function markScanEnd(ip: string): void {
  const ipKey = ip || "unknown";
  const n = (activeIpScans.get(ipKey) ?? 1) - 1;
  if (n <= 0) activeIpScans.delete(ipKey);
  else activeIpScans.set(ipKey, n);
}

export function resetRateLimits(): void {
  ipBuckets.clear();
  usernameBuckets.clear();
  activeIpScans.clear();
}
