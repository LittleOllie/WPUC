const CONFIG = {
  // Core motion
  speedPxPerSec: 140, // adjust this (kid-friendly pace)

  // Layout
  stripWidthPct: 0.225, // 20–25% each side

  // Procedural content
  density: 1.0, // overall multiplier
  minSpacingPx: 86,

  // Depth effect
  layers: [
    { name: "bg", speedMul: 0.55, scaleNear: 1.02, scaleFar: 0.78, alpha: 0.95 },
    { name: "mid", speedMul: 0.82, scaleNear: 1.06, scaleFar: 0.82, alpha: 1.0 },
    { name: "fg", speedMul: 1.0, scaleNear: 1.12, scaleFar: 0.86, alpha: 1.0 },
  ],

  // Colors (bright, cartoon)
  palette: {
    skyTop: "#7ad7ff",
    skyBottom: "#c9f3ff",
    grassLight: "#7dff86",
    grassDark: "#38d86a",
    dirt: "#f3c27a",
    outline: "rgba(0,0,0,0.35)",
    fence: "#ffd34d",
    swing: "#ff6aa8",
    slide: "#7b6cff",
    flower1: "#ff4d4d",
    flower2: "#ffd34d",
    flower3: "#7ff0ff",
    bush: "#39d66f",
    tree: "#2fcf63",
    treeTrunk: "#c58a52",
  },
};

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });

