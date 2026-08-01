import type { SupportedChain } from "@/lib/wallet-dna/types";

export function normaliseAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

export function isLikelyEns(input: string): boolean {
  const t = input.trim().toLowerCase();
  return t.endsWith(".eth") && t.length > 4 && !t.startsWith("0x");
}

export function isValidEthAddress(input: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(input.trim());
}

export function shortenAddress(addr: string): string {
  const a = normaliseAddress(addr);
  if (!isValidEthAddress(a)) return addr;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function normaliseTokenId(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (s.startsWith("0x")) {
    try {
      return BigInt(s).toString();
    } catch {
      return s.toLowerCase();
    }
  }
  return s;
}

export function createTokenKey(
  chain: SupportedChain,
  contractAddress: string,
  tokenId: string,
): string {
  return `${chain}:${normaliseAddress(contractAddress)}:${normaliseTokenId(tokenId)}`;
}

export function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

export function stableHash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) + h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** Safe max for large arrays — avoids Math.max spread limits in Workers. */
export function maxOf(values: number[]): number | null {
  if (!values.length) return null;
  let max = values[0]!;
  for (let i = 1; i < values.length; i++) {
    const v = values[i]!;
    if (v > max) max = v;
  }
  return max;
}

export type WeightedValue = { value: number; weight: number };

/** Median weighted by NFT balance — avoids expanding large ERC-1155 balances. */
export function weightedMedian(items: WeightedValue[]): number | null {
  const filtered = items.filter((i) => i.weight > 0);
  if (!filtered.length) return null;
  const sorted = [...filtered].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1]!.value;
}

export function weightedAverage(items: WeightedValue[]): number | null {
  const filtered = items.filter((i) => i.weight > 0);
  if (!filtered.length) return null;
  const totalWeight = filtered.reduce((s, i) => s + i.weight, 0);
  const sum = filtered.reduce((s, i) => s + i.value * i.weight, 0);
  return sum / totalWeight;
}

export function weightedPercentOverThreshold(items: WeightedValue[], threshold: number): number {
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  if (!totalWeight) return 0;
  const over = items
    .filter((i) => i.value >= threshold)
    .reduce((s, i) => s + i.weight, 0);
  return Math.round((over / totalWeight) * 1000) / 10;
}

export function formatStatDate(iso: string | null): string {
  if (!iso) return "Not enough history available";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "Not enough history available";
  }
}

export function formatRelativeAcquisition(iso: string): string {
  const ms = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "Added just now";
  if (minutes < 60) {
    return minutes === 1 ? "Added 1 minute ago" : `Added ${minutes} minutes ago`;
  }
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) {
    return hours === 1 ? "Added 1 hour ago" : `Added ${hours} hours ago`;
  }
  const days = Math.floor(ms / 86400000);
  if (days === 1) return "Added 1 day ago";
  return `Added ${days} days ago`;
}
