import { describe, expect, it } from "vitest";
import { TutorialSystem } from "../engine/TutorialSystem";
import { TUTORIAL } from "../config/balance";

describe("TutorialSystem", () => {
  it("is inactive when disabled", () => {
    const t = new TutorialSystem(false);
    expect(t.isActive()).toBe(false);
  });

  it("advances when target corridor selected at step 2", () => {
    const t = new TutorialSystem(true);
    t.step = 2;
    expect(t.onCorridorSelected(TUTORIAL.targetCorridorId)).toBe(true);
    expect(t.step).toBe(3);
  });

  it("rejects wrong corridor at step 2", () => {
    const t = new TutorialSystem(true);
    t.step = 2;
    expect(t.onCorridorSelected("c-core-n")).toBe(false);
    expect(t.step).toBe(2);
  });

  it("blocks spread until door sealed", () => {
    const t = new TutorialSystem(true);
    t.step = 2;
    expect(t.shouldBlockSpread()).toBe(true);
    t.onDoorSealed(TUTORIAL.targetCorridorId);
    t.step = 4;
    expect(t.shouldBlockSpread()).toBe(false);
  });

  it("advances on serum deploy", () => {
    const t = new TutorialSystem(true);
    t.step = 5;
    t.onSerumDeployed(TUTORIAL.startRoomId);
    expect(t.step).toBe(6);
  });

  it("skip ends tutorial", () => {
    const t = new TutorialSystem(true);
    t.skip();
    expect(t.isActive()).toBe(false);
  });
});
