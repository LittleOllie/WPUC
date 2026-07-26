import { RECENCY_BUCKETS } from "@/lib/config";

export function daysBetween(isoDate: string, reference = new Date()): number {
  const then = new Date(isoDate).getTime();
  const now = reference.getTime();
  if (Number.isNaN(then)) return 9999;
  return Math.max(0, Math.floor((now - then) / (24 * 60 * 60 * 1000)));
}

export function recencyWeight(isoDate: string, reference = new Date()): number {
  const days = daysBetween(isoDate, reference);
  for (const bucket of RECENCY_BUCKETS) {
    if (days <= bucket.maxDays) return bucket.weight;
  }
  return RECENCY_BUCKETS[RECENCY_BUCKETS.length - 1]?.weight ?? 0.45;
}

export function countActiveDays(dates: string[]): number {
  const set = new Set<string>();
  for (const d of dates) {
    const day = d.slice(0, 10);
    if (day) set.add(day);
  }
  return set.size;
}

export function countActiveWeeks(dates: string[]): number {
  const set = new Set<string>();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    const week = Math.floor(t / (7 * 24 * 60 * 60 * 1000));
    set.add(String(week));
  }
  return set.size;
}
