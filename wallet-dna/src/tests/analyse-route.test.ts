import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/wallet-dna/analyse/route";
import { NextRequest } from "next/server";
import { resetCache } from "@/lib/wallet-dna/cache";
import { resetRateLimits } from "@/lib/wallet-dna/rate-limit";

describe("POST /api/wallet-dna/analyse", () => {
  beforeEach(() => {
    resetCache();
    resetRateLimits();
    process.env.WALLET_DNA_USE_FIXTURES = "true";
    process.env.ALCHEMY_API_KEY = "test-key";
  });

  it("returns fixture analysis for diamond wallet", async () => {
    const req = new NextRequest("http://localhost/api/wallet-dna/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.1" },
      body: JSON.stringify({ wallet: "0x1111111111111111111111111111111111111111" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.personality.name).toBeTruthy();
    expect(json.data.scores.collector.value).toBeGreaterThan(0);
  });

  it("rejects invalid wallet", async () => {
    const req = new NextRequest("http://localhost/api/wallet-dna/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.2" },
      body: JSON.stringify({ wallet: "!!!" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_WALLET");
  });
});
