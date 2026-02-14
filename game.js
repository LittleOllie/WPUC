// game.js
import {
  getTopScores,
  checkLeaderboard,
  submitScore,
  getPlayerName,
  getStoredName,
  setStoredName,
  submitNameModal,
  renderTop10,
  renderLeaderboardPopup,
  MIN_LEADERBOARD_SCORE,
} from "./leaderboard.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const gameOver = document.getElementById("gameOver");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const saveNameBtn = document.getElementById("saveNameBtn");
const playerNameInput = document.getElementById("playerName");
const submitMsg = document.getElementById("submitMsg");
const finalLine = document.getElementById("finalLine");

const scorePill = document.getElementById("scorePill");
const shardsPill = document.getElementById("shardsPill");
const multPill = document.getElementById("multPill");

const nameModalInput = document.getElementById("nameModalInput");
const nameModalSave = document.getElementById("nameModalSave");
const leaderboardOverlay = document.getElementById("leaderboardOverlay");
const closeLeaderboardBtn = document.getElementById("closeLeaderboardBtn");
const openLeaderboardBtn = document.getElementById("openLeaderboardBtn");
const menuLeaderboardBtn = document.getElementById("menuLeaderboardBtn");
const keepPushingPopup = document.getElementById("keepPushingPopup");
const keepPushingMessage = document.getElementById("keepPushingMessage");
const keepPushingPlayAgainBtn = document.getElementById("keepPushingPlayAgainBtn");
const leaderboardSubmitSection = document.getElementById("leaderboardSubmitSection");
const leaderboardPlacedRank = document.getElementById("leaderboardPlacedRank");
const leaderboardNameInput = document.getElementById("leaderboardNameInput");
const leaderboardSubmitScoreBtn = document.getElementById("leaderboardSubmitScoreBtn");
const leaderboardPlayAgainBtn = document.getElementById("leaderboardPlayAgainBtn");
const leaderboardSubmitMsg = document.getElementById("leaderboardSubmitMsg");

const assets = {
  bgs: ["runnergame"],
  run: ["LORun1","LORun2","LORun3","LORun4","LORun5","LORun6"],
  hazards: ["cone"],
  ledges: ["ledge1", "ledge2", "ledge3", "ledge4"],
  bolts: ["bolt1", "bolt2", "bolt3", "bolt4", "bolt5", "bolt6"],
  images: new Map()
};

function loadImage(name){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `assets/${name}.png`;
  });
}

async function loadAssets(){
  for (const bg of assets.bgs){
    assets.images.set(bg, await loadImage(bg));
  }
  for (const s of assets.run){
    assets.images.set(s, await loadImage(s));
  }
  for (const h of assets.hazards){
    assets.images.set(h, await loadImage(h));
  }
  for (const ledge of assets.ledges){
    assets.images.set(ledge, await loadImage(ledge));
  }
  for (const b of assets.bolts){
    assets.images.set(b, await loadImage(b));
  }
}

