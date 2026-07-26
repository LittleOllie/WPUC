import { describe, it, expect } from "vitest";
import { userMessageForError } from "../site/src/js/ui/notifications.js";

describe("userMessageForError", () => {
  it("maps rate limits", () => {
    const msg = userMessageForError(new Error("429 Too many requests"));
    expect(msg).toMatch(/request limit/i);
  });

  it("maps ApeChain timeouts", () => {
    const err = new Error("Request timed out");
    err.name = "AbortError";
    const msg = userMessageForError(err, "apechain load");
    expect(msg).toMatch(/ApeChain/i);
  });
});
