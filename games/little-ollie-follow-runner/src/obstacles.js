import { clamp, laneToIndex } from "./utils.js";

const OBSTACLE_COLORS = {
  toyBlocks: "#ffcf4d",
  lowBar: "#7ff0ff",
  foamTarget: "#7dff8b",
  puddle: "#5aa8ff",
  rainbowBar: "#b58cff",
  conesLeft: "#ff6a6a",
  conesRight: "#ff6a6a",
  crate: "#c58a52",
  lowSign: "#ffd34d",
  balloonTarget: "#ff6aa8",
  finishRamp: "#7b6cff",
};

export function obstacleColor(type) {
  return OBSTACLE_COLORS[type] || "#ffffff";
}

export function obstaclePrompt(action) {
  switch (action) {
    case "jump":
      return { text: "⬆️ JUMP!", sub: "Hop up!", color: "#ffb400" };
    case "duck":
      return { text: "⬇️ DUCK!", sub: "Get low!", color: "#22c7ff" };
    case "left":
      return { text: "⬅️ LEFT!", sub: "Lean left!", color: "#ff4d4d" };
    case "right":
      return { text: "➡️ RIGHT!", sub: "Lean right!", color: "#ff4d4d" };
    case "punch":
      return { text: "👊 PUNCH!", sub: "Strong punch!", color: "#25e070" };
    default:
      return { text: "GO!", sub: "", color: "#ffffff" };
  }
}

export class Obstacle {
  constructor({ id, type, action, lane, spawnTime, impactTime, travelTime = 1.5 }) {
    this.id = id;
    this.type = type;
    this.action = action;
    this.lane = lane || "center";
    this.laneIndex = laneToIndex(this.lane);
    this.spawnTime = spawnTime;
    this.impactTime = impactTime;
    this.travelTime = travelTime;
    this.whooshed = false;
    this.impactPlayed = false;
  }

  progress(t) {
    return clamp((t - this.spawnTime) / this.travelTime, 0, 1);
  }

  get aliveUntil() {
    return this.impactTime + 0.35;
  }
}

