import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/analyse/route";
import { NextRequest } from "next/server";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimits } from "@/lib/security/rate-limit";

describe("POST /api/analyse", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRateLimits();
    process.env.ENABLE_MOCK_MODE = "true";
    process.env.ENABLE_LIVE_X_API = "false";
  });

  it("returns mock analysis for valid username", async () => {
    const req = new NextRequest("http://localhost/api/analyse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.50",
      },
      body: JSON.stringify({ input: "@demo_user" }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.target.username).toBe("demo_user");
    expect(json.data.candidates.length).toBeGreaterThan(0);
    expect(json.data.svgMarkup).toContain("<svg");
  });

  it("returns INVALID_USERNAME for bad input", async () => {
    const req = new NextRequest("http://localhost/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.51" },
      body: JSON.stringify({ input: "!!!" }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("INVALID_USERNAME");
  });
});
