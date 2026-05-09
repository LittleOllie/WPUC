import { clamp, lerp } from "./utils.js";
import { obstacleColor } from "./obstacles.js";
import { ASSETS } from "./assets.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rand() {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function laneOffsetNormFromLaneIndex(idx) {
  // Centered lanes on path. Keep small so obstacles stay on the path.
  return idx * 0.22;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.dpr = 1;
    this.w = 0;
    this.h = 0;

    this._t = 0;
    this._seed = 1337;
    this._env = null;
  }

  resize() {
    const dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(2, Math.round(rect.width * dpr));
    const h = Math.max(2, Math.round(rect.height * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    this.dpr = dpr;
    this.w = w;
    this.h = h;
  }

  render({ t, speed, worldSpeed, reducedMotion, characterSample, obstacles }) {
    this._t = t;
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    // Bright kid-friendly sky.
    const skyTop = "#7ad7ff";
    const skyBottom = "#d7f7ff";
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(0.7, skyBottom);
    grad.addColorStop(1, "#ffffff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const vanishingX = w * 0.5;
    const vanishingY = h * 0.32;
    const bottomY = h * 0.98;

    if (!this._env || this._env.w !== w || this._env.h !== h) {
      this._buildEnvironment();
    }

    // Static far background (no side-scrolling).
    this._drawFarBackground(ctx, { w, h, vanishingX, vanishingY });

    const bob = reducedMotion ? 0 : Math.sin(t * 7.0) * (h * 0.0042);
    const camTilt = reducedMotion ? 0 : Math.sin(t * 2.6) * 0.012;

    // Unified world depth scroll in [0,1).
    const scrollDepth = (t * (worldSpeed || 0.666)) % 1;

    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(camTilt);

    // Draw grass sides and the cartoon path.
    this._drawGroundAndPath(ctx, { w, h, vanishingX, vanishingY, bottomY });

    // Road/path markings (unified depth projection).
    this._drawPathMarkings(ctx, { vanishingX, vanishingY, h, scrollDepth });

    // Fence posts (unified depth projection).
    this._drawFences(ctx, { vanishingX, vanishingY, scrollDepth });

    // Near/mid scenery objects (trees, bushes, playground).
    this._drawSceneryWorld(ctx, { vanishingX, vanishingY, scrollDepth });

    // Obstacles (sorted far -> near).
    const sorted = [...obstacles].sort((a, b) => a.progress(t) - b.progress(t));
    for (const o of sorted) {
      this._drawObstacleUnified(ctx, { o, t, vanishingX, vanishingY });
    }

    // Character placeholder (cute Ollie vibe).
    this._drawCharacter(ctx, { t, centerX: vanishingX, bottomY, characterSample, reducedMotion });

    // Speed lines + tiny sparkles for energy (visual only).
    if (!reducedMotion) {
      this._drawSpeedLines(ctx, { w, h, vanishingX, vanishingY, scrollDepth });
      this._drawSparkles(ctx, { w, h, scrollDepth });
    }

    ctx.restore();
  }

  _buildEnvironment() {
    const w = this.w;
    const h = this.h;
    const r = mulberry32(this._seed);

    const pick = (arr) => arr[(r() * arr.length) | 0];
    const range = (a, b) => lerp(a, b, r());

    // Create baseDepth items in [0,1); each frame we add scrollDepth and wrap.
    const mkItems = (count, typePool, side) => {
      const out = [];
      for (let i = 0; i < count; i++) {
        out.push({
          baseDepth: r(),
          type: pick(typePool),
          side,
          offset: range(0.32, 0.52) * (side === "left" ? -1 : 1), // normalized sideways
          jitter: range(-0.04, 0.04),
          size: range(0.85, 1.2),
        });
      }
      return out;
    };

    this._env = {
      w,
      h,
      // Path markings and fence posts density.
      markings: Array.from({ length: 28 }, () => ({ baseDepth: r(), lane: pick([-0.08, 0, 0.08]) })),
      fencePosts: Array.from({ length: 22 }, () => ({ baseDepth: r(), side: "left" })).concat(
        Array.from({ length: 22 }, () => ({ baseDepth: r(), side: "right" }))
      ),
      sceneryNear: mkItems(22, ["bush", "flower", "cone", "sign"], "left").concat(
        mkItems(22, ["bush", "flower", "cone", "sign"], "right")
      ),
      sceneryMid: mkItems(14, ["tree", "tree", "balloon", "slide", "swing"], "left").concat(
        mkItems(14, ["tree", "tree", "balloon", "slide", "swing"], "right")
      ),
    };
  }

  _project({ depth, vanishingX, vanishingY, offsetXNorm = 0, yScale = 0.9 }) {
    const w = this.w;
    const h = this.h;
    const d = clamp(depth, 0, 1);
    const yy = vanishingY + d * d * h * yScale;
    const xx = vanishingX + offsetXNorm * d * w;
    const scale = 0.2 + d * 1.8;
    const alpha = clamp(0.15 + d * 1.1, 0, 1);
    return { x: xx, y: yy, scale, alpha, depth: d };
  }

  _pathHalfWidthAtDepth(depth) {
    const w = this.w;
    const d = clamp(depth, 0, 1);
    // Trapezoid path: narrower at horizon, wide at bottom.
    const top = w * 0.12;
    const bot = w * 0.42;
    return lerp(top, bot, d * d);
  }

  _drawFarBackground(ctx, { w, h, vanishingX, vanishingY }) {
    // Clouds drift slowly (safe).
    const t = this._t;
    const drift = (t * 10) % (w + 220);

    // Distant hills.
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#7dff86";
    ctx.beginPath();
    ctx.moveTo(0, vanishingY + h * 0.06);
    ctx.bezierCurveTo(w * 0.2, vanishingY + h * 0.01, w * 0.35, vanishingY + h * 0.12, w * 0.55, vanishingY + h * 0.05);
    ctx.bezierCurveTo(w * 0.75, vanishingY - h * 0.02, w * 0.85, vanishingY + h * 0.1, w, vanishingY + h * 0.05);
    ctx.lineTo(w, vanishingY + h * 0.18);
    ctx.lineTo(0, vanishingY + h * 0.18);
    ctx.closePath();
    ctx.fill();

    // Soft sun.
    const sunR = h * 0.09;
    const sunX = vanishingX * 0.98;
    const sunY = vanishingY - h * 0.1;
    const g = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 1.25);
    g.addColorStop(0, "rgba(255, 238, 170, 0.95)");
    g.addColorStop(1, "rgba(255, 180, 80, 0.0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Clouds (very slow, not breaking POV).
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 260 + drift) % (w + 300)) - 150;
      const cy = vanishingY - h * 0.18 + i * 20;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 46, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + 40, cy + 6, 38, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - 40, cy + 8, 34, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawGroundAndPath(ctx, { w, h, vanishingX, vanishingY, bottomY }) {
    // Grass sides.
    ctx.save();
    ctx.fillStyle = "#7dff86";
    ctx.fillRect(0, vanishingY, w, h - vanishingY);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 120; i++) {
      const x = ((i * 97) % w) + 3;
      const y = vanishingY + ((i * 173) % (h - vanishingY));
      ctx.beginPath();
      ctx.arc(x, y, 2.2 * this.dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Path trapezoid.
    const halfTop = this._pathHalfWidthAtDepth(0);
    const halfBot = this._pathHalfWidthAtDepth(1);
    ctx.fillStyle = "#f2c27a"; // warm tan track
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 5 * this.dpr;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(vanishingX - halfTop, vanishingY);
    ctx.lineTo(vanishingX + halfTop, vanishingY);
    ctx.lineTo(vanishingX + halfBot, bottomY);
    ctx.lineTo(vanishingX - halfBot, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Path edge color bands.
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(123, 108, 255, 0.6)";
    ctx.lineWidth = 6 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(vanishingX - halfTop, vanishingY);
    ctx.lineTo(vanishingX - halfBot, bottomY);
    ctx.moveTo(vanishingX + halfTop, vanishingY);
    ctx.lineTo(vanishingX + halfBot, bottomY);
    ctx.stroke();
    ctx.restore();
  }

  _drawPathMarkings(ctx, { vanishingX, vanishingY, h, scrollDepth }) {
    const env = this._env;
    if (!env) return;
    ctx.save();
    for (const m of env.markings) {
      const depth = (m.baseDepth + scrollDepth) % 1;
      const p = this._project({ depth, vanishingX, vanishingY, offsetXNorm: m.lane });
      const half = this._pathHalfWidthAtDepth(depth);
      const markW = Math.max(4, half * 0.12 * p.scale);
      const markH = Math.max(10, (h * 0.015) * p.scale);
      ctx.globalAlpha = 0.18 + 0.25 * depth;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      this._roundRectPath(ctx, p.x - markW * 0.5, p.y - markH * 0.5, markW, markH, Math.min(18, markW * 0.4));
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawFences(ctx, { vanishingX, vanishingY, scrollDepth }) {
    const env = this._env;
    if (!env) return;
    ctx.save();
    for (const fp of env.fencePosts) {
      const depth = (fp.baseDepth + scrollDepth) % 1;
      const half = this._pathHalfWidthAtDepth(depth);
      const side = fp.side === "left" ? -1 : 1;
      const offsetXNorm = side * (0.28 + (half / this.w) * 0.65);
      const p = this._project({ depth, vanishingX, vanishingY, offsetXNorm });
      const s = p.scale * 0.6;
      ctx.globalAlpha = clamp(0.2 + depth * 0.9, 0, 1);
      ctx.fillStyle = "#ffd34d";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 4 * this.dpr;
      ctx.beginPath();
      this._roundRectPath(ctx, p.x - 6 * s, p.y - 38 * s, 12 * s, 46 * s, 6 * s);
      ctx.fill();
      ctx.stroke();
      // Cap
      ctx.beginPath();
      ctx.arc(p.x, p.y - 38 * s, 8 * s, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSceneryWorld(ctx, { vanishingX, vanishingY, scrollDepth }) {
    const env = this._env;
    if (!env) return;

    const drawOne = (it, layerMul) => {
      const depth = (it.baseDepth + scrollDepth * layerMul) % 1;
      const p = this._project({ depth, vanishingX, vanishingY, offsetXNorm: it.offset + it.jitter });
      const s = p.scale * it.size * (it.type === "tree" ? 0.55 : 0.5);
      const outline = "rgba(0,0,0,0.35)";

      ctx.globalAlpha = p.alpha * (it.type === "balloon" ? 0.9 : 1);
      ctx.lineWidth = 4 * this.dpr;
      ctx.strokeStyle = outline;

      if (it.type === "tree") {
        this._drawTree(ctx, p.x, p.y, s);
      } else if (it.type === "bush") {
        this._drawBush(ctx, p.x, p.y, s);
      } else if (it.type === "flower") {
        this._drawFlower(ctx, p.x, p.y, s);
      } else if (it.type === "slide") {
        this._drawSlide(ctx, p.x, p.y, s);
      } else if (it.type === "swing") {
        this._drawSwing(ctx, p.x, p.y, s);
      } else if (it.type === "balloon") {
        this._drawBalloon(ctx, p.x, p.y, s);
      } else if (it.type === "cone") {
        this._drawCone(ctx, p.x, p.y, s);
      } else if (it.type === "sign") {
        this._drawSign(ctx, p.x, p.y, s);
      }
    };

    ctx.save();
    // Mid first (behind).
    for (const it of env.sceneryMid) drawOne(it, 1.0);
    // Near in front.
    for (const it of env.sceneryNear) drawOne(it, 1.08);
    ctx.restore();
  }

  _drawTree(ctx, x, y, s) {
    if (ASSETS.tree) return; // future
    ctx.save();
    ctx.translate(x, y);
    // trunk
    ctx.fillStyle = "#c58a52";
    ctx.beginPath();
    this._roundRectPath(ctx, -10 * s, 14 * s, 20 * s, 34 * s, 10 * s);
    ctx.fill();
    ctx.stroke();
    // canopy
    ctx.fillStyle = "#2fcf63";
    ctx.beginPath();
    ctx.arc(-22 * s, 18 * s, 22 * s, 0, Math.PI * 2);
    ctx.arc(0, 6 * s, 28 * s, 0, Math.PI * 2);
    ctx.arc(24 * s, 18 * s, 22 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawBush(ctx, x, y, s) {
    if (ASSETS.bush) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#39d66f";
    ctx.beginPath();
    ctx.arc(-18 * s, 10 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(0, 0, 22 * s, 0, Math.PI * 2);
    ctx.arc(22 * s, 10 * s, 18 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawFlower(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4 * this.dpr;
    ctx.fillStyle = "#2fcf63";
    ctx.beginPath();
    ctx.moveTo(0, 18 * s);
    ctx.lineTo(0, -8 * s);
    ctx.stroke();
    const cols = ["#ff4d4d", "#ffd34d", "#7ff0ff"];
    const col = cols[((x + y) | 0) % cols.length];
    ctx.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 10 * s, -10 * s + Math.sin(a) * 7 * s, 7 * s, 5 * s, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, -10 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawSlide(ctx, x, y, s) {
    if (ASSETS.slide) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#7b6cff";
    ctx.beginPath();
    ctx.moveTo(-14 * s, -8 * s);
    ctx.lineTo(40 * s, 12 * s);
    ctx.lineTo(34 * s, 30 * s);
    ctx.lineTo(-18 * s, 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    this._roundRectPath(ctx, -36 * s, -6 * s, 12 * s, 44 * s, 6 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawSwing(ctx, x, y, s) {
    if (ASSETS.swing) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(-34 * s, 30 * s);
    ctx.lineTo(-12 * s, -18 * s);
    ctx.lineTo(12 * s, -18 * s);
    ctx.lineTo(34 * s, 30 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20 * s, 2 * s);
    ctx.lineTo(20 * s, 2 * s);
    ctx.stroke();
    // ropes
    ctx.globalAlpha *= 0.8;
    ctx.beginPath();
    ctx.moveTo(-6 * s, 2 * s);
    ctx.lineTo(-10 * s, 20 * s);
    ctx.moveTo(6 * s, 2 * s);
    ctx.lineTo(10 * s, 20 * s);
    ctx.stroke();
    // seat
    ctx.globalAlpha /= 0.8;
    ctx.fillStyle = "#ff6aa8";
    ctx.beginPath();
    this._roundRectPath(ctx, -16 * s, 18 * s, 32 * s, 12 * s, 6 * s);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawBalloon(ctx, x, y, s) {
    if (ASSETS.balloon) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ff6aa8";
    ctx.beginPath();
    ctx.ellipse(0, -8 * s, 18 * s, 24 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.moveTo(0, 16 * s);
    ctx.lineTo(0, 40 * s);
    ctx.stroke();
    ctx.restore();
  }

  _drawCone(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ffb400";
    ctx.beginPath();
    ctx.moveTo(0, -22 * s);
    ctx.lineTo(18 * s, 22 * s);
    ctx.lineTo(-18 * s, 22 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawSign(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ffd34d";
    ctx.beginPath();
    this._roundRectPath(ctx, -22 * s, -22 * s, 44 * s, 28 * s, 10 * s);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.moveTo(0, 6 * s);
    ctx.lineTo(0, 40 * s);
    ctx.stroke();
    ctx.restore();
  }

  _drawSpeedLines(ctx, { w, h, vanishingX, vanishingY, scrollDepth }) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 3 * this.dpr;
    for (let i = 0; i < 10; i++) {
      const d = (i / 10 + scrollDepth) % 1;
      const y = vanishingY + d * d * h * 0.95;
      const xL = vanishingX - (0.38 * d) * w;
      const xR = vanishingX + (0.38 * d) * w;
      ctx.beginPath();
      ctx.moveTo(xL, y);
      ctx.lineTo(xL - 18 * d * this.dpr, y + 26 * d * this.dpr);
      ctx.moveTo(xR, y);
      ctx.lineTo(xR + 18 * d * this.dpr, y + 26 * d * this.dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawSparkles(ctx, { w, h, scrollDepth }) {
    const r = mulberry32(9001);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (let i = 0; i < 18; i++) {
      const d = (r() + scrollDepth) % 1;
      const x = r() * w;
      const y = (0.32 * h) + d * d * h * 0.9;
      const s = (2 + 6 * d) * this.dpr;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawObstacleUnified(ctx, { o, t, vanishingX, vanishingY }) {
    const p = o.progress(t);
    if (p <= 0) return;
    if (p >= 1.08) return;
    const depth = clamp(p, 0, 1);
    const offsetXNorm = laneOffsetNormFromLaneIndex(o.laneIndex);
    const proj = this._project({ depth, vanishingX, vanishingY, offsetXNorm });
    const s = proj.scale * 0.55;
    const alpha = proj.alpha;

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.globalAlpha = alpha;
    ctx.scale(s, s);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";

    // Simple colourful obstacle drawings (asset-swappable later).
    const type = o.type;
    const color = obstacleColor(type);

    if (type === "toyBlocks") {
      ctx.fillStyle = color;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        this._roundRectPath(ctx, -44 + i * 32, -18 - (i % 2) * 6, 30, 30, 8);
        ctx.fill();
        ctx.stroke();
      }
    } else if (type === "lowBar" || type === "rainbowBar") {
      ctx.fillStyle = color;
      ctx.beginPath();
      this._roundRectPath(ctx, -54, -10, 108, 20, 10);
      ctx.fill();
      ctx.stroke();
      if (type === "rainbowBar") {
        const cols = ["#ff4d4d", "#ffb400", "#7dff86", "#7ff0ff", "#7b6cff"];
        ctx.globalAlpha *= 0.85;
        for (let i = 0; i < cols.length; i++) {
          ctx.fillStyle = cols[i];
          ctx.beginPath();
          this._roundRectPath(ctx, -52 + i * 20, -8, 18, 16, 8);
          ctx.fill();
        }
      }
    } else if (type === "foamTarget") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -6, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(0, -6, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (type === "puddle") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 10, 48, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.ellipse(-16, 6, 16, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === "conesLeft" || type === "conesRight") {
      ctx.fillStyle = color;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(-20 + i * 40, -24);
        ctx.lineTo(-8 + i * 40, 20);
        ctx.lineTo(-32 + i * 40, 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        this._roundRectPath(ctx, -30 + i * 40, -2, 20, 6, 3);
        ctx.fill();
        ctx.fillStyle = color;
      }
    } else if (type === "crate") {
      ctx.fillStyle = color;
      ctx.beginPath();
      this._roundRectPath(ctx, -28, -22, 56, 56, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-24, -10);
      ctx.lineTo(24, 22);
      ctx.moveTo(24, -10);
      ctx.lineTo(-24, 22);
      ctx.stroke();
    } else if (type === "lowSign") {
      ctx.fillStyle = color;
      ctx.beginPath();
      this._roundRectPath(ctx, -46, -18, 92, 32, 14);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 14);
      ctx.lineTo(-10, 40);
      ctx.moveTo(10, 14);
      ctx.lineTo(10, 40);
      ctx.stroke();
    } else if (type === "balloonTarget") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, -10, 20, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(0, 46);
      ctx.stroke();
    } else if (type === "finishRamp") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-54, 18);
      ctx.lineTo(54, 18);
      ctx.lineTo(32, -18);
      ctx.lineTo(-32, -18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      this._roundRectPath(ctx, -18, -6, 36, 10, 5);
      ctx.fill();
    }

    ctx.restore();
  }

  _drawDashedPerspectiveLine(ctx, x1, y1, x2, y2, t, speed, dash = 14, gap = 26) {
    const total = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / total;
    const dy = (y2 - y1) / total;

    const flow = (t * 160 * speed) % (dash + gap);
    let dist = -flow;

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = Math.max(1, this.dpr * 1);
    ctx.lineCap = "round";

    while (dist < total) {
      const a = clamp(dist / total, 0, 1);
      const b = clamp((dist + dash) / total, 0, 1);
      const ax = lerp(x1, x2, a);
      const ay = lerp(y1, y2, a);
      const bx = lerp(x1, x2, b);
      const by = lerp(y1, y2, b);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      dist += dash + gap;
    }
  }

  _drawObstacle(ctx, { o, t, centerX, horizonY, bottomY, roadTopW, roadBottomW }) {
    const p = o.progress(t);
    if (p <= 0) return;
    if (p >= 1.08) return;

    const depth = Math.pow(p, 1.8);
    const y = lerp(horizonY + 10, bottomY - 26, depth);
    const scale = lerp(0.22, 1.35, Math.pow(p, 2.2));

    const roadWAtY = lerp(roadTopW, roadBottomW, depth);
    const laneOffset = (roadWAtY * 0.26) * (0.4 + 0.6 * p);
    const x = centerX + laneOffset * o.laneIndex;

    const color = obstacleColor(o.type);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    // Shadow blob.
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 18, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";

    if (o.type === "log") {
      // Tree log to jump (ground obstacle).
      ctx.fillStyle = "#c58a52";
      ctx.beginPath();
      this._roundRectPath(ctx, -48, -12, 96, 24, 12);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2.2;
      for (let k = -32; k <= 32; k += 16) {
        ctx.beginPath();
        ctx.moveTo(k, -10);
        ctx.lineTo(k, 10);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      this._badge(ctx, "LOG");
    } else if (o.type === "mine") {
      // Hanging mine to duck under.
      ctx.fillStyle = "#77e6ff";
      ctx.beginPath();
      ctx.arc(0, -8, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 22, -8 + Math.sin(ang) * 22);
        ctx.lineTo(Math.cos(ang) * 30, -8 + Math.sin(ang) * 30);
        ctx.stroke();
      }
      // Chain
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -8 - 24);
      ctx.lineTo(0, -8 - 52);
      ctx.stroke();
      ctx.globalAlpha = 1;
      this._badge(ctx, "MINE", 0, -58);
    } else if (o.type === "brick") {
      // Small brick wall to dodge (lane-based).
      ctx.fillStyle = "#ff6a6a";
      ctx.beginPath();
      this._roundRectPath(ctx, -26, -34, 52, 68, 10);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2.2;
      for (let yy = -20; yy <= 20; yy += 14) {
        ctx.beginPath();
        ctx.moveTo(-24, yy);
        ctx.lineTo(24, yy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      this._badge(ctx, o.lane === "left" ? "← BRICK" : "BRICK →", 0, -54);
    } else if (o.type === "apple") {
      // Punchable apple.
      ctx.fillStyle = "#7dff8b";
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Leaf + stem
      ctx.fillStyle = "#2f9d41";
      ctx.beginPath();
      ctx.ellipse(10, -18, 10, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(2, -18);
      ctx.lineTo(0, -30);
      ctx.stroke();
      this._badge(ctx, "APPLE", 0, -44);
    }

    ctx.restore();
  }

  _badge(ctx, label, x = 0, y = 30) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    this._roundRectPath(ctx, -26, -10, 52, 20, 10);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = "900 12px Fredoka, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 1);
    ctx.restore();
  }

  _drawCharacter(ctx, { t, centerX, bottomY, characterSample, reducedMotion }) {
    const { runBob, yLift, crouch, xShift, punch } = characterSample;
    const baseScale = this.h * 0.0019;

    const x = centerX + xShift * (this.w * 0.06);
    const y = bottomY - (reducedMotion ? 0 : runBob * 10) - yLift * (this.h * 0.12);

    const bodyH = 120 * baseScale;
    const bodyW = 56 * baseScale;
    const headR = 26 * baseScale;

    const crouchAmt = crouch * 0.55;
    const bodySquashY = 1 - crouchAmt * 0.35;
    const bodySquashX = 1 + crouchAmt * 0.25;

    ctx.save();
    ctx.translate(x, y);

    // Soft glow outline to keep character readable.
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#9ab2ff";
    ctx.beginPath();
    ctx.ellipse(0, 64 * baseScale, 64 * baseScale, 30 * baseScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body.
    ctx.save();
    ctx.scale(bodySquashX, bodySquashY);
    ctx.fillStyle = "#f6f7ff";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4 * baseScale;
    ctx.beginPath();
    this._roundRectPath(ctx, -bodyW * 0.5, -bodyH * 0.5, bodyW, bodyH, 16 * baseScale);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Head.
    const headY = -bodyH * 0.62 + crouchAmt * (28 * baseScale);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 4 * baseScale;
    ctx.beginPath();
    ctx.arc(0, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Eyes.
    ctx.fillStyle = "rgba(10,12,20,0.9)";
    ctx.beginPath();
    ctx.arc(-8 * baseScale, headY - 4 * baseScale, 3.5 * baseScale, 0, Math.PI * 2);
    ctx.arc(8 * baseScale, headY - 4 * baseScale, 3.5 * baseScale, 0, Math.PI * 2);
    ctx.fill();

    // Arm punch.
    const armY = -bodyH * 0.18 + crouchAmt * (14 * baseScale);
    const armReach = punch * (46 * baseScale);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 10 * baseScale;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(18 * baseScale, armY);
    ctx.lineTo(18 * baseScale + armReach, armY - punch * (10 * baseScale));
    ctx.stroke();

    // Hand.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(18 * baseScale + armReach, armY - punch * (10 * baseScale), 8 * baseScale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _drawVignette(ctx, w, h) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, h * 0.15, w * 0.5, h * 0.55, h * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  _roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
    if (rr === 0) {
      ctx.rect(x, y, w, h);
      return;
    }
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}