function fitCanvas(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", fitCanvas);

function rectsIntersect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Engine (ported) ----
// Original platform/hazard sizes so sprites match original gameplay scale
const ORIGINAL_PLATFORM_HEIGHT = 22;
const ORIGINAL_HAZARD_GROUND_SIZE = 26;   // slightly bigger cones
const ORIGINAL_HAZARD_CEILING_SIZE = 32;
const LEDGE1_FIT_HEIGHT_MULT = 3;        // ledge1 drawn 3x (50% bigger than 2x) taller than other ledges
const SURFACE_COLLISION_HEIGHT = 1; // thin strip so feet align with visible ledge top

const TUNE = {
  playerSize: { w:60, h:60 },

  baseSpeed: 260,
  gravity: 1600,

  glideGravity: 520,
  maxGlideFallSpeed: 260,

  spawnAheadTime: 2.2,
  playerXRatio: 0.25,

  maxJumps: 2
};

const runSequence = [1,2,3,4,5,6,5,4,3,2]; // same idea as Swift
const framesPerSecond = 12;

const state = {
  // public-ish
  score: 0,
  shards: 0,
  multiplier: 1,

  isRunning: false,
  isGameOver: false,

  // internal
  elapsed: 0,
  animationTime: 0,
  multiplierMeter: 0.2,
  lastHudShards: 0,
  lastHudMult: 1,

  pressedGlide: false,
  jumpCount: 0,

  worldSpeed: 190,

  bgIndex: 0,
  bgScrollX: 0,

  player: { x:0, y:0, vy:0, onGround:false },

  platforms: [],
  hazards: [],
  shardItems: [],
  confetti: [],

  // input
  isPressing: false,
  pressStartMs: 0,

  // best local
  bestLocal: Number(localStorage.getItem("obh_best") || 0)
};

function resetWorldOnly(){
  const w = window.innerWidth, h = window.innerHeight;
  state.player.x = w * TUNE.playerXRatio;
  state.player.y = h * 0.45;
  state.player.vy = 0;
  state.player.onGround = false;

  state.platforms = [];
  state.hazards = [];
  state.shardItems = [];

  const startY = h * 0.65;
  const startLedgeIndex = Math.floor(Math.random() * 4);
  state.platforms.push({
    x: state.player.x - 80,
    y: startY,
    w: 340,
    baseY: startY,
    moveAmp: 0,
    moveSpeed: 0,
    phase: 0,
    ledgeIndex: startLedgeIndex,
    ledge4Double: startLedgeIndex === 3 && Math.random() < 0.5
  });

  ensureContent();
}

function resetAll(){
  state.score = 0;
  state.shards = 0;
  state.multiplier = 1;
  state.multiplierMeter = 0.2;
  state.elapsed = 0;
  state.animationTime = 0;
  state.pressedGlide = false;
  state.jumpCount = 0;
  state.confetti = [];
  state.isGameOver = false;
  state.lastHudShards = 0;
  state.lastHudMult = 1;

  state.bgScrollX = 0;
  resetWorldOnly();
}

function startRun(){
  if (state.isRunning) return;
  state.isGameOver = false;
  state.isRunning = true;
}

function endRun(){
  state.isRunning = false;
  state.isGameOver = true;

  const final = Math.floor(state.score);
  finalLine.textContent = `Score: ${final.toLocaleString()} • Best: ${Math.max(state.bestLocal, final).toLocaleString()}`;

  // local best + confetti
  if (final > state.bestLocal){
    state.bestLocal = final;
    localStorage.setItem("obh_best", String(final));
    burstConfetti();
  }

  // show game over overlay
  overlay.classList.add("hidden");
  gameOver.classList.remove("hidden");

  refreshLeaderboard().then(() => handleLeaderboard(final));
}

function handleLeaderboard(score) {
  if (score < MIN_LEADERBOARD_SCORE) {
    showKeepPushingPopup("Score 500+ to enter the Global Leaderboard!");
    return;
  }
  checkLeaderboard(score).then((result) => {
    if (result.qualifies && result.rank != null) {
      openLeaderboardWithSubmit(result.rank);
    } else {
      showKeepPushingPopup("So close! Keep climbing!");
    }
  });
}

function showKeepPushingPopup(message) {
  if (!keepPushingPopup || !keepPushingMessage) return;
  keepPushingMessage.textContent = message;
  keepPushingPopup.classList.remove("hidden");
  keepPushingPopup.setAttribute("aria-hidden", "false");
}

function doPlayAgain() {
  if (gameOver) gameOver.classList.add("hidden");
  if (keepPushingPopup) keepPushingPopup.classList.add("hidden");
  if (leaderboardOverlay) leaderboardOverlay.classList.add("hidden");
  submitMsg.textContent = "";
  resetAll();
  state.bgIndex = (state.bgIndex + 1) % assets.bgs.length;
  startRun();
}

async function openLeaderboardWithSubmit(rank) {
  if (!leaderboardOverlay || !leaderboardSubmitSection) return;
  leaderboardSubmitSection.classList.remove("hidden");
  if (leaderboardPlacedRank) leaderboardPlacedRank.textContent = `You placed #${rank}!`;
  if (closeLeaderboardBtn) closeLeaderboardBtn.classList.add("hidden");
  if (leaderboardSubmitMsg) leaderboardSubmitMsg.textContent = "";
  if (leaderboardNameInput) {
    leaderboardNameInput.value = getStoredName() || "";
    leaderboardNameInput.focus();
  }

  leaderboardOverlay.classList.remove("hidden");
  leaderboardOverlay.setAttribute("aria-hidden", "false");
  try {
    const rows = await getTopScores();
    renderLeaderboardPopup(rows);
  } catch (e) {
    // ignore
  }
}

function burstConfetti(){
  state.confetti = [];
  for (let i=0;i<110;i++){
    state.confetti.push({
      x: rand(30, Math.max(60, window.innerWidth - 30)),
      y: rand(-80, 20),
      vx: rand(-160, 160),
      vy: rand(-380, -40),
      size: rand(5, 10),
      life: rand(1.2, 2.4),
      c: ["#fff","#ffdd55","#6de0ff","#8cff7a","#ff9a4d","#ff7ad9"][Math.floor(rand(0,6))]
    });
  }
}

/** Confetti when a Top 10 score is submitted: yellow + blue, falls from top, 2–3 sec. */
function burstSubmissionConfetti(){
  state.confetti = [];
  const w = window.innerWidth;
  const colors = ["#FFDD55", "#6DE0FF", "#4C6FFF"];
  for (let i = 0; i < 90; i++) {
    state.confetti.push({
      x: rand(0, w),
      y: rand(-100, 40),
      vx: rand(-120, 120),
      vy: rand(-200, 80),
      size: rand(6, 12),
      life: rand(2, 3),
      c: colors[Math.floor(rand(0, 3))]
    });
  }
}

function updateConfetti(dt){
  if (!state.confetti.length) return;
  for (const c of state.confetti){
    c.vy += 900 * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.life -= dt;
  }
  state.confetti = state.confetti.filter(c => c.y <= window.innerHeight + 80 && c.life > 0);
}

function rand(a,b){ return a + Math.random()*(b-a); }

function jump(strength01){
  if (!state.isRunning || state.isGameOver) return;
  if (state.jumpCount >= TUNE.maxJumps) return;

  const t = Math.max(0, Math.min(1, strength01));
  const minImpulse = 460;
  const maxImpulse = 760;
  const impulse = minImpulse + (maxImpulse - minImpulse) * t;

  state.player.vy = -impulse;
  state.player.onGround = false;
  state.jumpCount += 1;
}

function ensureContent(){
  const w = window.innerWidth;
  const targetX = w + (state.worldSpeed * TUNE.spawnAheadTime);
  const lastX = state.platforms.reduce((m,p) => Math.max(m, p.x + p.w), 0);

  let cursor = lastX;
  while (cursor < targetX){
    const chunk = generateChunk(cursor);
    state.platforms.push(...chunk.platforms);
    state.hazards.push(...chunk.hazards);
    state.shardItems.push(...chunk.shards);
    cursor = chunk.nextX;
  }
}

function generateChunk(startX){
  const difficulty = Math.min(1, state.elapsed / 55);

  const minW = 150, maxW = 320;
  const gapMin = 70 + 60 * difficulty;
  const gapMax = 150 + 110 * difficulty;

  const h = window.innerHeight;
  const baseY = h * 0.68;
  const yVar = 110;

  const pattern = Math.floor(rand(0,4));
  const w = rand(minW, maxW);
  const gap = rand(gapMin, gapMax);

  let y = baseY + rand(-yVar, yVar);
  y = Math.max(90, Math.min(h - 70, y));
  if (pattern === 3) y -= 70;
  if (pattern === 0) y += 10;

  const movingChance = 0.22 + 0.18 * difficulty;
  const isMoving = Math.random() < movingChance;

  const ledgeIndex = Math.floor(Math.random() * 4);
  const p = {
    x: startX + gap,
    y,
    w,
    baseY: y,
    moveAmp: 0,
    moveSpeed: 0,
    phase: 0,
    ledgeIndex,
    ledge4Double: ledgeIndex === 3 && Math.random() < 0.5   // ledge4 sometimes 2 in a row
  };
  if (isMoving){
    p.moveAmp = rand(18,44);
    p.moveSpeed = rand(1.2,2.2);
    p.phase = rand(0, Math.PI*2);
  }

  const shards = [];
  if (Math.random() < 0.70){
    const sCount = Math.floor(rand(1,4));
    for (let i=0;i<sCount;i++){
      const sx = p.x + p.w * (0.25 + 0.22 * i);
      const sy = p.y - 42;
      shards.push({ x:sx, y:sy, size:18, boltIndex: Math.floor(Math.random() * 6) });
    }
  }

  const hazards = [];
  const hazardChance = 0.18 + 0.22 * difficulty;
  if (Math.random() < hazardChance){
    const hx = p.x + (Math.random()<0.5 ? 10 : (p.w - ORIGINAL_HAZARD_GROUND_SIZE - 10));
    const hy = p.y - ORIGINAL_HAZARD_GROUND_SIZE;
    hazards.push({ x:hx, y:hy, size:ORIGINAL_HAZARD_GROUND_SIZE });
  }

  if (pattern === 2 && difficulty > 0.2){
    const ceilingY = p.y - 140;
    if (ceilingY > 70){
      hazards.push({ x: p.x + p.w * 0.45 - ORIGINAL_HAZARD_CEILING_SIZE / 2, y: ceilingY, size: ORIGINAL_HAZARD_CEILING_SIZE });
    }
  }

  return { platforms:[p], hazards, shards, nextX: p.x + p.w };
}

function updateMovingPlatforms(){
  for (const p of state.platforms){
    if (p.moveAmp > 0){
      p.y = p.baseY + p.moveAmp * Math.sin(p.phase + p.moveSpeed * state.elapsed);
    }
  }
}

function getLedgeGeometry(p){
  const ledgeNames = assets.ledges;
  const ledgeName = ledgeNames[(p.ledgeIndex ?? 0) % ledgeNames.length];
  const ledgeImg = assets.images.get(ledgeName);
  if (!ledgeImg) return null;
  const nw = ledgeImg.naturalWidth;
  const nh = ledgeImg.naturalHeight;
  const fitH = ledgeName === "ledge1"
    ? ORIGINAL_PLATFORM_HEIGHT * LEDGE1_FIT_HEIGHT_MULT
    : ORIGINAL_PLATFORM_HEIGHT;
  const isDouble = ledgeName === "ledge2" || (ledgeName === "ledge4" && p.ledge4Double);
  const scale = isDouble
    ? Math.min(p.w / (2 * nw), fitH / nh)
    : Math.min(p.w / nw, fitH / nh);
  const dw = nw * scale;
  const dh = nh * scale;
  const totalW = isDouble ? dw * 2 : dw;
  const drawX = p.x + (p.w - totalW) / 2;
  return { drawX, totalW, dw, dh, ledgeName, ledgeImg, isDouble };
}

function resolvePlatformCollisions(){
  state.player.onGround = false;

  const pr = {
    x: state.player.x,
    y: state.player.y,
    w: TUNE.playerSize.w,
    h: TUNE.playerSize.h
  };

  const feetX = pr.x + pr.w * 0.5;

  for (const p of state.platforms){
    const geo = getLedgeGeometry(p);
    const plat = geo
      ? { x: geo.drawX, y: p.y, w: geo.totalW, h: SURFACE_COLLISION_HEIGHT }
      : { x: p.x, y: p.y, w: p.w, h: SURFACE_COLLISION_HEIGHT };

    const feetOverLedge = feetX >= plat.x && feetX <= plat.x + plat.w;
    if (state.player.vy >= 0 && rectsIntersect(pr, plat) && feetOverLedge){
      state.player.y = plat.y - pr.h;
      state.player.vy = 0;
      state.player.onGround = true;
      state.jumpCount = 0;
      return;
    }
  }
}

function checkShardCollisions(){
  const pr = { x:state.player.x, y:state.player.y, w:TUNE.playerSize.w, h:TUNE.playerSize.h };
  let gained = 0;

  state.shardItems = state.shardItems.filter(s => {
    const sr = { x:s.x, y:s.y, w:s.size, h:s.size };
    if (rectsIntersect(pr, sr)){
      gained += 1;
      return false;
    }
    return true;
  });

  if (gained > 0){
    state.shards += gained;
    state.multiplierMeter += gained * 0.22;
    while (state.multiplierMeter >= 1.0){
      state.multiplier += 1;
      state.multiplierMeter -= 1.0;
    }
    state.score += (gained * 12) * state.multiplier;
  }
}

function checkHazardCollisions(){
  const pr = { x:state.player.x, y:state.player.y, w:TUNE.playerSize.w, h:TUNE.playerSize.h };
  for (const h of state.hazards){
    const hr = { x:h.x, y:h.y, w:h.size, h:h.size };
    if (rectsIntersect(pr, hr)){
      endRun();
      return;
    }
  }
}

function updateWorld(dt){
  const dx = state.worldSpeed * dt;

  for (const p of state.platforms) p.x -= dx;
  for (const h of state.hazards) h.x -= dx;
  for (const s of state.shardItems) s.x -= dx;

  state.platforms = state.platforms.filter(p => p.x + p.w >= -120);
  state.hazards = state.hazards.filter(h => h.x + h.size >= -120);
  state.shardItems = state.shardItems.filter(s => s.x + s.size >= -120);

  ensureContent();
  state.player.x = window.innerWidth * TUNE.playerXRatio;

  // background scroll (disabled - static background)
  // state.bgScrollX = (state.bgScrollX + dx * 0.25) % Math.max(1, window.innerWidth);
}

function tick(dt){
  if (!state.isRunning || state.isGameOver) return;

  state.elapsed += dt;
  state.animationTime += dt;

  const ramp = Math.min(1, state.elapsed / 35);
  state.worldSpeed = TUNE.baseSpeed + (140 * ramp);

  state.score += dt * 18 * state.multiplier;

  // multiplier decay (matches Swift)
  if (state.pressedGlide){
    state.multiplierMeter = Math.max(0, state.multiplierMeter - dt * 0.12);
  } else {
    state.multiplierMeter = Math.max(0, state.multiplierMeter - dt * 0.04);
  }
  if (state.multiplierMeter <= 0.01 && state.multiplier > 1){
    state.multiplier = Math.max(1, state.multiplier - 1);
    state.multiplierMeter = 0.25;
  }

  // gravity
  const g = state.pressedGlide ? TUNE.glideGravity : TUNE.gravity;
  state.player.vy += g * dt;
  if (state.pressedGlide) state.player.vy = Math.min(state.player.vy, TUNE.maxGlideFallSpeed);
  state.player.y += state.player.vy * dt;

  updateWorld(dt);
  updateMovingPlatforms();
  resolvePlatformCollisions();
  checkShardCollisions();
  checkHazardCollisions();
  updateConfetti(dt);

  if (state.player.y > window.innerHeight + 80){
    endRun();
  }
}

function currentRunFrame(){
  const idx = Math.floor(state.animationTime * framesPerSecond) % runSequence.length;
  return runSequence[idx]; // 1..6 (then back)
}

function draw(){
  const w = window.innerWidth, h = window.innerHeight;
  ctx.clearRect(0,0,w,h);

  // BG – match home page: cover + center (same as .sky background-size/position)
  const bgName = assets.bgs[state.bgIndex % assets.bgs.length];
  const bgImg = assets.images.get(bgName);
  if (bgImg){
    const scale = Math.max(w / bgImg.width, h / bgImg.height);
    const dw = bgImg.width * scale;
    const dh = bgImg.height * scale;
    const x = (w - dw) / 2;
    const y = (h - dh) / 2;
    ctx.globalAlpha = 1;
    ctx.drawImage(bgImg, x, y, dw, dh);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(0,0,w,h);
  }

  // platforms: ledge sprites use getLedgeGeometry so collision = visible ledge only (no thin air)
  for (const p of state.platforms){
    const geo = getLedgeGeometry(p);
    if (geo){
      const drawY = p.y;
      if (geo.isDouble) {
        ctx.drawImage(geo.ledgeImg, geo.drawX, drawY, geo.dw, geo.dh);
        ctx.drawImage(geo.ledgeImg, geo.drawX + geo.dw, drawY, geo.dw, geo.dh);
      } else {
        ctx.drawImage(geo.ledgeImg, geo.drawX, drawY, geo.dw, geo.dh);
      }
    } else {
      const fitH = ORIGINAL_PLATFORM_HEIGHT;
      roundRectFill(p.x, p.y, p.w, fitH, 10, "rgba(255,255,255,0.75)");
      roundRectFill(p.x, p.y + 7, p.w, fitH - 7, 10, "rgba(0,0,0,0.22)");
      roundRectFill(p.x + 8, p.y + 3, p.w - 16, 2, 2, "rgba(255,255,255,0.55)");
    }
  }

  // hazards (cone.png): size matches original (22/26); draw matches collision
  const coneImg = assets.images.get("cone");
  for (const hz of state.hazards){
    if (coneImg){
      ctx.drawImage(coneImg, hz.x, hz.y, hz.size, hz.size);
    } else {
      roundRectFill(hz.x, hz.y, hz.size, hz.size, 6, "rgba(255,40,40,0.85)");
    }
  }

  // shards (bolt1–bolt6, random per shard, drawn 2x size centered on hitbox)
  const BOLT_DRAW_SCALE = 2;
  const boltNames = assets.bolts;
  for (const s of state.shardItems){
    const idx = (s.boltIndex ?? 0) % 6;
    const boltName = boltNames[idx];
    const boltImg = assets.images.get(boltName);
    const drawSize = s.size * BOLT_DRAW_SCALE;
    const drawX = s.x - (drawSize - s.size) / 2;
    const drawY = s.y - (drawSize - s.size) / 2;
    if (boltImg){
      ctx.drawImage(boltImg, drawX, drawY, drawSize, drawSize);
    } else {
      roundRectFill(s.x, s.y, s.size, s.size, 6, "rgba(0,255,255,0.90)");
      roundRectFill(s.x+6, s.y+6, s.size-12, s.size-12, 4, "rgba(255,255,255,0.40)");
    }
  }

  // player sprite
  const pr = { x:state.player.x, y:state.player.y, w:TUNE.playerSize.w, h:TUNE.playerSize.h };
  const frameNum = state.player.onGround ? currentRunFrame() : 1;
  const sprite = assets.images.get(`LORun${frameNum}`);
  if (sprite){
    ctx.drawImage(sprite, pr.x, pr.y, pr.w, pr.h);
  } else {
    roundRectFill(pr.x, pr.y, pr.w, pr.h, 12, "rgba(255,255,0,0.92)");
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.arc(pr.x + pr.w*0.65, pr.y + pr.h*0.3, 2.5, 0, Math.PI*2);
    ctx.fill();
  }

  // confetti
  for (const c of state.confetti){
    roundRectFill(c.x, c.y, c.size, c.size, 2, c.c);
  }

  // HUD: update values and trigger fun animations
  const scoreStr = Math.floor(state.score).toLocaleString();
  const shardsStr = String(state.shards);
  const multStr = `x${state.multiplier}`;
  scorePill.textContent = scoreStr;
  shardsPill.textContent = shardsStr;
  multPill.textContent = multStr;

  if (state.shards > state.lastHudShards) {
    scorePill.classList.add("pop");
    shardsPill.classList.add("pop");
    state.lastHudShards = state.shards;
    setTimeout(() => {
      scorePill.classList.remove("pop");
      shardsPill.classList.remove("pop");
    }, 380);
  }
  if (state.multiplier > state.lastHudMult) {
    multPill.classList.add("mult-high");
    state.lastHudMult = state.multiplier;
    setTimeout(() => multPill.classList.remove("mult-high"), 650);
  }
}

function roundRectFill(x,y,w,h,r,fill){
  ctx.fillStyle = fill;
  ctx.beginPath();
  const rr = Math.min(r, w/2, h/2);
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
  ctx.fill();
}

// ---- Input: hold = glide, release = jump strength ----
function onPressStart(){
  // start if not running
  if (!state.isRunning && !state.isGameOver){
    overlay.classList.add("hidden");
    startRun();
  }
  if (state.isGameOver) return;

  state.isPressing = true;
  state.pressStartMs = Date.now();
  state.pressedGlide = true;
}

function onPressEnd(){
  state.pressedGlide = false;

  if (!state.isRunning || state.isGameOver){
    state.isPressing = false;
    return;
  }

  const held = (Date.now() - (state.pressStartMs || Date.now())) / 1000;
  const strength = Math.max(0, Math.min(1, held / 0.55));
  jump(strength);

  state.isPressing = false;
}

window.addEventListener("pointerdown", (e) => {
  // Only handle game input when game is running and not clicking on interactive elements
  const target = e.target;
  const isInputOrButton = target.tagName === 'INPUT' || target.tagName === 'BUTTON';
  const overlaysVisible = !overlay.classList.contains("hidden") || !gameOver.classList.contains("hidden");
  
  // Don't handle game input if clicking on input/button or if overlays are visible
  if (!isInputOrButton && !overlaysVisible) {
    e.preventDefault();
    onPressStart();
  }
}, { passive:false });
window.addEventListener("pointerup", (e) => {
  // Only handle game input when game is running and not clicking on interactive elements
  const target = e.target;
  const isInputOrButton = target.tagName === 'INPUT' || target.tagName === 'BUTTON';
  const overlaysVisible = !overlay.classList.contains("hidden") || !gameOver.classList.contains("hidden");
  
  // Don't handle game input if clicking on input/button or if overlays are visible
  if (!isInputOrButton && !overlaysVisible) {
    e.preventDefault();
    onPressEnd();
  }
}, { passive:false });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space"){
    e.preventDefault();
    onPressStart();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space"){
    e.preventDefault();
    onPressEnd();
  }
});

