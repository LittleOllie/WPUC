import { describe, it, expect, beforeEach } from "vitest";
import { upgradeTwitterProfileImageUrl, getDeploymentMode } from "@/lib/deployment";
import { resetEnvCache } from "@/lib/env";

describe("deployment helpers", () => {
  beforeEach(() => {
    resetEnvCache();
    delete process.env.NEXT_PUBLIC_USE_CLIENT_MOCK;
    delete process.env.ENABLE_LIVE_X_API;
    delete process.env.ENABLE_MOCK_MODE;
  });

  it("upgrades Twitter _normal avatars", () => {
    expect(
      upgradeTwitterProfileImageUrl(
        "https://pbs.twimg.com/profile_images/1/abc_normal.jpg",
      ),
    ).toBe("https://pbs.twimg.com/profile_images/1/abc_400x400.jpg");
  });

  it("detects static mock deployment mode", () => {
    process.env.NEXT_PUBLIC_USE_CLIENT_MOCK = "true";
    expect(getDeploymentMode()).toBe("static-mock");
  });

  it("detects server live deployment mode", () => {
    process.env.ENABLE_MOCK_MODE = "false";
    process.env.ENABLE_LIVE_X_API = "true";
    expect(getDeploymentMode()).toBe("server-live");
  });
});
