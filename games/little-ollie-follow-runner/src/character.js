import { clamp, easeInOut, lerp } from "./utils.js";

export class Character {
  constructor() {
    this.action = "run";
    this.actionStart = 0;
    this.actionDur = 0;
    this.leanDir = 0; // -1 left, +1 right
  }

  trigger(action, t) {
    this.action = action;
    this.actionStart = t;

    switch (action) {
      case "jump":
        this.actionDur = 0.95;
        break;
      case "duck":
        this.actionDur = 1.0;
        break;
      case "left":
      case "right":
        this.actionDur = 0.9;
        break;
      case "punch":
        this.actionDur = 0.65;
        break;
      default:
        this.actionDur = 0.0;
        break;
    }
  }

  sample(t) {
    const runBob = Math.sin(t * 9.2) * 0.5;

    const local = this.actionDur > 0 ? clamp((t - this.actionStart) / this.actionDur, 0, 1) : 1;
    const e = easeInOut(local);

    let yLift = 0;
    let crouch = 0;
    let xShift = 0;
    let punch = 0;

    if (this.action === "jump") {
      const s = Math.sin(Math.PI * e);
      yLift = 1.0 * s;
      crouch = 0;
    } else if (this.action === "duck") {
      crouch = lerp(0, 1, e < 0.5 ? e * 2 : (1 - e) * 2);
      yLift = 0;
    } else if (this.action === "left") {
      xShift = -1 * lerp(0, 1, e);
    } else if (this.action === "right") {
      xShift = 1 * lerp(0, 1, e);
    } else if (this.action === "punch") {
      punch = lerp(0, 1, e < 0.4 ? e / 0.4 : (1 - e) / 0.6);
    }

    if (local >= 1 && this.action !== "run") {
      this.action = "run";
      this.actionDur = 0;
    }

    return {
      runBob,
      yLift,
      crouch,
      xShift,
      punch,
    };
  }
}

