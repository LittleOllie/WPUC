import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_MAX_TRANSFERS_PER_CHAIN,
  HIGHLIGHTS_VERSION,
  SCHEMA_VERSION,
  SCORING_VERSION,
} from "@/lib/wallet-dna/constants";

export type WalletDNAEnv = {
  alchemyApiKey: string;
  cacheTtlSeconds: number;
  maxTransfersPerChain: number;
  useFixtures: boolean;
  nodeEnv: string;
  scoreDebug: boolean;
};

export function getWalletDNAEnv(env: Record<string, string | undefined> = process.env): WalletDNAEnv {
  const dedicated = env.ALCHEMY_API_KEY_WALLET_DNA?.trim();
  const fallback = env.ALCHEMY_API_KEY?.trim();
  const alchemyApiKey = dedicated || fallback || "";

  const cacheTtlSeconds = Number(env.WALLET_DNA_CACHE_TTL_SECONDS) || DEFAULT_CACHE_TTL_SECONDS;
  const maxTransfersPerChain =
    Number(env.WALLET_DNA_MAX_TRANSFERS_PER_CHAIN) || DEFAULT_MAX_TRANSFERS_PER_CHAIN;

  const useFixtures =
    env.WALLET_DNA_USE_FIXTURES === "true" &&
    (env.NODE_ENV === "development" || env.NODE_ENV === "test" || env.VITEST === "true");

  return {
    alchemyApiKey,
    cacheTtlSeconds,
    maxTransfersPerChain,
    useFixtures,
    nodeEnv: env.NODE_ENV ?? "development",
    scoreDebug:
      env.WALLET_DNA_SCORE_DEBUG === "true" ||
      env.NODE_ENV === "development" ||
      env.NODE_ENV === "test" ||
      env.VITEST === "true",
  };
}

export function cacheKeyForWallet(address: string): string {
  return `wallet-dna:v${SCHEMA_VERSION}:scoring-${SCORING_VERSION}:highlights-${HIGHLIGHTS_VERSION}:ethereum-base:${address.toLowerCase()}`;
}
