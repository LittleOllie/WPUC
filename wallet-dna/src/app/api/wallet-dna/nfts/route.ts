import { NextRequest } from "next/server";
import { handleWalletNftsRequest } from "@/lib/wallet-dna/api/nfts-handler";

export async function GET(req: NextRequest): Promise<Response> {
  return handleWalletNftsRequest(req);
}