// ---- UI buttons ----
startBtn.addEventListener("click", () => {
  overlay.classList.add("hidden");
  gameOver.classList.add("hidden");
  if (leaderboardOverlay) leaderboardOverlay.classList.add("hidden");
  if (keepPushingPopup) keepPushingPopup.classList.add("hidden");
  resetAll();
  state.bgIndex = (state.bgIndex + 1) % assets.bgs.length;
  startRun();
});

restartBtn.addEventListener("click", () => {
  submitMsg.textContent = "";
  doPlayAgain();
});

saveNameBtn.addEventListener("click", () => {
  const nm = (playerNameInput.value || "").trim().slice(0, 15);
  setStoredName(nm);
  submitMsg.textContent = nm ? `Saved as "${nm}"` : "Name cleared";
});

// Keep Pushing popup: PLAY AGAIN
if (keepPushingPlayAgainBtn) {
  keepPushingPlayAgainBtn.addEventListener("click", () => {
    if (keepPushingPopup) keepPushingPopup.classList.add("hidden");
    doPlayAgain();
  });
}

// Leaderboard overlay: submit score (when qualified)
if (leaderboardSubmitScoreBtn) {
  leaderboardSubmitScoreBtn.addEventListener("click", async () => {
    const name = (leaderboardNameInput && leaderboardNameInput.value || "").trim().slice(0, 15);
    if (!name) {
      if (leaderboardSubmitMsg) leaderboardSubmitMsg.textContent = "Enter your name";
      return;
    }
    setStoredName(name);
    leaderboardSubmitScoreBtn.disabled = true;
    leaderboardPlayAgainBtn.disabled = true;
    if (leaderboardSubmitMsg) leaderboardSubmitMsg.textContent = "";
    try {
      const sc = Math.floor(state.score);
      await submitScore(name, sc);
      await getTopScores().then(rows => renderLeaderboardPopup(rows));
      burstSubmissionConfetti();
      if (leaderboardSubmitMsg) leaderboardSubmitMsg.textContent = "Submitted! 🎉";
    } catch (err) {
      if (leaderboardSubmitMsg) leaderboardSubmitMsg.textContent = err?.message || "Could not submit";
    }
    leaderboardSubmitScoreBtn.disabled = false;
    leaderboardPlayAgainBtn.disabled = false;
  });
}

