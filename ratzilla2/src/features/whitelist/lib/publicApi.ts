import { invokeEdgeFunction } from "./supabase";
import type { PublicConfirmResult, PublicLookupResult } from "./types";
import { validateWalletInput } from "./wallet";

export async function checkWalletPublic(
  address: string,
): Promise<PublicLookupResult> {
  const validation = validateWalletInput(address);
  if (!validation.valid) {
    return { outcome: "invalid_address" };
  }

  return invokeEdgeFunction<PublicLookupResult>("check-wallet", {
    address: validation.display,
  });
}

export async function confirmWalletPublic(
  address: string,
): Promise<PublicConfirmResult> {
  const validation = validateWalletInput(address);
  if (!validation.valid) {
    return { outcome: "invalid_address" };
  }

  return invokeEdgeFunction<PublicConfirmResult>("confirm-wallet", {
    address: validation.display,
  });
}
