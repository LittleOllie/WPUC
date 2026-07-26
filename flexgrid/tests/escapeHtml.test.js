/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { escapeHtml } from "../site/src/js/core/escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).not.toContain("<script>");
    expect(escapeHtml("Tom & Jerry")).toContain("&amp;");
  });

  it("handles nullish", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
