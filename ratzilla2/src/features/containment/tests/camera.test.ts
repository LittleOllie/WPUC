import { describe, expect, it } from "vitest";
import { CameraController } from "../rendering/CameraController";

describe("CameraController", () => {
  it("treats small movement as a tap", () => {
    const cam = new CameraController();
    cam.beginPointer(100, 100);
    cam.movePointer(104, 102);
    expect(cam.isDragging()).toBe(false);
    expect(cam.endPointer()).toBe(true);
  });

  it("treats large movement as a pan, not a tap", () => {
    const cam = new CameraController();
    cam.beginPointer(100, 100);
    cam.movePointer(120, 100);
    expect(cam.isDragging()).toBe(true);
    expect(cam.endPointer()).toBe(false);
  });
});
