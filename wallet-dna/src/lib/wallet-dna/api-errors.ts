import type { WalletDNAErrorCode } from "@/lib/wallet-dna/types";

export function mapErrorToResponse(err: unknown): {
  code: WalletDNAErrorCode;
  message: string;
  status: number;
  retryable: boolean;
} {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg === "INVALID_WALLET") {
    return {
      code: "INVALID_WALLET",
      message: "That does not look like a valid Ethereum wallet address or ENS name.",
      status: 400,
      retryable: false,
    };
  }
  if (msg === "ENS_NOT_FOUND") {
    return {
      code: "ENS_NOT_FOUND",
      message: "We could not find an address for that ENS name.",
      status: 404,
      retryable: false,
    };
  }
  if (msg === "NO_NFT_ACTIVITY") {
    return {
      code: "NO_NFT_ACTIVITY",
      message: "We could not find supported NFT activity for this wallet on Ethereum or Base.",
      status: 422,
      retryable: false,
    };
  }
  if (msg === "MISSING_ALCHEMY_CONFIG") {
    return {
      code: "MISSING_ALCHEMY_CONFIG",
      message: "Wallet DNA analysis is not configured on the server. The Alchemy API key is missing.",
      status: 503,
      retryable: false,
    };
  }
  if (msg.includes("PROVIDER_RATE_LIMIT")) {
    return {
      code: "PROVIDER_RATE_LIMIT",
      message: "Wallet DNA is temporarily rate limited. Please try again shortly.",
      status: 429,
      retryable: true,
    };
  }
  if (msg === "PROVIDER_AUTH" || msg.includes("PROVIDER_UNAVAILABLE:401") || msg.includes("PROVIDER_UNAVAILABLE:403")) {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message:
        "Wallet DNA could not authenticate with the blockchain data provider. Check your Alchemy API key.",
      status: 503,
      retryable: false,
    };
  }
  if (msg.includes("PROVIDER_UNAVAILABLE") || msg === "PROVIDER_UNAVAILABLE") {
    return {
      code: "PROVIDER_UNAVAILABLE",
      message: "Wallet DNA could not reach the blockchain data provider. Please try again.",
      status: 503,
      retryable: true,
    };
  }
  if (msg === "ANALYSIS_TIMEOUT") {
    return {
      code: "ANALYSIS_TIMEOUT",
      message: "Analysis took too long. Try again or use a wallet with less activity.",
      status: 504,
      retryable: true,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Something went wrong while analysing this wallet.",
    status: 500,
    retryable: true,
  };
}
