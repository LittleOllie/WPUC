/**
 * Slider Puzzle – Web. Classic sliding tile puzzle with image sliced by difficulty.
 * Easy 3×3, Medium 4×4, Hard 5×5. Shuffle in empty tile. Leaderboard via window.submitScore / getLeaderboard.
 */
(function () {
  const TILE_GAP = 2;
  const TILE_RADIUS = 12;
  const BOARD_BG = "#6DE0FF";

  function shuffleStepsForSize(size) {
    switch (size) {
      case 3: return 72;
      case 4: return 120;
      default: return 180;
    }
  }
  const PUZZLE_IMAGE_NAMES = Array.from({ length: 100 }, (_, i) => String(i + 1));

  const canvas = document.getElementById("puzzle-canvas");
  const boardWrap = document.getElementById("puzzle-board-wrap");
  const movesEl = document.getElementById("moves-display");
  const timerEl = document.getElementById("timer-display");
  const btnNewImage = document.getElementById("btn-new-image");
  const difficultySelect = document.getElementById("difficulty-select");
  const leaderboardModal = document.getElementById("leaderboardModal");
  const leaderboardList = document.getElementById("leaderboardList");

  let gridSize = 3;
  let tiles = [];
  let moves = 0;
  let elapsedSeconds = 0;
  let timerId = null;
  let currentImage = "1";
  let isUploadedImage = false;
  let isShuffling = false;
  let gameStarted = false;
  let puzzleImage = null;
  let boardPixelSize = 320;

  function getSolvedState() {
    const n = gridSize * gridSize;
    return Array.from({ length: n - 1 }, (_, i) => i + 1).concat(0);
  }

  function indexOfBlank() {
    return tiles.findIndex((v) => v === 0);
  }

  function row(i) {
    return Math.floor(i / gridSize);
  }
  function col(i) {
    return i % gridSize;
  }

  function isAdjacent(a, b) {
    return Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b)) === 1;
  }

  function adjacentIndices(idx) {
    const r = row(idx);
    const c = col(idx);
    const out = [];
    if (r > 0) out.push((r - 1) * gridSize + c);
    if (r < gridSize - 1) out.push((r + 1) * gridSize + c);
    if (c > 0) out.push(r * gridSize + (c - 1));
    if (c < gridSize - 1) out.push(r * gridSize + (c + 1));
    return out;
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(function () {
      elapsedSeconds++;
      if (timerEl) timerEl.textContent = "⏱ TIME: " + formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function updateMoves() {
    if (movesEl) movesEl.textContent = "🔄 MOVES: " + moves;
  }

  function loadImage(src, callback) {
    const img = new Image();
    img.onload = function () {
      callback(null, img);
    };
    img.onerror = function () {
      callback(new Error("Failed to load " + src));
    };
    img.src = src;
  }

  function drawBoard() {
    if (!canvas || !tiles.length) return;
    const ctx = canvas.getContext("2d");
    const n = gridSize * gridSize;
    const cellSize = (boardPixelSize - TILE_GAP * (gridSize + 1)) / gridSize;
    const radius = Math.min(TILE_RADIUS, Math.max(8, cellSize * 0.12));

    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(0, 0, boardPixelSize, boardPixelSize);

    if (puzzleImage && puzzleImage.complete && puzzleImage.naturalWidth) {
      const imgW = puzzleImage.naturalWidth;
      const imgH = puzzleImage.naturalHeight;
      const cropSize = Math.min(imgW, imgH);
      const offsetX = (imgW - cropSize) / 2;
      const offsetY = (imgH - cropSize) / 2;
      const sliceW = cropSize / gridSize;
      const sliceH = cropSize / gridSize;
      const scale = Math.max(cellSize / sliceW, cellSize / sliceH);
      const drawW = sliceW * scale;
      const drawH = sliceH * scale;

      for (let i = 0; i < n; i++) {
        const value = tiles[i];
        const dx = TILE_GAP + col(i) * (cellSize + TILE_GAP);
        const dy = TILE_GAP + row(i) * (cellSize + TILE_GAP);
        if (value === 0) continue;
        const idx = value - 1;
        const sr = Math.floor(idx / gridSize);
        const sc = idx % gridSize;
        const sx = offsetX + sc * sliceW;
        const sy = offsetY + sr * sliceH;
        const drawOffsetX = (cellSize - drawW) / 2;
        const drawOffsetY = (cellSize - drawH) / 2;

        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(dx, dy, cellSize, cellSize, radius);
        } else {
          ctx.rect(dx, dy, cellSize, cellSize);
        }
        ctx.clip();
        ctx.drawImage(
          puzzleImage,
          sx, sy, sliceW, sliceH,
          dx + drawOffsetX, dy + drawOffsetY, drawW, drawH
        );
        ctx.restore();
      }
      if (!gameStarted && !isShuffling) {
        const blankIdx = tiles.indexOf(0);
        if (blankIdx >= 0) {
          const dx = TILE_GAP + col(blankIdx) * (cellSize + TILE_GAP);
          const dy = TILE_GAP + row(blankIdx) * (cellSize + TILE_GAP);
          ctx.fillStyle = "rgba(255, 221, 85, 0.95)";
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(dx, dy, cellSize, cellSize, radius);
          } else {
            ctx.rect(dx, dy, cellSize, cellSize);
          }
          ctx.fill();
          ctx.fillStyle = "#1a1a2e";
          ctx.font = "bold " + Math.max(12, Math.min(18, Math.floor(cellSize * 0.22))) + "px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("SHUFFLE", dx + cellSize / 2, dy + cellSize / 2);
        }
      }
    } else {
      ctx.font = "14px Fredoka, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < n; i++) {
        const value = tiles[i];
        const dx = TILE_GAP + col(i) * (cellSize + TILE_GAP);
        const dy = TILE_GAP + row(i) * (cellSize + TILE_GAP);
        const cx = dx + cellSize / 2;
        const cy = dy + cellSize / 2;
        if (value === 0) continue;
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(dx, dy, cellSize, cellSize, radius);
        } else {
          ctx.rect(dx, dy, cellSize, cellSize);
        }
        ctx.clip();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(dx, dy, cellSize, cellSize);
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.fillText(String(value), cx, cy);
      }
    }
  }

  function resizeCanvas() {
    if (!canvas || !boardWrap) return;
    const rect = boardWrap.getBoundingClientRect();
    const maxW = Math.min(520, window.innerWidth - 32);
    const size = Math.min(rect.width || maxW, maxW);
    if (size <= 0) return;
    boardPixelSize = size;
    canvas.width = size;
    canvas.height = size;
    drawBoard();
  }

  function getClickIndex(clientX, clientY) {
    if (!boardWrap || !tiles.length) return -1;
    const rect = boardWrap.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scale = rect.width / boardPixelSize;
    const localX = x / scale;
    const localY = y / scale;
    const cellSize = (boardPixelSize - TILE_GAP * (gridSize + 1)) / gridSize;
    const colIdx = Math.floor((localX - TILE_GAP) / (cellSize + TILE_GAP));
    const rowIdx = Math.floor((localY - TILE_GAP) / (cellSize + TILE_GAP));
    if (rowIdx < 0 || rowIdx >= gridSize || colIdx < 0 || colIdx >= gridSize) return -1;
    const index = rowIdx * gridSize + colIdx;
    return index >= 0 && index < tiles.length ? index : -1;
  }

  function onCanvasClick(e) {
    if (isShuffling) return;
    const index = getClickIndex(e.clientX, e.clientY);
    if (index < 0) return;
    if (!gameStarted) {
      if (tiles[index] === 0) {
        gameStarted = true;
        shufflePuzzle(function () {});
      }
      return;
    }
    if (tiles[index] === 0) return;
    const blank = indexOfBlank();
    if (!isAdjacent(index, blank)) return;

    tiles[blank] = tiles[index];
    tiles[index] = 0;
    moves++;
    updateMoves();
    startTimer();
    drawBoard();

    const sol = getSolvedState();
    if (tiles.length === sol.length && tiles.every((v, i) => v === sol[i])) {
      stopTimer();
      openLeaderboardAfterWin();
    }
  }

  const sliderSubmitSection = document.getElementById("sliderLeaderboardSubmitSection");
  const sliderYourScoreEl = document.getElementById("sliderLeaderboardYourScore");
  const sliderNameInput = document.getElementById("sliderLeaderboardNameInput");
  const sliderSubmitBtn = document.getElementById("sliderLeaderboardSubmitBtn");
  const sliderPlayAgainBtn = document.getElementById("sliderLeaderboardPlayAgainBtn");
  const sliderSubmitMsg = document.getElementById("sliderLeaderboardSubmitMsg");
  let hasSubmittedThisWin = false;

  async function openLeaderboardAfterWin() {
    if (!leaderboardModal) return;
    hasSubmittedThisWin = false;
    leaderboardModal.classList.remove("hidden");
    if (sliderSubmitSection) sliderSubmitSection.classList.remove("hidden");
    if (sliderYourScoreEl)
      sliderYourScoreEl.textContent = "YOUR TIME: " + formatTime(elapsedSeconds) + " • MOVES: " + moves;
    if (sliderNameInput) {
      sliderNameInput.value = localStorage.getItem("lo_player_name") || "";
      sliderNameInput.disabled = false;
    }
    if (sliderSubmitBtn) {
      sliderSubmitBtn.disabled = false;
      sliderSubmitBtn.textContent = "SUBMIT SCORE";
    }
    if (sliderPlayAgainBtn) sliderPlayAgainBtn.disabled = false;
    if (sliderSubmitMsg) sliderSubmitMsg.textContent = "";
    var diff = getDifficultyKey();
    try {
      if (typeof window.getLeaderboard === "function") {
        var list = await window.getLeaderboard(diff);
        if (leaderboardList) {
          leaderboardList.innerHTML = "";
          list.forEach(function (score, i) {
            var row = document.createElement("div");
            var rankClass = "leaderboard-popup-row";
            if (i === 0) rankClass += " rank-gold";
            else if (i === 1) rankClass += " rank-silver";
            else if (i === 2) rankClass += " rank-bronze";
            row.className = rankClass;
            var rankSpan = document.createElement("span");
            rankSpan.className = "leaderboard-popup-rank";
            rankSpan.textContent = "#" + (i + 1);
            var nameSpan = document.createElement("span");
            nameSpan.className = "leaderboard-popup-name";
            nameSpan.textContent = score.playerName || "—";
            var scoreSpan = document.createElement("span");
            scoreSpan.className = "leaderboard-popup-score";
            scoreSpan.textContent = (score.timeSeconds ?? "—") + "s • " + (score.moves ?? "—") + " moves";
            row.appendChild(rankSpan);
            row.appendChild(nameSpan);
            row.appendChild(scoreSpan);
            leaderboardList.appendChild(row);
          });
        }
      }
    } catch (e) {}
    if (sliderNameInput) sliderNameInput.focus();
  }

  function hideWin() {
    if (leaderboardModal) leaderboardModal.classList.add("hidden");
    if (sliderSubmitSection) sliderSubmitSection.classList.add("hidden");
  }

  function generateValidBlankSwaps(steps) {
    const sol = getSolvedState();
    let temp = sol.slice();
    let lastBlank = -1;
    const swaps = [];

    for (let s = 0; s < steps; s++) {
      const b = temp.indexOf(0);
      let neighbors = adjacentIndices(b);
      if (lastBlank >= 0 && neighbors.length > 1) {
        neighbors = neighbors.filter((n) => n !== lastBlank);
        if (neighbors.length === 0) neighbors = adjacentIndices(b);
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      swaps.push({ blank: b, swapWith: pick });
      const t = temp[b];
      temp[b] = temp[pick];
      temp[pick] = t;
      lastBlank = pick;
    }

    if (temp.every((v, i) => v === sol[i])) {
      return swaps.concat(generateValidBlankSwaps(10));
    }
    return swaps;
  }

  function shufflePuzzle(callback) {
    isShuffling = true;
    tiles = getSolvedState().slice();
    const steps = shuffleStepsForSize(gridSize);
    const swaps = generateValidBlankSwaps(steps);
    let step = 0;

    function runStep() {
      if (step >= swaps.length) {
        moves = 0;
        updateMoves();
        isShuffling = false;
        drawBoard();
        if (typeof callback === "function") callback();
        return;
      }
      const { blank, swapWith } = swaps[step];
      const t = tiles[blank];
      tiles[blank] = tiles[swapWith];
      tiles[swapWith] = t;
      step++;
      drawBoard();
      setTimeout(runStep, 35);
    }
    runStep();
  }

  function resetGame() {
    stopTimer();
    elapsedSeconds = 0;
    moves = 0;
    if (timerEl) timerEl.textContent = "⏱ TIME: 0:00";
    updateMoves();
    hideWin();
  }

  function getDifficultyKey() {
    if (gridSize === 3) return "easy";
    if (gridSize === 4) return "medium";
    return "hard";
  }

  async function submitWinScore() {
    if (hasSubmittedThisWin) return;
    const name = (sliderNameInput && sliderNameInput.value.trim()) || "Player";
    if (typeof window.submitScore !== "function") {
      if (sliderSubmitMsg) {
        sliderSubmitMsg.textContent = window.leaderboardBridgeError
          ? "Leaderboard script failed to load. Open the page via a web server and check the browser console (F12)."
          : "Leaderboard unavailable. Open via http(s):// and check console (F12).";
      }
      return;
    }
    const difficulty = getDifficultyKey();
    const timeSeconds = elapsedSeconds;
    const moveCount = moves;
    hasSubmittedThisWin = true;
    if (sliderNameInput) sliderNameInput.disabled = true;
    if (sliderSubmitBtn) sliderSubmitBtn.disabled = true;
    if (sliderPlayAgainBtn) sliderPlayAgainBtn.disabled = true;
    if (sliderSubmitMsg) sliderSubmitMsg.textContent = "Saving…";
    try {
      await window.submitScore(name, difficulty, timeSeconds, moveCount);
      localStorage.setItem("lo_player_name", name);
      if (sliderSubmitMsg) sliderSubmitMsg.textContent = "Score saved to leaderboard!";
    } catch (err) {
      hasSubmittedThisWin = false;
      if (sliderNameInput) sliderNameInput.disabled = false;
      if (sliderSubmitBtn) sliderSubmitBtn.disabled = false;
      if (sliderPlayAgainBtn) sliderPlayAgainBtn.disabled = false;
      if (sliderSubmitMsg) sliderSubmitMsg.textContent = "Could not save score. Try again.";
    }
  }

  function setDifficulty(size) {
    if (size === gridSize) return;
    gridSize = size;
    if (difficultySelect) difficultySelect.value = size;
  }

  function initPuzzle() {
    if (!canvas || !boardWrap) return;
    resetGame();
    gameStarted = false;
    tiles = getSolvedState().slice();
    resizeCanvas();
    drawBoard();
  }

  function getImageSrc() {
    return typeof currentImage === "string" && currentImage.startsWith("data:")
      ? currentImage
      : "assets/" + currentImage + ".png";
  }

  function runWithImage() {
    loadImage(getImageSrc(), function (err, img) {
      puzzleImage = img || null;
      initPuzzle();
    });
  }

  if (difficultySelect) {
    difficultySelect.addEventListener("change", function () {
      if (isShuffling) return;
      const size = parseInt(difficultySelect.value, 10);
      setDifficulty(size);
      runWithImage();
    });
  }

  if (btnNewImage) {
    btnNewImage.addEventListener("click", function () {
      if (isShuffling) return;
      isUploadedImage = false;
      currentImage =
        PUZZLE_IMAGE_NAMES[
          Math.floor(Math.random() * PUZZLE_IMAGE_NAMES.length)
        ];
      runWithImage();
    });
  }

  const uploadImageBtn = document.getElementById("uploadImageBtn");
  const imageUpload = document.getElementById("imageUpload");
  if (uploadImageBtn && imageUpload) {
    uploadImageBtn.addEventListener("click", function () {
      imageUpload.click();
    });
    imageUpload.addEventListener("change", function () {
      const file = imageUpload.files && imageUpload.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = function (e) {
        isUploadedImage = true;
        currentImage = e.target.result;
        runWithImage();
      };
      reader.readAsDataURL(file);
      imageUpload.value = "";
    });
  }

  if (sliderPlayAgainBtn) {
    sliderPlayAgainBtn.addEventListener("click", function () {
      hideWin();
      resetGame();
      initPuzzle();
    });
  }

  if (sliderSubmitBtn) {
    sliderSubmitBtn.addEventListener("click", function () {
      submitWinScore();
    });
  }

  document.getElementById("leaderboardBtn")?.addEventListener("click", function () {
    if (sliderSubmitSection) sliderSubmitSection.classList.add("hidden");
    leaderboardModal?.classList.remove("hidden");
    loadLeaderboard(getDifficultyKey());
  });

  document.getElementById("closeLeaderboard")?.addEventListener("click", function () {
    leaderboardModal?.classList.add("hidden");
  });

  document.querySelectorAll(".leaderboard-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      loadLeaderboard(btn.dataset.diff);
    });
  });

  async function loadLeaderboard(difficulty) {
    if (!leaderboardList) return;
    if (typeof window.getLeaderboard !== "function") {
      var msg = "Leaderboard unavailable. Open the page via a web server (http:// or https://), not as a file. Check the browser console (F12) for errors.";
      leaderboardList.innerHTML = "<p class=\"leaderboard-unavailable\">" + msg + "</p>";
      return;
    }
    try {
      const scores = await window.getLeaderboard(difficulty);
      leaderboardList.innerHTML = "";
      scores.forEach(function (score, i) {
        const row = document.createElement("div");
        let rankClass = "leaderboard-popup-row";
        if (i === 0) rankClass += " rank-gold";
        else if (i === 1) rankClass += " rank-silver";
        else if (i === 2) rankClass += " rank-bronze";
        row.className = rankClass;
        const rankSpan = document.createElement("span");
        rankSpan.className = "leaderboard-popup-rank";
        rankSpan.textContent = "#" + (i + 1);
        const nameSpan = document.createElement("span");
        nameSpan.className = "leaderboard-popup-name";
        nameSpan.textContent = score.playerName || "—";
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "leaderboard-popup-score";
        scoreSpan.textContent = (score.timeSeconds ?? "—") + "s • " + (score.moves ?? "—") + " moves";
        row.appendChild(rankSpan);
        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        leaderboardList.appendChild(row);
      });
    } catch (err) {
      leaderboardList.innerHTML = "<p class=\"leaderboard-unavailable\">Could not load leaderboard.</p>";
    }
  }

  if (canvas) {
    canvas.addEventListener("click", onCanvasClick);
    canvas.addEventListener("touchstart", function (e) {
      e.preventDefault();
      const t = e.touches[0];
      if (t) onCanvasClick({ clientX: t.clientX, clientY: t.clientY });
    }, { passive: false });
  }

  window.addEventListener("resize", resizeCanvas);

  window.initPuzzle = initPuzzle;
  window.onload = function () {
    currentImage =
      PUZZLE_IMAGE_NAMES[
        Math.floor(Math.random() * PUZZLE_IMAGE_NAMES.length)
      ];
    if (difficultySelect) gridSize = parseInt(difficultySelect.value, 10) || 3;
    runWithImage();
    setTimeout(resizeCanvas, 50);
  };
})();