if (leaderboardPlayAgainBtn) {
  leaderboardPlayAgainBtn.addEventListener("click", () => {
    if (leaderboardOverlay) leaderboardOverlay.classList.add("hidden");
    leaderboardSubmitSection.classList.add("hidden");
    if (closeLeaderboardBtn) closeLeaderboardBtn.classList.remove("hidden");
    doPlayAgain();
  });
}

// Name modal: save and close
nameModalSave.addEventListener("click", () => {
  submitNameModal(nameModalInput.value);
});
nameModalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitNameModal(nameModalInput.value);
  if (e.key === "Escape") submitNameModal("");
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (keepPushingPopup && !keepPushingPopup.classList.contains("hidden")) {
    keepPushingPopup.classList.add("hidden");
  }
  if (leaderboardOverlay && !leaderboardOverlay.classList.contains("hidden")) {
    closeLeaderboardBtn && closeLeaderboardBtn.click();
  }
});

async function refreshLeaderboard() {
  try {
    const rows = await getTopScores();
    renderTop10(null, rows);
  } catch (e) {
    // ignore
  }
}

async function openLeaderboardPopup() {
  if (!leaderboardOverlay) return;
  if (leaderboardSubmitSection) leaderboardSubmitSection.classList.add("hidden");
  if (closeLeaderboardBtn) closeLeaderboardBtn.classList.remove("hidden");
  leaderboardOverlay.classList.remove("hidden");
  leaderboardOverlay.setAttribute("aria-hidden", "false");
  try {
    const rows = await getTopScores();
    renderLeaderboardPopup(rows);
  } catch (e) {
    // ignore
  }
}

