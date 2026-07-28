import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/wallet-dna/analyse/route";
import { GET } from "@/app/api/wallet-dna/nfts/route";
import { NextRequest } from "next/server";
import { resetCache } from "@/lib/wallet-dna/cache";
import { resetRateLimits } from "@/lib/wallet-dna/rate-limit";

const WALLET = "0x1111111111111111111111111111111111111111";

describe("GET /api/wallet-dna/nfts", () => {
  beforeEach(() => {
    resetCache();
    resetRateLimits();
    process.env.WALLET_DNA_USE_FIXTURES = "true";
    process.env.ALCHEMY_API_KEY = "test-key";
  });

  it("returns paginated NFTs after analysis", async () => {
    const analyseReq = new NextRequest("http://localhost/api/wallet-dna/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.3" },
      body: JSON.stringify({ wallet: WALLET }),
    });
    await POST(analyseReq);

    const nftsReq = new NextRequest(
      `http://localhost/api/wallet-dna/nfts?wallet=${WALLET}&limit=10`,
    );
    const res = await GET(nftsReq);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.nfts.length).toBeGreaterThan(0);
    expect(json.data.collections.length).toBeGreaterThan(0);
  });

  it("returns 404 when wallet not analysed", async () => {
    const req = new NextRequest(
      `http://localhost/api/wallet-dna/nfts?wallet=0x2222222222222222222222222222222222222222`,
    );
    const res = await GET(req);
    expect(res.status).toBe(404);
  });
});
