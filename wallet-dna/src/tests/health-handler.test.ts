import { describe, expect, it } from "vitest";
import { handleHealthRequest } from "@/lib/wallet-dna/api/health-handler";

describe("health handler", () => {
  it("returns ok when Alchemy is configured", () => {
    const req = new Request("https://example.com/health");
    const res = handleHealthRequest(req, {
      ALCHEMY_API_KEY_WALLET_DNA: "test-key",
      NODE_ENV: "production",
      DEPLOYMENT_VERSION: "1.0.0-test",
    });
    expect(res.status).toBe(200);
  });

  it("returns 503 when Alchemy is missing", async () => {
    const req = new Request("https://example.com/health");
    const res = handleHealthRequest(req, { NODE_ENV: "production" });
    expect(res.status).toBe(503);
    const json = (await res.json()) as {
      success: boolean;
      alchemyConfigured: boolean;
      status: string;
      requestId: string;
    };
    expect(json.success).toBe(false);
    expect(json.alchemyConfigured).toBe(false);
    expect(json.status).toBe("misconfigured");
    expect(json.requestId).toBeTruthy();
  });
});
