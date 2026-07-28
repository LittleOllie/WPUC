import { isLikelyEns, isValidEthAddress, normaliseAddress } from "@/lib/wallet-dna/utils/helpers";

async function fetchEnsResolve(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: string };
    return data.address ? normaliseAddress(data.address) : null;
  } catch {
    return null;
  }
}

async function fetchEnsReverse(address: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.ensideas.com/ens/reverse/${encodeURIComponent(address)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
}

export async function resolveWalletInput(
  input: string,
): Promise<{ address: string; ensName: string | null }> {
  const trimmed = input.trim();

  if (isLikelyEns(trimmed)) {
    const name = trimmed.toLowerCase();
    const address = await fetchEnsResolve(name);
    if (!address || !isValidEthAddress(address)) throw new Error("ENS_NOT_FOUND");
    return { address, ensName: name };
  }

  if (!isValidEthAddress(trimmed)) {
    throw new Error("INVALID_WALLET");
  }

  const address = normaliseAddress(trimmed);
  const ensName = await fetchEnsReverse(address);
  return { address, ensName };
}

export function validateWalletInput(input: string): boolean {
  const t = input.trim();
  return isValidEthAddress(t) || isLikelyEns(t);
}
