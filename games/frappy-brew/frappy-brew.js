// Frappy Brew – web port from Swift (FrappyBrewEngine + FrappyBrewView)
// Uses all assets from ARCADE GAMES/CURRENT FINAL VERSION/Shared/Assets.xcassets

(() => {
  const canvas = document.getElementById("gameCanvas");
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

  let width = 480;
  let height = 640;

  // Asset paths (from Assets.xcassets – frappy_*)
  const ASSETS = {
    player: "assets/player.png",
    bean: "assets/bean.png",
    bean_golden: "assets/bean_golden.png",
    cup_red: "assets/cup_red.png",
    bean_burnt: "assets/bean_burnt.png",
    bg1: "assets/bg1.png",
    bg2: "assets/bg2.png",
    bg3: "assets/bg3.png",
    bg4: "assets/bg4.png",
    pillar_cup: "assets/pillar_cup.png",
  };

  const BG_NAMES = ["bg1", "bg2", "bg3", "bg4"];
  let bgIndex = 0;
  const images = {};

  // Match FrappyBrewEngine constants
  const GRAVITY = 1050;
  const FLAP_VELOCITY = -430;
  const SCROLL_SPEED = 260;
  const PIPE_GAP = 210;
  const PIPE_WIDTH = 86;
  const PIPE_SPACING = 280;
  const MARGIN_TOP = 70;
  const MARGIN_BOTTOM = 70;
  const PLAYER_X_RATIO = 0.28;
  const PLAYER_SIZE = 62;
  const HITBOX_SCALE = 0.72;
  const BURNT_PENALTY = 2;
  const GRACE_DURATION = 1.2; // seconds

  // View sizes (FrappyBrewView)
  const PLAYER_DRAW_SIZE = 94;
  const PICKUP_DRAW_SIZE = 56;
  const PILLAR_CUP_WIDTH_MULT = 3.0;
  const PILLAR_CUP_ASPECT = 1.10;

  const PICKUP_TYPES = {
    BEAN: "bean",
    GOLDEN: "bean_golden",
    RED_CUP: "cup_red",
    BURNT: "bean_burnt",
  };

  let playerX = 0;
  let playerY = 0;
  let playerVY = 0;
  let pipes = [];
  let pickups = [];

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

  function loadImage(key) {
    const path = ASSETS[key];
    if (!path) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        resolve();
      };
      img.onerror = () => reject(new Error("Failed to load " + path));
      img.src = path;
    });
  }

  function loadAllAssets() {
    return Promise.all(Object.keys(ASSETS).map(loadImage)).then(() => {
      assetsReady = true;
      if (loadingTextEl) loadingTextEl.style.display = "none";
      if (readyTitleEl) readyTitleEl.style.display = "block";
      if (readyDescEl) readyDescEl.style.display = "block";
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "Start";
      }
    });
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
    if (!isRunning && !isGameOver) {
      playerX = Math.max(44, width * PLAYER_X_RATIO);
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
    playerX = Math.max(44, width * PLAYER_X_RATIO);
    playerY = height * 0.48;
    playerVY = FLAP_VELOCITY * 0.4;

    pipes = [];
    pickups = [];

    // Seed pipes offscreen (match Swift)
    const startX = width + 220;
    for (let i = 0; i < 3; i++) {
      spawnPipe(startX + i * PIPE_SPACING);
    }

    lastTime = performance.now();
    overlayEl.style.pointerEvents = "none";
    startCardEl.classList.add("hidden");
    gameOverCardEl.classList.add("hidden");
  }

  function spawnPipe(x) {
    const minY = MARGIN_TOP + PIPE_GAP / 2;
    const maxY = height - MARGIN_BOTTOM - PIPE_GAP / 2;
    const centerY = minY + Math.random() * (maxY - minY);
    pipes.push({ x, gapCenterY: centerY, scored: false });

    const roll = Math.random();
    let type;
    if (roll < 0.65) type = PICKUP_TYPES.BEAN;
    else if (roll < 0.78) type = PICKUP_TYPES.GOLDEN;
    else if (roll < 0.9) type = PICKUP_TYPES.RED_CUP;
    else type = PICKUP_TYPES.BURNT;

    const py = clamp(centerY + randomRange(-70, 70), 60, height - 60);
    const px = x + PIPE_WIDTH + 70;
    pickups.push({ type, x: px, y: py, alive: true });
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function randomRange(a, b) {
    return a + Math.random() * (b - a);
  }

  function playerHitbox() {
    const w = PLAYER_SIZE * HITBOX_SCALE;
    const h = PLAYER_SIZE * HITBOX_SCALE;
    return {
      x: playerX - w / 2,
      y: playerY - h / 2,
      w,
      h,
    };
  }

  function rectsIntersect(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
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
        break;
      case PICKUP_TYPES.RED_CUP:
        shieldHits = Math.min(1, shieldHits + 1);
        score += 1;
        break;
      case PICKUP_TYPES.BURNT:
        if (shieldHits > 0) {
          shieldHits = 0;
        } else {
          score = Math.max(0, score - BURNT_PENALTY);
        }
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

  function endGame() {
    isRunning = false;
    isGameOver = true;
    overlayEl.style.pointerEvents = "auto";
    gameOverCardEl.classList.remove("hidden");
    startCardEl.classList.add("hidden");
    summaryTextEl.textContent = `Score ${score} • Beans ${beans} • Best ${best}`;
  }

  function flap() {
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

    const floor = height - 18;
    const now = performance.now() / 1000;

    if (playerY > floor) {
      if (now < graceUntil) {
        playerY = floor;
        playerVY = FLAP_VELOCITY * 0.4;
      } else {
        hitAndMaybeDie();
        return;
      }
    }
    if (playerY < 18) {
      playerY = 18;
      playerVY = 0;
    }

    for (const p of pipes) {
      p.x -= SCROLL_SPEED * dt;
    }
    for (const p of pickups) {
      p.x -= SCROLL_SPEED * dt;
    }

    const rightMost = pipes.reduce((m, p) => Math.max(m, p.x), -Infinity);
    if (rightMost < width + 240) {
      spawnPipe(rightMost + PIPE_SPACING);
    }

    pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -220);
    pickups = pickups.filter((p) => p.x > -240 && p.alive);

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

    const hb = playerHitbox();
    for (const p of pipes) {
      const gapHalf = PIPE_GAP / 2;
      const topH = Math.max(0, p.gapCenterY - gapHalf);
      const botY = Math.min(height, p.gapCenterY + gapHalf);
      const botH = Math.max(0, height - botY);
      const topRect = { x: p.x, y: 0, w: PIPE_WIDTH, h: topH };
      const botRect = { x: p.x, y: botY, w: PIPE_WIDTH, h: botH };
      if (rectsIntersect(hb, topRect) || rectsIntersect(hb, botRect)) {
        if (now >= graceUntil) {
          hitAndMaybeDie();
          return;
        }
      }
    }

    for (const p of pickups) {
      if (!p.alive) continue;
      const pr = { x: p.x - 22, y: p.y - 22, w: 44, h: 44 };
      if (rectsIntersect(hb, pr)) {
        handlePickup(p.type);
        p.alive = false;
      }
    }
  }

  // Draw tiled pillar (match FrappyBrewView tiledCupPillar: cupW = rect.width*3, cupH = cupW*1.10)
  function drawTiledPillar(rect, anchorToTop) {
    const img = images.pillar_cup;
    if (!img) {
      ctx.fillStyle = "#3e7c15";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      return;
    }
    const cupW = rect.w * PILLAR_CUP_WIDTH_MULT;
    const cupH = cupW * PILLAR_CUP_ASPECT;
    const count = Math.max(1, Math.floor(rect.h / cupH));
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

  function draw() {

    // Background: use one of 4 BGs (match View bgNames)
    const bgKey = BG_NAMES[bgIndex % BG_NAMES.length];
    const bgImg = images[bgKey];
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, width, height);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "rgba(0,0,0,0.10)";
      ctx.fillRect(0, 0, width, height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#78d0ff");
      grad.addColorStop(1, "#4caf50");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // Pipes as tiled cup pillars
    for (const p of pipes) {
      const gapHalf = PIPE_GAP / 2;
      const topH = Math.max(0, p.gapCenterY - gapHalf);
      const botY = Math.min(height, p.gapCenterY + gapHalf);
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

    // Pickups (56x56, match View)
    for (const p of pickups) {
      if (!p.alive) continue;
      const img = images[p.type];
      const sz = PICKUP_DRAW_SIZE;
      if (img) {
        ctx.drawImage(img, p.x - sz / 2, p.y - sz / 2, sz, sz);
      } else {
        ctx.beginPath();
        ctx.fillStyle = "#8B4513";
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Player (94x94, match View)
    const playerImg = images.player;
    const psz = PLAYER_DRAW_SIZE;
    if (playerImg) {
      ctx.drawImage(playerImg, playerX - psz / 2, playerY - psz / 2, psz, psz);
    } else {
      ctx.beginPath();
      ctx.fillStyle = "#ffdd55";
      ctx.arc(playerX, playerY, psz / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield ring (match View)
    if (shieldHits > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 5;
      ctx.arc(playerX, playerY, 53, 0, Math.PI * 2);
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
    draw();
    requestAnimationFrame(loop);
  }

  // Start game when assets are ready
  loadAllAssets()
    .then(() => {
      if (!isRunning && !isGameOver) {
        playerX = Math.max(44, width * PLAYER_X_RATIO);
        playerY = height * 0.48;
      }
      // Cycle BG on new run (done in resetWorld)
      requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error("Asset load failed:", err);
      requestAnimationFrame(loop);
    });

  // On start: cycle background (match View onChange isRunning)
  function doResetWorld() {
    bgIndex = (bgIndex + 1) % BG_NAMES.length;
    resetWorld();
  }

  // Input
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      e.preventDefault();
      flap();
    },
    { passive: false }
  );

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      flap();
    }
  });

  startBtn.addEventListener("click", () => {
    if (assetsReady) doResetWorld();
  });

  playAgainBtn.addEventListener("click", () => {
    if (assetsReady) doResetWorld();
  });
})();
