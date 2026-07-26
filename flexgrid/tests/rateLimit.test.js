import { describe, it, expect } from "vitest";
import { checkRateLimit, rateLimitResponse } from "../worker/rateLimit.js";

describe("worker rateLimit", () => {
  it("allows requests under the limit", () => {
    const env = { RATE_LIMIT_API_MAX: "3", RATE_LIMIT_WINDOW_MS: "60000" };
    const req = new Request("https://example.com/api/nfts", {
      headers: { "CF-Connecting-IP": "203.0.113.99" },
    });
    expect(checkRateLimit("api", req, env).limited).toBe(false);
    expect(checkRateLimit("api", req, env).limited).toBe(false);
    expect(checkRateLimit("api", req, env).limited).toBe(false);
    expect(checkRateLimit("api", req, env).limited).toBe(true);
  });

  it("returns 429 response with Retry-After", () => {
    const res = rateLimitResponse(12, { "Access-Control-Allow-Origin": "*" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
  });
});
