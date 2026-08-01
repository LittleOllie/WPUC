"use client";

import type { WalletDNAResult, WalletNFTPickerResponse } from "@/lib/wallet-dna/types";
import { APP_COPY, PROGRESS_STAGES } from "@/lib/wallet-dna/constants";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Worker URL when set (static GitHub Pages). Otherwise same-origin Next API route. */
const apiBase = process.env.NEXT_PUBLIC_WALLET_DNA_API_BASE?.replace(/\/$/, "") || "";

export function getAnalyseUrl(): string {
  if (apiBase) return `${apiBase}/api/wallet-dna/analyse/`;
  return `${basePath}/api/wallet-dna/analyse/`;
}

export async function analyseWallet(
  wallet: string,
  signal?: AbortSignal,
  options?: { refresh?: boolean },
): Promise<WalletDNAResult> {
  const res = await fetch(getAnalyseUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wallet, refresh: options?.refresh === true }),
    signal,
  }).catch(() => {
    throw new Error(
      "Could not reach Wallet DNA. The analysis service may be temporarily unavailable — please try again.",
    );
  });

  let json: { success?: boolean; data?: WalletDNAResult; error?: { message?: string } };
  try {
    json = await res.json();
  } catch {
    throw new Error(
      res.ok
        ? "Wallet DNA returned an invalid response. Please try again."
        : res.status === 503
          ? "Wallet DNA is temporarily overloaded. Please try again in a moment."
          : `Analysis request failed (${res.status}). Check your connection and try again.`,
    );
  }

  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? `Analysis failed (${res.status}).`);
  }
  if (!json.data) {
    throw new Error("Wallet DNA returned an empty result. Please try again.");
  }
  return json.data;
}

export type FetchWalletNftsParams = {
  wallet: string;
  chain?: "ethereum" | "base";
  contract?: string;
  cursor?: string;
  limit?: number;
  search?: string;
  chainFilter?: "ethereum" | "base";
  keys?: string[];
};

function getNftsUrl(): string {
  if (apiBase) return `${apiBase}/api/wallet-dna/nfts/`;
  return `${basePath}/api/wallet-dna/nfts/`;
}

export async function fetchWalletNfts(
  params: FetchWalletNftsParams,
): Promise<WalletNFTPickerResponse> {
  const q = new URLSearchParams();
  q.set("wallet", params.wallet);
  if (params.chain) q.set("chain", params.chain);
  if (params.contract) q.set("contract", params.contract);
  if (params.cursor) q.set("cursor", params.cursor);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search) q.set("search", params.search);
  if (params.chainFilter) q.set("chainFilter", params.chainFilter);
  if (params.keys?.length) q.set("keys", params.keys.join(","));

  const res = await fetch(`${getNftsUrl()}?${q.toString()}`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: WalletNFTPickerResponse;
    error?: { message?: string };
  };
  if (!json.success || !json.data) {
    throw new Error(json.error?.message ?? "Could not load wallet NFTs.");
  }
  return json.data;
}

export { APP_COPY, PROGRESS_STAGES, basePath };