if (closeLeaderboardBtn) {
  closeLeaderboardBtn.addEventListener("click", () => {
    if (leaderboardOverlay) {
      leaderboardOverlay.classList.add("hidden");
      leaderboardOverlay.setAttribute("aria-hidden", "true");
    }
    if (leaderboardSubmitSection) leaderboardSubmitSection.classList.add("hidden");
    if (closeLeaderboardBtn) closeLeaderboardBtn.classList.remove("hidden");
  });
}
if (openLeaderboardBtn) openLeaderboardBtn.addEventListener("click", () => openLeaderboardPopup());
if (menuLeaderboardBtn) menuLeaderboardBtn.addEventListener("click", () => openLeaderboardPopup());

// ---- Main loop ----
let lastT = 0;
function loop(t){
  if (!lastT) lastT = t;
  const dt = Math.min(Math.max((t - lastT)/1000, 0), 1/20);
  lastT = t;

  if (state.isRunning && !state.isGameOver){
    tick(dt);
  }
  draw();

  requestAnimationFrame(loop);
}

// ---- Init ----
(async function init(){
  console.log("🎮 One Button Hero — Initializing...");
  fitCanvas();
  await loadAssets();
  console.log("✅ Assets loaded");

  // name preload
  const nm = getStoredName();
  if (nm) playerNameInput.value = nm;

  // prep
  state.bgIndex = Math.floor(Math.random() * assets.bgs.length);
  resetAll();

  // initial top 10
  await refreshLeaderboard();
  console.log("✅ Game ready");

  requestAnimationFrame(loop);
})();
