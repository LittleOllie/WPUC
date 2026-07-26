import { describe, it, expect } from "vitest";
import { normaliseUsername } from "@/lib/security/sanitise";

describe("normaliseUsername", () => {
  it("accepts plain username", () => {
    expect(normaliseUsername("jack")).toEqual({ ok: true, username: "jack" });
  });

  it("strips @ prefix", () => {
    expect(normaliseUsername("@jack")).toEqual({ ok: true, username: "jack" });
  });

  it("parses x.com URL", () => {
    expect(normaliseUsername("https://x.com/jack/")).toEqual({ ok: true, username: "jack" });
  });

  it("parses twitter.com URL with query", () => {
    expect(normaliseUsername("https://twitter.com/jack?ref=1")).toEqual({ ok: true, username: "jack" });
  });

  it("rejects blank", () => {
    expect(normaliseUsername("  ").ok).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(normaliseUsername("bad-user!").ok).toBe(false);
  });

  it("rejects arbitrary URLs", () => {
    expect(normaliseUsername("https://example.com/jack").ok).toBe(false);
  });
});
