import type { NormalizedNFT, WalletDNAResult } from "@/lib/wallet-dna/types";
import type { WalletDNAEnv } from "@/lib/wallet-dna/env";
import { runAnalysisFromData } from "@/lib/wallet-dna/analysis/run-analysis";
import { fetchWalletChainData } from "@/lib/wallet-dna/providers/alchemy";

/** Fixture wallets exercise scoring — not hard-coded personalities. */
export const FIXTURE_WALLETS: Record<string, string> = {
  "0x1111111111111111111111111111111111111111": "diamond",
  "0x2222222222222222222222222222222222222222": "base",
  "0x3333333333333333333333333333333333333333": "mint",
  "0x4444444444444444444444444444444444444444": "loyal",
  "0x5555555555555555555555555555555555555555": "empty",
};

export async function getFixtureResult(
  address: string,
  kind: string,
  env?: Pick<WalletDNAEnv, "scoreDebug">,
): Promise<{ result: WalletDNAResult; includedNfts: NormalizedNFT[] } | null> {
  if (kind === "empty") {
    throw new Error("NO_NFT_ACTIVITY");
  }

  const { buildFixtureData } = await import("@/lib/wallet-dna/providers/fixture-data");
  const data = buildFixtureData(kind, address);
  return runAnalysisFromData(address, null, data.nfts, data.transfers, data.coverage, {
    scoreDebug: env?.scoreDebug,
  });
}

export async function analyseWithProvider(
  address: string,
  ensName: string | null,
  apiKey: string,
  maxTransfers: number,
  env?: Pick<WalletDNAEnv, "scoreDebug">,
): Promise<{ result: WalletDNAResult; includedNfts: NormalizedNFT[] }> {
  const { nfts, transfers, coverage } = await fetchWalletChainData(
    address,
    apiKey,
    maxTransfers,
  );
  return runAnalysisFromData(address, ensName, nfts, transfers, coverage, {
    scoreDebug: env?.scoreDebug,
  });
}
