// Frappy Brew – web port from Swift (FrappyBrewEngine + FrappyBrewView)
// Uses all assets from ARCADE GAMES/CURRENT FINAL VERSION/Shared/Assets.xcassets

(() => {
  const canvas = document.getElementById("gameCanvas");
  const canvasWrap = document.getElementById("canvasWrap");
  if (!canvas) {
    console.error("Frappy Brew: #gameCanvas not found");
    return;
  }
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("scoreValue");
  const beansEl = document.getElementById("beansValue");
  const bestEl = document.getElementById("bestValue");
  const overlayEl = document.getElementById("overlay");
  const startCardEl = document.getElementById("startCard");
  const gameOverCardEl = document.getElementById("gameOverCard");
  const startBtn = document.getElementById("startBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const summaryTextEl = document.getElementById("summaryText");
  const loadingTextEl = document.getElementById("loadingText");
  const readyTitleEl = document.querySelector(".ready-title");
  const readyDescEl = document.querySelector(".ready-desc");
  const introSplashEl = document.getElementById("introSplash");
  const introPlayBtn = document.getElementById("introPlayBtn");
  const introSplashLoadingEl = document.getElementById("introSplashLoading");

  function resolveAssetPath(rel) {
    const b = typeof window !== "undefined" && window.__FRAPPY_BASE__;
    if (!b) return rel;
    return String(b).replace(/\/?$/, "/") + String(rel).replace(/^\//, "");
  }

  /** Shell modals use role=dialog; block game input while any is open. */
  function isModalDialogOpen() {
    for (const el of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
      if (el.hasAttribute("hidden")) continue;
      if (el.getAttribute("aria-hidden") === "true") continue;
      return true;
    }
    return false;
  }

  let width = 480;
  let height = 640;

  // Asset paths — shell sets window.__FRAPPY_SKIN__ (player, bg, pickups, hazardTheme).
  const ASSETS_DEFAULT = {
    player: "assets/player1.png",
    bean: "assets/bean.png",
    bean_golden: "assets/bean_golden.png",
    cup_red: "assets/ddg.png",
    bg0: "assets/bg01.png",
    pillar_cup: "assets/pillar_cup.png",
  };
  const ASSETS = { ...ASSETS_DEFAULT };

  /** @type {"water"|"fire"|"lab"} */
  let hazardTheme = "water";

  function applySkinFromWindow() {
    Object.assign(ASSETS, ASSETS_DEFAULT);
    const s = typeof window !== "undefined" && window.__FRAPPY_SKIN__;
    if (s) {
      if (s.player) ASSETS.player = s.player;
      if (s.bg) ASSETS.bg0 = s.bg;
      if (s.bean) ASSETS.bean = s.bean;
      if (s.bean_golden) ASSETS.bean_golden = s.bean_golden;
      if (s.cup_red) ASSETS.cup_red = s.cup_red;
      if (s.pillar_cup) ASSETS.pillar_cup = s.pillar_cup;
      if (s.hazardTheme === "fire" || s.hazardTheme === "lab" || s.hazardTheme === "water") {
        hazardTheme = s.hazardTheme;
      } else {
        hazardTheme = "water";
      }
    } else {
      hazardTheme = "water";
    }
  }
  applySkinFromWindow();

  const images = {};

  /** Scales player, pillars, pickups, and physics distances together (~12% smaller on screen). */
  const GAMEPLAY_SCALE = 0.88;
  function gs(n) {
    return Math.max(1, Math.round(n * GAMEPLAY_SCALE));
  }

  // Match FrappyBrewEngine constants
  const GRAVITY = 1050;
  const FLAP_VELOCITY = -430;
  const SCROLL_SPEED = 260;
  /** Vertical opening height (px) — slightly wider for a bit more room. */
  const PIPE_GAP = gs(262);
  const PIPE_WIDTH = gs(86);
  /** Horizontal distance between pillar pairs — wider = more time to react. */
  const PIPE_SPACING = gs(330);
  /** Max vertical shift of gap center vs the previous pillar (smoother difficulty curve). */
  const PIPE_GAP_CENTER_MAX_STEP = gs(105);
  const MARGIN_TOP = gs(70);
  const MARGIN_BOTTOM = gs(70);
  const PLAYER_X_RATIO = 0.28;
  const GRACE_DURATION = 1.2; // seconds

  // View sizes (FrappyBrewView)
  const PLAYER_DRAW_SIZE = gs(134);
  /** Fallback if alpha analysis fails (same-origin PNG required for ImageData). */
  const PLAYER_HIT_RADIUS_FALLBACK = (PLAYER_DRAW_SIZE / 2) * 0.18;
  /** Filled from opaque pixels of player.png at load — tight circle, not full square. */
  let playerHitRadiusPx = PLAYER_HIT_RADIUS_FALLBACK;
  /** Offset from sprite center (playerX, playerY) to opaque character centroid in draw space. */
  let playerHitOffsetX = 0;
  let playerHitOffsetY = 0;
  /** Actual on-canvas draw size (aspect preserved; max side = PLAYER_DRAW_SIZE). */
  let playerDrawW = PLAYER_DRAW_SIZE;
  let playerDrawH = PLAYER_DRAW_SIZE;
  /** Horizontal inset only: cup tiles are 3× clip width and centered; clip left/right are often empty. */
  const PILLAR_HIT_INSET_X = Math.max(6, gs(12));
  const CEILING_TOP_MARGIN = Math.max(8, gs(10));
  const PICKUP_DRAW_SIZE = gs(56);
  /** DDG (+8) — PNG has lots of padding; draw larger than bubbles so the skull reads clearly. */
  const PICKUP_DRAW_SIZE_DDG = Math.max(1, Math.round(PICKUP_DRAW_SIZE * 2.6));
  /** Hit uses only the central skull — circle diameter ≈ this fraction of draw size. */
  const DDG_HIT_RATIO = 0.38;
  const PICKUP_DRAW_SIZE_MINE = Math.max(28, gs(36));
  const PICKUP_OFFSET_X = gs(70);
  const PICKUP_OFFSET_X_MINE = gs(92);
  const PICKUP_Y_JITTER = gs(70);
  const PICKUP_Y_JITTER_MINE = gs(44);
  const EDGE_PAD = gs(60);
  const WORLD_SEED_X = gs(220);
  const SPAWN_AHEAD = gs(240);
  const PIPE_CULL_X = gs(220);
  const PICKUP_CULL_X = gs(240);
  const SHIELD_RING_R = gs(53);
  const SHIELD_LINE_W = Math.max(2, gs(5));
  const PLAYER_MIN_X = gs(44);
  const PILLAR_CUP_WIDTH_MULT = 3.0;
  const PILLAR_CUP_ASPECT = 1.10;

  const PICKUP_TYPES = {
    BEAN: "bean",
    GOLDEN: "bean_golden",
    RED_CUP: "cup_red",
    /** Hazard — drawn as underwater mine + explosion on hit (no sprite asset). */
    BURNT: "mine",
  };

  let playerX = 0;
  let playerY = 0;
  let playerVY = 0;
  let pipes = [];
  let pickups = [];
  /** @type {{ cx: number; cy: number; particles: { x: number; y: number; vx: number; vy: number; life: number; r: number; warm: boolean }[]; flash: number }[]} */
  let mineExplosions = [];

  let score = 0;
  let beans = 0;
  let best = Number(localStorage.getItem("frappy_best_web") || "0");
  if (bestEl) bestEl.textContent = best;

  let isRunning = false;
  let isGameOver = false;
  let shieldHits = 0;
  let lastTime = 0;
  let graceUntil = 0; // timestamp when grace period ends
  let assetsReady = false;

  /**
   * Center square crop so tall portrait sprites (player 1/2) match scene 3’s square framing.
   * Same on-screen size as player 3 (1024×1024) when drawn to PLAYER_DRAW_SIZE².
   */
  function getPlayerSourceCrop(img) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return { sx: 0, sy: 0, sw: 1, sh: 1 };
    const side = Math.min(iw, ih);
    const sx = (iw - side) / 2;
    const sy = (ih - side) / 2;
    return { sx, sy, sw: side, sh: side };
  }

  /** Fallback when alpha analysis fails — still square like scene 3. */
  function computePlayerDrawDims() {
    return { drawW: PLAYER_DRAW_SIZE, drawH: PLAYER_DRAW_SIZE };
  }

  /**
   * Hit circle from opaque pixels in the same square crop used for drawing.
   */
  function analyzePlayerHitFromImage(img) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;
    const { sx, sy, sw, sh } = getPlayerSourceCrop(img);
    const drawW = PLAYER_DRAW_SIZE;
    const drawH = PLAYER_DRAW_SIZE;
    const maxSide = 256;
    const scale = Math.min(1, maxSide / sw);
    const cw = Math.max(1, Math.round(sw * scale));
    const ch = Math.max(1, Math.round(sh * scale));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const cctx = c.getContext("2d");
    cctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    let data;
    try {
      data = cctx.getImageData(0, 0, cw, ch).data;
    } catch {
      return null;
    }
    const aThresh = 28;
    let minX = cw;
    let minY = ch;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < ch; y++) {
      const row = y * cw * 4;
      for (let x = 0; x < cw; x++) {
        if (data[row + x * 4 + 3] > aThresh) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return null;
    const centerXp = (minX + maxX + 1) / (2 * cw);
    const centerYp = (minY + maxY + 1) / (2 * ch);
    const offX = (centerXp - 0.5) * drawW;
    const offY = (centerYp - 0.5) * drawH;
    const bboxWpx = (maxX - minX + 1) / cw;
    const bboxHpx = (maxY - minY + 1) / ch;
    const rW = bboxWpx * drawW;
    const rH = bboxHpx * drawH;
    const r = Math.min(rW, rH) * 0.44;
    const cap = Math.min(drawW, drawH) * 0.48;
    return {
      offX,
      offY,
      r: Math.max(6, Math.min(r, cap)),
      drawW,
      drawH,
    };
  }

  function loadImage(key) {
    const path = ASSETS[key];
    if (!path) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        if (key === "player") {
          const hit = analyzePlayerHitFromImage(img);
          if (hit) {
            playerHitOffsetX = hit.offX;
            playerHitOffsetY = hit.offY;
            playerHitRadiusPx = hit.r;
            playerDrawW = hit.drawW;
            playerDrawH = hit.drawH;
          } else {
            const d = computePlayerDrawDims();
            playerDrawW = d.drawW;
            playerDrawH = d.drawH;
            playerHitOffsetX = 0;
            playerHitOffsetY = 0;
            playerHitRadiusPx = PLAYER_HIT_RADIUS_FALLBACK;
          }
        }
        resolve();
      };
      img.onerror = () => reject(new Error("Failed to load " + path));
      img.src = resolveAssetPath(path);
    });
  }

  function loadAllAssets() {
    return Promise.all(Object.keys(ASSETS).map(loadImage)).then(() => {
      assetsReady = true;
      if (loadingTextEl) loadingTextEl.style.display = "none";
      if (readyTitleEl) readyTitleEl.style.display = "block";
      if (readyDescEl) readyDescEl.style.display = "block";
      if (introSplashLoadingEl) introSplashLoadingEl.style.display = "none";
      if (introPlayBtn) introPlayBtn.disabled = false;
      if (startBtn) {
        startBtn.disabled = false;
        const t = startBtn.querySelector(".btn-primary-text");
        if (t) t.textContent = "Start";
      }
    });
  }

  function isIntroVisible() {
    return introSplashEl != null && !introSplashEl.classList.contains("hidden");
  }

  function dismissIntro() {
    if (!introSplashEl) return;
    introSplashEl.classList.add("hidden");
    introSplashEl.setAttribute("aria-hidden", "true");
  }

  function resizeCanvas() {
    const wrap = document.getElementById("canvasWrap");
    const rect = wrap ? { width: wrap.clientWidth, height: wrap.clientHeight } : canvas.getBoundingClientRect();
    const w = rect.width || 480;
    const h = rect.height || 640;
    if (w <= 0 || h <= 0) return;
    width = w;
    height = h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (isRunning && pipes.length) {
      clampPipeGapsToScreen();
      const pr = playerHitRadius();
      playerY = clamp(
        playerY,
        CEILING_TOP_MARGIN + pr - playerHitOffsetY,
        height - pr - playerHitOffsetY
      );
    }
    if (!isRunning && !isGameOver) {
      playerX = Math.max(PLAYER_MIN_X, width * PLAYER_X_RATIO);
      playerY = height * 0.48;
    }
  }

  window.addEventListener("resize", resizeCanvas);
  if (document.readyState === "complete") {
    resizeCanvas();
  } else {
    window.addEventListener("load", () => resizeCanvas());
  }
  requestAnimationFrame(() => resizeCanvas());

  function resetWorld() {
    score = 0;
    beans = 0;
    isRunning = true;
    isGameOver = false;
    shieldHits = 0;
    graceUntil = performance.now() / 1000 + GRACE_DURATION;
    playerX = Math.max(PLAYER_MIN_X, width * PLAYER_X_RATIO);
    playerY = height * 0.48;
    playerVY = FLAP_VELOCITY * 0.4;

    pipes = [];
    pickups = [];
    mineExplosions = [];

    // Seed pipes offscreen (match Swift)
    const startX = width + WORLD_SEED_X;
    for (let i = 0; i < 3; i++) {
      spawnPipe(startX + i * PIPE_SPACING);
    }

    lastTime = performance.now();
    startCardEl.classList.add("hidden");
    gameOverCardEl.classList.add("hidden");
    syncGameOverPageClass();
    syncInputStacking();
  }

  function spawnPipe(x) {
    const gapHalf = PIPE_GAP / 2;
    const minY = MARGIN_TOP + gapHalf;
    const maxY = height - MARGIN_BOTTOM - gapHalf;
    let prevCenter = height * 0.5;
    if (pipes.length > 0) {
      let rx = -Infinity;
      for (const p of pipes) {
        if (p.x > rx) {
          rx = p.x;
          prevCenter = p.gapCenterY;
        }
      }
    }
    const step = PIPE_GAP_CENTER_MAX_STEP;
    let centerY;
    if (maxY <= minY) {
      centerY = (minY + maxY) * 0.5;
    } else {
      // Uniform target anywhere in the playable band, then move at most `step` from previous gap
      // (avoids correlated up/down random-walk; still never jumps farther than `step`).
      const desiredY = minY + Math.random() * (maxY - minY);
      centerY = clamp(desiredY, prevCenter - step, prevCenter + step);
      centerY = clamp(centerY, minY, maxY);
    }
    pipes.push({ x, gapCenterY: centerY, scored: false });

    const roll = Math.random();
    let type;
    if (roll < 0.65) type = PICKUP_TYPES.BEAN;
    else if (roll < 0.78) type = PICKUP_TYPES.GOLDEN;
    else if (roll < 0.93) type = PICKUP_TYPES.RED_CUP;
    else type = PICKUP_TYPES.BURNT;

    let py = clamp(
      centerY + randomRange(-PICKUP_Y_JITTER, PICKUP_Y_JITTER),
      EDGE_PAD,
      height - EDGE_PAD
    );
    let px = x + PIPE_WIDTH + PICKUP_OFFSET_X;
    let drawSize = PICKUP_DRAW_SIZE;
    if (type === PICKUP_TYPES.RED_CUP) {
      drawSize = PICKUP_DRAW_SIZE_DDG;
    }
    /** @type {number | undefined} */
    let hitSize;
    if (type === PICKUP_TYPES.RED_CUP) {
      hitSize = Math.max(12, Math.round(PICKUP_DRAW_SIZE_DDG * DDG_HIT_RATIO));
    }
    if (type === PICKUP_TYPES.BURNT) {
      drawSize = PICKUP_DRAW_SIZE_MINE;
      hitSize = undefined;
      py = clamp(
        centerY + randomRange(-PICKUP_Y_JITTER_MINE, PICKUP_Y_JITTER_MINE),
        EDGE_PAD,
        height - EDGE_PAD
      );
      px = x + PIPE_WIDTH + PICKUP_OFFSET_X_MINE;
    }
    const pu = {
      type,
      x: px,
      y: py,
      alive: true,
      drawSize,
    };
    if (hitSize != null) pu.hitSize = hitSize;
    pickups.push(pu);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function randomRange(a, b) {
    return a + Math.random() * (b - a);
  }

  /**
   * Circle radius for mine hits — matches procedural mines (body r = sz*0.36, spike tips at bodyR*1.62) plus a small margin.
   * Fire (cinder core) uses a tighter extent: the same geometry as water/lab reads smaller on the molten BG, and the global
   * margin was noticeably larger than the drawn spikes.
   */
  function mineHitRadiusPx(sz) {
    const bodyR = sz * 0.36;
    const spikeTip = bodyR * 1.62;
    if (hazardTheme === "fire") {
      const extent = spikeTip * 0.88;
      return extent + Math.max(1, gs(2));
    }
    return spikeTip + Math.max(2, gs(4));
  }

  /** Same formula as spawnPipe — keeps gap valid if window height changes mid-game. */
  function clampPipeGapsToScreen() {
    const gapHalf = PIPE_GAP / 2;
    const minY = MARGIN_TOP + gapHalf;
    const maxY = height - MARGIN_BOTTOM - gapHalf;
    if (maxY < minY) return;
    for (const p of pipes) {
      if (!Number.isFinite(p.gapCenterY)) continue;
      p.gapCenterY = clamp(p.gapCenterY, minY, maxY);
    }
  }

  /** Single source of truth for pillar gap geometry (must match draw + collision). */
  function getPipeGapBounds(p) {
    const gapHalf = PIPE_GAP / 2;
    const topH = Math.max(0, p.gapCenterY - gapHalf);
    const botY = Math.min(height, p.gapCenterY + gapHalf);
    return { topH, botY };
  }

  function playerHitRadius() {
    return playerHitRadiusPx;
  }

  function hitPosX() {
    return playerX + playerHitOffsetX;
  }

  function hitPosY() {
    return playerY + playerHitOffsetY;
  }

  function circleRectIntersects(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    const dx = cx - nx;
    const dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  }

  /** Circle vs pillar solids — same outer bounds as drawTiledPillar clip (full height; X inset only). */
  function circleHitsPillarRects(cx, cy, r, pipeX, pipeW, topH, botY) {
    const insetX = PILLAR_HIT_INSET_X;
    const ix = pipeX + insetX;
    const iw = Math.max(0, pipeW - 2 * insetX);
    if (iw <= 0) return false;
    if (topH > 0) {
      const topRect = { x: ix, y: 0, w: iw, h: topH };
      if (circleRectIntersects(cx, cy, r, topRect)) return true;
    }
    const botH = height - botY;
    if (botH > 0) {
      const botRect = { x: ix, y: botY, w: iw, h: botH };
      if (circleRectIntersects(cx, cy, r, botRect)) return true;
    }
    return false;
  }

  function handlePickup(t) {
    switch (t) {
      case PICKUP_TYPES.BEAN:
        beans += 1;
        score += 1;
        break;
      case PICKUP_TYPES.GOLDEN:
        beans += 1;
        score += 5;
        shieldHits = Math.min(1, shieldHits + 1);
        break;
      case PICKUP_TYPES.RED_CUP:
        score += 8;
        break;
      case PICKUP_TYPES.BURNT:
        if (performance.now() / 1000 >= graceUntil) hitAndMaybeDie();
        break;
    }
    if (score > best) {
      best = score;
      localStorage.setItem("frappy_best_web", String(best));
    }
  }

  function hitAndMaybeDie() {
    if (shieldHits > 0) {
      shieldHits -= 1;
      playerVY = FLAP_VELOCITY * 0.65;
      return;
    }
    endGame();
  }

  function syncGameOverPageClass() {
    if (document.body) {
      document.body.classList.toggle("game-over-active", isGameOver && !isIntroVisible());
    }
  }

  function endGame() {
    isRunning = false;
    isGameOver = true;
    gameOverCardEl.classList.remove("hidden");
    startCardEl.classList.add("hidden");
    summaryTextEl.textContent = `Score ${score} • Bubbles ${beans} • Best ${best}`;
    syncGameOverPageClass();
    syncInputStacking();
    /** Leaderboard: single hook after score is final — see leaderboard-init.js window.handleGameOver */
    const finalScore = Math.floor(Number(score));
    try {
      if (typeof window.handleGameOver === "function") {
        window.handleGameOver(Number.isFinite(finalScore) && finalScore >= 0 ? finalScore : 0);
      }
    } catch (_) {
      /* non-fatal if leaderboard module missing */
    }
  }

  /** While playing, canvas must be above #overlay or taps go to the overlay div and never reach the canvas (Safari/desktop). */
  function syncInputStacking() {
    if (!canvas || !overlayEl) return;
    const menuUp = !isRunning || isGameOver;
    if (menuUp) {
      canvas.style.zIndex = "1";
      overlayEl.style.zIndex = "15";
      overlayEl.style.pointerEvents = "auto";
    } else {
      canvas.style.zIndex = "25";
      overlayEl.style.zIndex = "5";
      overlayEl.style.pointerEvents = "none";
    }
  }

  function flap() {
    if (isModalDialogOpen()) return;
    if (isIntroVisible()) return;
    if (!isRunning && !isGameOver) {
      doResetWorld();
      return;
    }
    if (isGameOver) return;
    playerVY = FLAP_VELOCITY;
  }

  function update(dt) {
    if (!isRunning) return;

    playerVY += GRAVITY * dt;
    playerY += playerVY * dt;

    const prForFloor = playerHitRadius();
    const now = performance.now() / 1000;

    if (hitPosY() + prForFloor > height) {
      if (now < graceUntil) {
        playerY = height - prForFloor - playerHitOffsetY;
        playerVY = FLAP_VELOCITY * 0.4;
      } else {
        hitAndMaybeDie();
        return;
      }
    }
    if (hitPosY() - prForFloor < CEILING_TOP_MARGIN) {
      playerY = CEILING_TOP_MARGIN + prForFloor - playerHitOffsetY;
      playerVY = 0;
    }

    for (const p of pipes) {
      p.x -= SCROLL_SPEED * dt;
    }
    for (const p of pickups) {
      p.x -= SCROLL_SPEED * dt;
    }

    const rightMost = pipes.reduce((m, p) => Math.max(m, p.x), -Infinity);
    if (rightMost < width + SPAWN_AHEAD) {
      spawnPipe(rightMost + PIPE_SPACING);
    }

    pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -PIPE_CULL_X);
    pickups = pickups.filter((p) => p.x > -PICKUP_CULL_X && p.alive);

    const px = playerX;
    for (const p of pipes) {
      if (!p.scored && p.x + PIPE_WIDTH < px) {
        p.scored = true;
        score += 1;
        if (score > best) {
          best = score;
          localStorage.setItem("frappy_best_web", String(best));
        }
      }
    }

    const pradius = playerHitRadius();
    const hi = PILLAR_HIT_INSET_X;
    for (const p of pipes) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.gapCenterY)) continue;
      const pipeX = p.x;
      const pipeW = PIPE_WIDTH;
      const { topH, botY } = getPipeGapBounds(p);
      if (botY < topH) continue;
      const colL = pipeX + hi;
      const colR = pipeX + pipeW - hi;
      if (colR <= colL) continue;
      // No horizontal overlap with inset pillar column → cannot hit
      if (hitPosX() + pradius <= colL || hitPosX() - pradius >= colR) continue;
      // Single source of truth: same rects as draw — no separate "gap band" (that caused false deaths).
      if (
        circleHitsPillarRects(hitPosX(), hitPosY(), pradius, pipeX, pipeW, topH, botY)
      ) {
        if (now >= graceUntil) {
          hitAndMaybeDie();
          return;
        }
      }
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      const psz = p.drawSize != null ? p.drawSize : PICKUP_DRAW_SIZE;
      let hit = false;
      if (p.type === PICKUP_TYPES.BURNT) {
        const dx = hitPosX() - p.x;
        const dy = hitPosY() - p.y;
        const mineSz = p.drawSize != null ? p.drawSize : PICKUP_DRAW_SIZE_MINE;
        const mineR = mineHitRadiusPx(mineSz);
        const rr = mineR + pradius;
        hit = dx * dx + dy * dy <= rr * rr;
      } else if (p.type === PICKUP_TYPES.RED_CUP) {
        const hitD = p.hitSize != null ? p.hitSize : Math.max(12, Math.round(psz * DDG_HIT_RATIO));
        const hr = hitD / 2;
        const dx = hitPosX() - p.x;
        const dy = hitPosY() - p.y;
        const rr = hr + pradius;
        hit = dx * dx + dy * dy <= rr * rr;
      } else {
        const hitSz = p.hitSize != null ? p.hitSize : psz;
        const ph = hitSz / 2;
        const pr = { x: p.x - ph, y: p.y - ph, w: hitSz, h: hitSz };
        hit = circleRectIntersects(hitPosX(), hitPosY(), pradius, pr);
      }
      if (hit) {
        if (p.type === PICKUP_TYPES.BURNT) spawnMineExplosion(p.x, p.y);
        handlePickup(p.type);
        p.alive = false;
        if (!isRunning) return;
      }
    }
  }

  function spawnMineExplosion(x, y) {
    const n = 28;
    const particles = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 90 + Math.random() * 220;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.2,
        r: 1.5 + Math.random() * 3.5,
        warm: Math.random() < 0.55,
      });
    }
    mineExplosions.push({ cx: x, cy: y, particles, flash: 0.12 });
  }

  function updateMineExplosions(dt) {
    if (!mineExplosions.length) return;
    const next = [];
    for (const ex of mineExplosions) {
      ex.cx -= SCROLL_SPEED * dt;
      if (ex.flash > 0) ex.flash = Math.max(0, ex.flash - dt);
      let any = ex.flash > 0;
      for (const p of ex.particles) {
        p.x += p.vx * dt - SCROLL_SPEED * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= dt;
        if (p.life > 0) any = true;
      }
      if (any) next.push(ex);
    }
    mineExplosions = next;
  }

  function drawUnderwaterMine(cx, cy, sz) {
    const r = sz * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r);
    g.addColorStop(0, "#95a8bd");
    g.addColorStop(0.5, "#4a5568");
    g.addColorStop(1, "#232830");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#171a20";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const spikes = 12;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(-3.5, -r * 1.62);
      ctx.lineTo(3.5, -r * 1.62);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, -r * 0.92, 0, -r * 1.62);
      sg.addColorStop(0, "#5e6772");
      sg.addColorStop(1, "#323842");
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = "#14171c";
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.32, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.62);
    ctx.lineTo(0, -r * 2.05);
    ctx.strokeStyle = "#3d4650";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawFireMine(cx, cy, sz) {
    const r = sz * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r);
    g.addColorStop(0, "#fff8e8");
    g.addColorStop(0.35, "#ff8c42");
    g.addColorStop(0.75, "#c0392b");
    g.addColorStop(1, "#4a0e0e");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#2c0a0a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const spikes = 12;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(-3.5, -r * 1.62);
      ctx.lineTo(3.5, -r * 1.62);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, -r * 0.92, 0, -r * 1.62);
      sg.addColorStop(0, "#8b2500");
      sg.addColorStop(1, "#3d0a0a");
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = "#1a0505";
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.28, r * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,220,160,0.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.62);
    ctx.lineTo(0, -r * 2.05);
    ctx.strokeStyle = "#5c1a00";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawLabMine(cx, cy, sz) {
    const r = sz * 0.36;
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.06, 0, 0, r);
    g.addColorStop(0, "#c8f0a0");
    g.addColorStop(0.45, "#6b8e23");
    g.addColorStop(1, "#0d3d0d");
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#0a2f0a";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const spikes = 12;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.lineTo(-3.5, -r * 1.62);
      ctx.lineTo(3.5, -r * 1.62);
      ctx.closePath();
      const sg = ctx.createLinearGradient(0, -r * 0.92, 0, -r * 1.62);
      sg.addColorStop(0, "#556b2f");
      sg.addColorStop(1, "#2f4f2f");
      ctx.fillStyle = sg;
      ctx.fill();
      ctx.strokeStyle = "#1a2f1a";
      ctx.lineWidth = 0.75;
      ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(-r * 0.26, -r * 0.3, r * 0.19, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,255,200,0.28)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.62);
    ctx.lineTo(0, -r * 2.05);
    ctx.strokeStyle = "#2d5016";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawHazardMine(cx, cy, sz) {
    if (hazardTheme === "fire") drawFireMine(cx, cy, sz);
    else if (hazardTheme === "lab") drawLabMine(cx, cy, sz);
    else drawUnderwaterMine(cx, cy, sz);
  }

  function drawMineExplosions() {
    for (const ex of mineExplosions) {
      if (ex.flash > 0) {
        const u = 1 - ex.flash / 0.12;
        ctx.save();
        ctx.globalAlpha = 0.45 * (1 - u * 0.85);
        const cx = ex.cx;
        const cy = ex.cy;
        const rad = gs(28) + u * gs(95);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, "rgba(255,248,220,0.95)");
        g.addColorStop(0.25, "rgba(255,160,60,0.55)");
        g.addColorStop(0.55, "rgba(255,90,20,0.2)");
        g.addColorStop(1, "rgba(255,40,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const p of ex.particles) {
        if (p.life <= 0) continue;
        const t = p.life / 0.45;
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 1.2);
        ctx.fillStyle = p.warm ? "#ffcc66" : "#ff6622";
        ctx.shadowColor = "rgba(255,200,80,0.8)";
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Draw tiled steel pillar (cupW = rect.width*3, cupH = cupW*1.10)
  function drawTiledPillar(rect, anchorToTop) {
    const img = images.pillar_cup;
    if (!img) {
      ctx.fillStyle = "#5a5d66";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return;
    }
    const cupW = rect.w * PILLAR_CUP_WIDTH_MULT;
    const cupH = cupW * PILLAR_CUP_ASPECT;
    const count = Math.max(1, Math.ceil(rect.h / cupH));
    const cx = rect.x + rect.w / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    for (let i = 0; i < count; i++) {
      const cy = anchorToTop
        ? rect.y + cupH / 2 + i * cupH
        : rect.y + rect.h - cupH / 2 - i * cupH;
      ctx.drawImage(img, cx - cupW / 2, cy - cupH / 2, cupW, cupH);
    }
    ctx.restore();
  }

  /** Cover dest rect without stretching; clips overflow (like object-fit: cover). */
  function drawImageCover(img, x, y, w, h) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const ox = x + (w - dw) / 2;
    const oy = y + (h - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.drawImage(img, ox, oy, dw, dh);
    ctx.restore();
  }

  function draw() {

    const bgImg = images.bg0;
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = 0.62;
      drawImageCover(bgImg, 0, 0, width, height);
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(0, 0, width, height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#78d0ff");
      grad.addColorStop(1, "#4caf50");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Obstacles as tiled steel pillars
    for (const p of pipes) {
      const { topH, botY } = getPipeGapBounds(p);
      const botH = Math.max(0, height - botY);
      drawTiledPillar(
        { x: p.x, y: 0, w: PIPE_WIDTH, h: topH },
        true
      );
      drawTiledPillar(
        { x: p.x, y: botY, w: PIPE_WIDTH, h: botH },
        false
      );
    }

    // Pickups
    for (const p of pickups) {
      if (!p.alive) continue;
      const sz = p.drawSize != null ? p.drawSize : PICKUP_DRAW_SIZE;
      if (p.type === PICKUP_TYPES.BURNT) {
        drawHazardMine(p.x, p.y, sz);
      } else {
        const img = images[p.type];
        if (img) {
          if (p.type === PICKUP_TYPES.RED_CUP) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.scale(-1, 1);
            ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
          } else {
            ctx.drawImage(img, p.x - sz / 2, p.y - sz / 2, sz, sz);
          }
        } else {
          ctx.beginPath();
          ctx.fillStyle = "#8B4513";
          ctx.arc(p.x, p.y, gs(20), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    drawMineExplosions();

    // Player — square draw (center crop) matches scene 3 scale for all skins
    const playerImg = images.player;
    const pdw = playerDrawW;
    const pdh = playerDrawH;
    if (playerImg) {
      const cr = getPlayerSourceCrop(playerImg);
      ctx.drawImage(
        playerImg,
        cr.sx,
        cr.sy,
        cr.sw,
        cr.sh,
        playerX - pdw / 2,
        playerY - pdh / 2,
        pdw,
        pdh
      );
    } else {
      const pr = Math.min(pdw, pdh) / 2;
      ctx.beginPath();
      ctx.fillStyle = "#ffdd55";
      ctx.arc(playerX, playerY, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield ring — scales with sprite size
    if (shieldHits > 0) {
      const scaleRing = Math.max(pdw, pdh) / PLAYER_DRAW_SIZE;
      const ringR = SHIELD_RING_R * scaleRing;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(2, SHIELD_LINE_W * scaleRing);
      ctx.arc(playerX, playerY, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (scoreEl) scoreEl.textContent = String(score);
    if (beansEl) beansEl.textContent = String(beans);
    if (bestEl) bestEl.textContent = String(best);
  }

  function loop(timestamp) {
    const dt = Math.min(0.033, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    if (isRunning) update(dt);
    updateMineExplosions(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // Start game when assets are ready
  loadAllAssets()
    .then(() => {
      if (!isRunning && !isGameOver) {
        playerX = Math.max(PLAYER_MIN_X, width * PLAYER_X_RATIO);
        playerY = height * 0.48;
      }
      syncInputStacking();
      // Cycle BG on new run (done in resetWorld)
      requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error("Asset load failed:", err);
      requestAnimationFrame(loop);
    });

  function doResetWorld() {
    resetWorld();
  }

  let lastFlapInputAt = 0;

  function tryFlapFromPointerEvent(e) {
    if (isModalDialogOpen()) return;
    if (isIntroVisible()) return;
    if (e.type === "mousedown" || e.type === "pointerdown") {
      if (e.button != null && e.button !== 0) return;
    }
    let x;
    let y;
    if (e.touches && e.touches.length > 0) {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    } else if (typeof e.clientX === "number" && typeof e.clientY === "number") {
      x = e.clientX;
      y = e.clientY;
    } else {
      return;
    }
    const r = canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    const topEl = document.elementFromPoint(x, y);
    if (topEl && typeof topEl.closest === "function") {
      if (topEl.closest("button") || topEl.closest("a")) return;
    }
    const now = performance.now();
    if (now - lastFlapInputAt < 45) return;
    lastFlapInputAt = now;
    if (e.cancelable) e.preventDefault();
    flap();
  }

  const winFlapOpts = { capture: true, passive: false };
  window.addEventListener("pointerdown", tryFlapFromPointerEvent, winFlapOpts);
  window.addEventListener("mousedown", tryFlapFromPointerEvent, winFlapOpts);
  window.addEventListener("touchstart", tryFlapFromPointerEvent, winFlapOpts);
  if (canvasWrap) {
    canvasWrap.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
  }

  syncInputStacking();

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      if (isModalDialogOpen()) return;
      if (isIntroVisible()) return;
      flap();
    }
  });

  let lastPrimaryAction = 0;
  function onPrimaryOverlayAction(e) {
    const btn = e.currentTarget;
    if (!btn || btn.disabled) return;
    if (!assetsReady) return;
    if (e.type === "pointerdown" && e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastPrimaryAction < 350) return;
    lastPrimaryAction = now;
    doResetWorld();
  }

  function onIntroPlayAction(e) {
    if (!introPlayBtn || introPlayBtn.disabled) return;
    if (!assetsReady) return;
    if (e.type === "pointerdown" && e.button != null && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastPrimaryAction < 350) return;
    lastPrimaryAction = now;
    dismissIntro();
    doResetWorld();
  }

  if (introPlayBtn) {
    introPlayBtn.addEventListener("pointerdown", onIntroPlayAction, { passive: false });
    introPlayBtn.addEventListener("click", onIntroPlayAction);
  }

  for (const btn of [startBtn, playAgainBtn]) {
    if (!btn) continue;
    btn.addEventListener("pointerdown", onPrimaryOverlayAction, { passive: false });
    btn.addEventListener("click", onPrimaryOverlayAction);
  }

  const backBtn = document.getElementById("gameBackBtn");
  if (backBtn) {
    backBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }
  const gameHowToBtn = document.getElementById("gameHowToBtn");
  if (gameHowToBtn) {
    gameHowToBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
  }

  /** Pause play and show intro (shell Back → menu). */
  function returnToMenu() {
    isRunning = false;
    isGameOver = false;
    score = 0;
    beans = 0;
    pipes = [];
    pickups = [];
    mineExplosions = [];
    if (scoreEl) scoreEl.textContent = "0";
    if (beansEl) beansEl.textContent = "0";
    if (bestEl) bestEl.textContent = String(best);
    if (startCardEl) startCardEl.classList.add("hidden");
    if (gameOverCardEl) gameOverCardEl.classList.add("hidden");
    syncGameOverPageClass();
    syncInputStacking();
    if (introSplashEl) {
      introSplashEl.classList.remove("hidden");
      introSplashEl.setAttribute("aria-hidden", "false");
    }
    playerX = Math.max(PLAYER_MIN_X, width * PLAYER_X_RATIO);
    playerY = height * 0.48;
    playerVY = FLAP_VELOCITY * 0.4;
    lastTime = performance.now();
  }

  async function reloadSkinAssets() {
    applySkinFromWindow();
    for (const k of Object.keys(ASSETS_DEFAULT)) {
      delete images[k];
    }
    playerHitRadiusPx = PLAYER_HIT_RADIUS_FALLBACK;
    playerHitOffsetX = 0;
    playerHitOffsetY = 0;
    assetsReady = false;
    if (introPlayBtn) introPlayBtn.disabled = true;
    if (startBtn) startBtn.disabled = true;
    try {
      await loadAllAssets();
    } catch (err) {
      console.error("Skin reload failed:", err);
    }
  }

  window.FrappyBrew = { returnToMenu, reloadSkinAssets };
})();
