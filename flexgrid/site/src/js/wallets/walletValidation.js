/** Wallet address validation (no DOM). */

export function isValidEvmWalletAddress(addr) {
  const a = String(addr || "").trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(a);
}

export function isValidSolanaWalletAddress(addr) {
  const a = String(addr || "").trim();
  if (a.length < 32 || a.length > 44) return false;
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(a)) return false;
  return true;
}

export function getWalletParseChain(chain) {
  return String(chain || "eth").trim().toLowerCase();
}

export function isValidWalletForChain(addr, chain) {
  const c = getWalletParseChain(chain);
  if (c === "solana") return isValidSolanaWalletAddress(addr);
  return isValidEvmWalletAddress(addr);
}