let dpr = 1;
let W = 0;
let H = 0;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resize() {
  dpr = Math.max(1, Math.min(2.25, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  W = Math.max(2, Math.round(rect.width * dpr));
  H = Math.max(2, Math.round(rect.height * dpr));
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
    buildWorld();
  }
}

// ---- Shapes (modular, reusable) ----
function roundRectPath(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  if (rr === 0) {
    c.rect(x, y, w, h);
    return;
  }
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

function drawGrassPatch(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.fillStyle = pal.grassLight;
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 0, 22 * s, 12 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawFlower(c, pal, x, y, s, variant = 0) {
  const col = variant === 0 ? pal.flower1 : variant === 1 ? pal.flower2 : pal.flower3;
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.fillStyle = "#2fcf63";
  c.beginPath();
  c.moveTo(0, 10 * s);
  c.lineTo(0, -8 * s);
  c.stroke();
  c.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    c.beginPath();
    c.ellipse(Math.cos(a) * 7 * s, -10 * s + Math.sin(a) * 5 * s, 5 * s, 4 * s, a, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
  c.fillStyle = "#ffd34d";
  c.beginPath();
  c.arc(0, -10 * s, 4.2 * s, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawBush(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.fillStyle = pal.bush;
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(-12 * s, 0, 12 * s, 0, Math.PI * 2);
  c.arc(0, -6 * s, 16 * s, 0, Math.PI * 2);
  c.arc(14 * s, 0, 12 * s, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawTree(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  // trunk
  c.fillStyle = pal.treeTrunk;
  c.beginPath();
  roundRectPath(c, -6 * s, 8 * s, 12 * s, 26 * s, 6 * s);
  c.fill();
  c.stroke();
  // canopy
  c.fillStyle = pal.tree;
  c.beginPath();
  c.arc(-14 * s, 10 * s, 16 * s, 0, Math.PI * 2);
  c.arc(0, 0, 20 * s, 0, Math.PI * 2);
  c.arc(16 * s, 10 * s, 16 * s, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawFencePost(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.fillStyle = pal.fence;
  c.beginPath();
  roundRectPath(c, -6 * s, -18 * s, 12 * s, 36 * s, 5 * s);
  c.fill();
  c.stroke();
  c.restore();
}

function drawFenceRail(c, pal, x, y, w, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.fillStyle = pal.fence;
  c.beginPath();
  roundRectPath(c, -w * 0.5, -4 * s, w, 8 * s, 4 * s);
  c.fill();
  c.stroke();
  c.restore();
}

function drawSlide(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  // ladder
  c.fillStyle = "#ffffff";
  c.beginPath();
  roundRectPath(c, -22 * s, -8 * s, 10 * s, 34 * s, 5 * s);
  c.fill();
  c.stroke();
  // slide ramp
  c.fillStyle = pal.slide;
  c.beginPath();
  c.moveTo(-10 * s, -8 * s);
  c.lineTo(30 * s, 12 * s);
  c.lineTo(26 * s, 24 * s);
  c.lineTo(-12 * s, 4 * s);
  c.closePath();
  c.fill();
  c.stroke();
  // base
  c.fillStyle = pal.dirt;
  c.beginPath();
  c.ellipse(22 * s, 26 * s, 20 * s, 8 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  c.restore();
}

function drawSwing(c, pal, x, y, s) {
  c.save();
  c.translate(x, y);
  c.strokeStyle = pal.outline;
  c.lineWidth = 3;
  c.fillStyle = "#ffffff";
  // frame
  c.beginPath();
  c.moveTo(-28 * s, 26 * s);
  c.lineTo(-10 * s, -20 * s);
  c.lineTo(10 * s, -20 * s);
  c.lineTo(28 * s, 26 * s);
  c.stroke();
  c.beginPath();
  c.moveTo(-18 * s, 2 * s);
  c.lineTo(18 * s, 2 * s);
  c.stroke();
  // ropes
  c.strokeStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.moveTo(-6 * s, 2 * s);
  c.lineTo(-10 * s, 18 * s);
  c.moveTo(6 * s, 2 * s);
  c.lineTo(10 * s, 18 * s);
  c.stroke();
  // seat
  c.fillStyle = pal.swing;
  c.strokeStyle = pal.outline;
  c.beginPath();
  roundRectPath(c, -14 * s, 16 * s, 28 * s, 10 * s, 5 * s);
  c.fill();
  c.stroke();
  c.restore();
}

// ---- Procedural strip content ----
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

function pick(r, arr) {
  return arr[(r() * arr.length) | 0];
}

function buildStripLayer({ seed, stripW, stripH, side, density, minSpacing }) {
  const r = mulberry32(seed);
  const items = [];

  // keep objects away from the road edge a bit
  const innerPad = stripW * 0.12;
  const outerPad = stripW * 0.08;

  let y = 0;
  const targetCount = Math.max(10, Math.round((stripH / minSpacing) * density));
  for (let i = 0; i < targetCount; i++) {
    const spacing = lerp(minSpacing * 0.75, minSpacing * 1.25, r());
    y += spacing;
    if (y >= stripH) y -= stripH;

    const kind = pick(r, ["tree", "bush", "fence", "flowers", "grass", "play"]);

    const xRangeMin = innerPad;
    const xRangeMax = stripW - outerPad;
    const x = lerp(xRangeMin, xRangeMax, r());

    const s = lerp(0.85, 1.15, r());

    const item = { kind, x, y, s, side };
    if (kind === "flowers") item.variant = (r() * 3) | 0;
    if (kind === "play") item.play = pick(r, ["slide", "swing"]);
    items.push(item);
  }

  // Add a repeating fence rhythm along the road edge (modular rails + posts).
  const fence = [];
  const postEvery = 140 / clamp(density, 0.6, 1.6);
  for (let yy = 0; yy < stripH; yy += postEvery) {
    fence.push({ kind: "fencePost", x: innerPad * 0.72, y: yy, s: 1.0 });
  }
  return { items, fence };
}

function drawItem(c, pal, item, scale) {
  const x = item.x;
  const y = item.y;
  const s = (item.s ?? 1) * scale;

  switch (item.kind) {
    case "tree":
      drawTree(c, pal, x, y, 1.05 * s);
      break;
    case "bush":
      drawBush(c, pal, x, y, 1.1 * s);
      break;
    case "grass":
      drawGrassPatch(c, pal, x, y, 1.0 * s);
      break;
    case "flowers":
      drawFlower(c, pal, x, y, 1.0 * s, item.variant ?? 0);
      break;
    case "fence":
      drawFenceRail(c, pal, x, y, 64 * s, 1.0);
      break;
    case "play":
      if (item.play === "swing") drawSwing(c, pal, x, y, 0.9 * s);
      else drawSlide(c, pal, x, y, 0.9 * s);
      break;
    default:
      drawBush(c, pal, x, y, 1.0 * s);
      break;
  }
}

// World state: left/right, layered, two-copy offsets (seamless looping)
let world = null;

function buildWorld() {
  const stripW = Math.floor(W * CONFIG.stripWidthPct);
  const stripH = H; // critical: strip tile equals screen height for two-copy loop
  const density = CONFIG.density;
  const minSpacing = CONFIG.minSpacingPx * dpr;

  const makeSide = (sideName, seedBase) => {
    const layers = CONFIG.layers.map((L, idx) => {
      const seed = seedBase + idx * 1337;
      const { items, fence } = buildStripLayer({
        seed,
        stripW,
        stripH,
        side: sideName,
        density: density * (idx === 0 ? 0.85 : idx === 1 ? 1.0 : 1.15),
        minSpacing: minSpacing * (idx === 0 ? 1.15 : idx === 1 ? 1.0 : 0.9),
      });
      return { cfg: L, items, fence, y: 0 };
    });
    return { layers };
  };

  world = {
    stripW,
    stripH,
    left: makeSide("left", 12345),
    right: makeSide("right", 54321),
  };
}

function drawStripSide(side, x0) {
  const pal = CONFIG.palette;
  const { stripW, stripH } = world;

  // Grass base
  ctx.save();
  ctx.translate(x0, 0);

  // Soft gradient grass
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.grassLight);
  g.addColorStop(1, pal.grassDark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, stripW, H);

  // Light texture dots (cheap)
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 60; i++) {
    const x = ((i * 97) % stripW) + 6;
    const y = ((i * 173) % H) + 6;
    ctx.beginPath();
    ctx.arc(x, y, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Fence line near the road edge
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.translate(side === world.left ? 0 : 0, 0);
  ctx.restore();

  ctx.restore();

  // Now render per-layer with two-copy seamless loop.
  const sideObj = side === world.left ? world.left : world.right;
  for (const L of sideObj.layers) {
    const layerSpeed = CONFIG.speedPxPerSec * L.cfg.speedMul * dpr;
    // Two stacked copies: y and y - stripH.
    drawLayerCopies({ x0, stripW, stripH, L, yOffset: L.y, alpha: L.cfg.alpha });
    drawLayerCopies({ x0, stripW, stripH, L, yOffset: L.y - stripH, alpha: L.cfg.alpha });
  }
}

function drawLayerCopies({ x0, stripW, stripH, L, yOffset, alpha }) {
  const pal = CONFIG.palette;
  ctx.save();
  ctx.translate(x0, yOffset);
  ctx.globalAlpha = alpha;

  // fence posts near road edge (always present, nice rhythm)
  for (const f of L.fence) {
    const depth = clamp((f.y + yOffset) / H, 0, 1);
    const s = lerp(L.cfg.scaleFar, L.cfg.scaleNear, depth);
    const x = f.x;
    const y = f.y;
    drawFencePost(ctx, pal, x, y, 0.85 * s);
  }

  // items
  for (const it of L.items) {
    const depth = clamp((it.y + yOffset) / H, 0, 1);
    const s = lerp(L.cfg.scaleFar, L.cfg.scaleNear, depth);
    drawItem(ctx, pal, it, s);
  }

  ctx.restore();
}

function drawScene() {
  const pal = CONFIG.palette;
  // Sky (center is empty road area placeholder)
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const stripW = world.stripW;
  const roadX0 = stripW;
  const roadW = W - stripW * 2;

  // Center empty road placeholder (no UI/gameplay).
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(roadX0, 0, roadW, H);

  // Side strips
  drawStripSide(world.left, 0);
  drawStripSide(world.right, W - stripW);

  // Clean outlines between strips and road
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 4 * dpr;
  ctx.beginPath();
  ctx.moveTo(roadX0, 0);
  ctx.lineTo(roadX0, H);
  ctx.moveTo(roadX0 + roadW, 0);
  ctx.lineTo(roadX0 + roadW, H);
  ctx.stroke();
}

let lastT = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  resize();
  if (!world) return;

  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;

  // Update per-layer offsets with EXACT strip height wrapping (seamless)
  for (const sideObj of [world.left, world.right]) {
    for (const L of sideObj.layers) {
      const v = CONFIG.speedPxPerSec * L.cfg.speedMul * dpr;
      L.y += v * dt;
      if (L.y >= world.stripH) L.y -= world.stripH; // critical: no gap, no stutter
    }
  }

  drawScene();
}

buildWorld();
resize();
requestAnimationFrame(tick);

