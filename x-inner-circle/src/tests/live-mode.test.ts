import { describe, it, expect, beforeEach } from "vitest";
import { GET as healthGet } from "@/app/api/health/route";
import { POST } from "@/app/api/analyse/route";
import { NextRequest } from "next/server";
import { resetEnvCache } from "@/lib/env";
import { resetRateLimits } from "@/lib/security/rate-limit";

describe("live mode configuration", () => {
  beforeEach(() => {
    resetEnvCache();
    resetRateLimits();
  });

  it("health reports liveConfigured=false when token missing", async () => {
    process.env.ENABLE_MOCK_MODE = "false";
    process.env.ENABLE_LIVE_X_API = "true";
    process.env.X_BEARER_TOKEN = "";

    const res = await healthGet();
    const json = await res.json();
    expect(json.mode).toBe("live");
    expect(json.liveConfigured).toBe(false);
    expect(json.deployment).toBe("server-live");
  });

  it("analyse returns X_AUTH_ERROR when live mode lacks token", async () => {
    process.env.ENABLE_MOCK_MODE = "false";
    process.env.ENABLE_LIVE_X_API = "true";
    process.env.X_BEARER_TOKEN = "";

    const req = new NextRequest("http://localhost/api/analyse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.99",
      },
      body: JSON.stringify({ input: "@someone" }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("X_AUTH_ERROR");
  });
});
