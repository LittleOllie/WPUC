import type { SupportedChain } from "@/lib/wallet-dna/types";
import { normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

export function collectionKey(chain: SupportedChain, contractAddress: string): string {
  return `${chain}:${normaliseAddress(contractAddress)}`;
}
