const EVM_ADDRESS_RE = /^0x[a-f0-9]{40}$/;

export function trimWalletAddress(address: string): string {
  return address.trim();
}

export function normaliseWalletAddress(address: string): string {
  return trimWalletAddress(address).toLowerCase();
}

export function isValidEvmWalletAddress(address: string): boolean {
  const normalised = normaliseWalletAddress(address);
  return EVM_ADDRESS_RE.test(normalised);
}

export function shortenWalletAddress(
  address: string,
  prefixLen = 6,
  suffixLen = 4,
): string {
  const trimmed = trimWalletAddress(address);
  if (trimmed.length <= prefixLen + suffixLen + 3) return trimmed;
  return `${trimmed.slice(0, prefixLen)}…${trimmed.slice(-suffixLen)}`;
}

export function preserveDisplayAddress(address: string): string {
  const trimmed = trimWalletAddress(address);
  if (!isValidEvmWalletAddress(trimmed)) return trimmed;
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed.slice(2)}`;
}

export function validateWalletInput(address: string): {
  valid: boolean;
  normalised: string | null;
  display: string | null;
  error: string | null;
} {
  const trimmed = trimWalletAddress(address);

  if (!trimmed) {
    return {
      valid: false,
      normalised: null,
      display: null,
      error: "Enter a wallet address.",
    };
  }

  if (!isValidEvmWalletAddress(trimmed)) {
    return {
      valid: false,
      normalised: null,
      display: null,
      error: "Enter a valid EVM wallet address (0x followed by 40 hex characters).",
    };
  }

  const normalised = normaliseWalletAddress(trimmed);
  return {
    valid: true,
    normalised,
    display: preserveDisplayAddress(trimmed),
    error: null,
  };
}

/**
 * Future wallet-signature verification message template.
 * Not used in manual_check flow — reserved for wallet_signature method.
 */
export function buildVerificationMessage(nonce: string): string {
  return [
    "Blackwater Labs — Wallet Verification",
    "",
    `Nonce: ${nonce}`,
    "",
    "Sign this message to confirm wallet ownership for whitelist verification.",
  ].join("\n");
}
