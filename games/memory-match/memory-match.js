/**
 * Memory Match — flip cards, match pairs from Slider Puzzle image set (51–100.png).
 * Easy 6 pairs, Medium 8 pairs, Hard 12 pairs. Leaderboard: time then moves.
 */
(function () {
  const PUZZLE_IMAGE_NAMES =
    window.LabPuzzleImages && typeof window.LabPuzzleImages.names === "function"
      ? window.LabPuzzleImages.names()
      : Array.from({ length: 50 }, (_, i) => String(i + 51));
  const ASSET_BASE = "../../assets/";
  const CARD_BACK_SRC = "../../webpageassets/memorymatch.png";

  const DIFFICULTY = {
    easy: { pairs: 6, cols: 3, label: "Easy" },
    medium: { pairs: 8, cols: 4, label: "Medium" },
    hard: { pairs: 12, cols: 4, label: "Hard" },
  };

  const FLIP_BACK_MS = 780;
  const MATCH_CELEBRATE_MS = 420;

  const gridEl = document.getElementById("memory-grid");
  const boardWrap = document.getElementById("board-wrap");
  const movesEl = document.getElementById("moves-display");
  const timerEl = document.getElementById("timer-display");
  const pairsEl = document.getElementById("pairs-display");
  const hintEl = document.getElementById("game-hint");
  const difficultySelect = document.getElementById("difficulty-select");
  const btnNewGame = document.getElementById("btn-new-game");
  const leaderboardModal = document.getElementById("leaderboardModal");
  const leaderboardList = document.getElementById("leaderboardList");

  const submitSection = document.getElementById("memoryLeaderboardSubmitSection");
  const yourScoreEl = document.getElementById("memoryLeaderboardYourScore");
  const nameInput = document.getElementById("memoryLeaderboardNameInput");
  const submitBtn = document.getElementById("memoryLeaderboardSubmitBtn");
  const playAgainBtn = document.getElementById("memoryLeaderboardPlayAgainBtn");
  const submitMsg = document.getElementById("memoryLeaderboardSubmitMsg");

  let difficulty = "easy";
  let cards = [];
  let flippedIndices = [];
  let matchedPairs = 0;
  let totalPairs = DIFFICULTY.easy.pairs;
  let moves = 0;
  let elapsedSeconds = 0;
  let timerId = null;
  let gameStarted = false;
  let isLocked = false;
  let hasSubmittedThisWin = false;
  let hasWon = false;

  function getDifficultyConfig(key) {
    return DIFFICULTY[key] || DIFFICULTY.easy;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function renderLbRows(container, rows) {
    var ui = window.LabsLeaderboardUI;
    if (ui && typeof ui.renderLeaderboardList === "function") {
      ui.renderLeaderboardList(container, rows, {
        mode: "time-moves",
        emptyMessage: "No scores yet. Complete a game to add one.",
        highlightTop3: true,
      });
      return;
    }
    if (container) {
      container.innerHTML =
        '<p class="leaderboard-unavailable">Leaderboard UI unavailable.</p>';
    }
  }

  function getStoredLbName() {
    var ui = window.LabsLeaderboardUI;
    if (ui && typeof ui.getStoredPlayerName === "function") {
      return ui.getStoredPlayerName(30);
    }
    return localStorage.getItem("lo_player_name") || "";
  }

  function saveLbName(name) {
    var ui = window.LabsLeaderboardUI;
    if (ui && typeof ui.setStoredPlayerName === "function") {
      ui.setStoredPlayerName(name, 30);
      return;
    }
    localStorage.setItem("lo_player_name", name);
  }

  function startTimer() {
    if (timerId) return;
    timerId = setInterval(function () {
      elapsedSeconds++;
      if (timerEl) timerEl.textContent = "Time: " + formatTime(elapsedSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function updateStats() {
    if (movesEl) movesEl.textContent = "Moves: " + moves;
    if (pairsEl) pairsEl.textContent = "Pairs: " + matchedPairs + "/" + totalPairs;
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function pickImageIds(count) {
    return shuffle(PUZZLE_IMAGE_NAMES).slice(0, count);
  }

  function imageSrc(imageId) {
    return ASSET_BASE + imageId + ".png";
  }

  function buildDeck() {
    const config = getDifficultyConfig(difficulty);
    totalPairs = config.pairs;
    matchedPairs = 0;
    moves = 0;
    flippedIndices = [];
    gameStarted = false;
    isLocked = false;
    hasWon = false;
    hasSubmittedThisWin = false;

    const imageIds = pickImageIds(config.pairs);
    const deck = [];
    imageIds.forEach(function (imageId, pairIndex) {
      deck.push({ uid: pairIndex + "-a", pairId: pairIndex, imageId: imageId, matched: false });
      deck.push({ uid: pairIndex + "-b", pairId: pairIndex, imageId: imageId, matched: false });
    });
    cards = shuffle(deck);
    updateStats();
    if (timerEl) timerEl.textContent = "Time: 0:00";
    if (hintEl) hintEl.textContent = "Flip two cards at a time. Match every pair to win.";
  }

  function renderGrid() {
    if (!gridEl) return;
    const config = getDifficultyConfig(difficulty);
    gridEl.style.setProperty("--mm-cols", String(config.cols));
    gridEl.innerHTML = "";

    cards.forEach(function (card, index) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "memory-match__card";
      btn.dataset.index = String(index);
      btn.setAttribute("role", "gridcell");
      btn.setAttribute("aria-label", "Hidden card " + (index + 1));

      const inner = document.createElement("span");
      inner.className = "memory-match__card-inner";

      const back = document.createElement("span");
      back.className = "memory-match__face memory-match__face--back";
      back.setAttribute("aria-hidden", "true");
      const backImg = document.createElement("img");
      backImg.src = CARD_BACK_SRC;
      backImg.alt = "";
      backImg.loading = "eager";
      backImg.decoding = "async";
      back.appendChild(backImg);

      const front = document.createElement("span");
      front.className = "memory-match__face memory-match__face--front";
      const img = document.createElement("img");
      img.src = imageSrc(card.imageId);
      img.alt = "";
      img.loading = "eager";
      img.decoding = "async";
      front.appendChild(img);

      inner.appendChild(back);
      inner.appendChild(front);
      btn.appendChild(inner);
      btn.addEventListener("click", function () {
        onCardClick(index);
      });

      gridEl.appendChild(btn);
    });
  }

  function cardButton(index) {
    return gridEl && gridEl.querySelector('.memory-match__card[data-index="' + index + '"]');
  }

  function setCardFlipped(index, flipped) {
    const btn = cardButton(index);
    if (!btn) return;
    btn.classList.toggle("is-flipped", !!flipped);
    btn.setAttribute("aria-pressed", flipped ? "true" : "false");
    if (flipped && !cards[index].matched) {
      btn.setAttribute("aria-label", "Revealed card " + (index + 1));
    } else if (!cards[index].matched) {
      btn.setAttribute("aria-label", "Hidden card " + (index + 1));
    }
  }

  function setCardMatched(index) {
    const btn = cardButton(index);
    if (!btn) return;
    btn.classList.add("is-flipped", "is-matched");
    btn.disabled = true;
    btn.setAttribute("aria-label", "Matched pair");
  }

  function onCardClick(index) {
    if (isLocked || hasWon) return;
    const card = cards[index];
    if (!card || card.matched) return;
    if (flippedIndices.indexOf(index) !== -1) return;
    if (flippedIndices.length >= 2) return;

    if (!gameStarted) {
      gameStarted = true;
      elapsedSeconds = 0;
      startTimer();
      if (hintEl) hintEl.textContent = "Keep going — remember where each picture was!";
    }

    flippedIndices.push(index);
    setCardFlipped(index, true);

    if (flippedIndices.length < 2) return;

    moves++;
    updateStats();
    isLocked = true;

    const first = flippedIndices[0];
    const second = flippedIndices[1];
    const firstCard = cards[first];
    const secondCard = cards[second];

    if (firstCard.pairId === secondCard.pairId) {
      window.setTimeout(function () {
        firstCard.matched = true;
        secondCard.matched = true;
        setCardMatched(first);
        setCardMatched(second);
        matchedPairs++;
        updateStats();
        flippedIndices = [];
        isLocked = false;

        if (matchedPairs >= totalPairs) {
          onWin();
        }
      }, MATCH_CELEBRATE_MS);
      return;
    }

    window.setTimeout(function () {
      setCardFlipped(first, false);
      setCardFlipped(second, false);
      flippedIndices = [];
      isLocked = false;
    }, FLIP_BACK_MS);
  }

  function hideWin() {
    if (leaderboardModal) leaderboardModal.classList.add("hidden");
    if (submitSection) submitSection.classList.add("hidden");
  }

  async function loadLeaderboard(diffKey) {
    if (!leaderboardList) return;
    if (window.LabsLeaderboardUI) {
      window.LabsLeaderboardUI.setDifficultyTabs(diffKey);
    }

    if (typeof window.getLeaderboard !== "function") {
      leaderboardList.innerHTML =
        '<p class="leaderboard-unavailable">Leaderboard unavailable. Open via http(s):// and check the console (F12).</p>';
      return;
    }

    try {
      const scores = await window.getLeaderboard(diffKey);
      renderLbRows(leaderboardList, scores);
    } catch (_) {
      leaderboardList.innerHTML =
        '<p class="leaderboard-unavailable">Could not load leaderboard.</p>';
    }
  }

  async function openWinModal() {
    if (!leaderboardModal) return;
    hasSubmittedThisWin = false;
    leaderboardModal.classList.remove("hidden");
    if (submitSection) submitSection.classList.remove("hidden");
    if (yourScoreEl) {
      yourScoreEl.textContent =
        "Your time: " + formatTime(elapsedSeconds) + " • Moves: " + moves;
    }
    if (nameInput) {
      nameInput.value = getStoredLbName();
      nameInput.disabled = false;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit score";
    }
    if (playAgainBtn) playAgainBtn.disabled = false;
    if (submitMsg) submitMsg.textContent = "";
    if (hintEl) hintEl.textContent = "Nice work — submit your score or play again!";
    await loadLeaderboard(difficulty);
    if (nameInput) nameInput.focus();
  }

  function onWin() {
    hasWon = true;
    stopTimer();
    openWinModal();
  }

  async function submitWinScore() {
    if (hasSubmittedThisWin) return;
    const name = (nameInput && nameInput.value.trim()) || "Player";
    if (typeof window.submitScore !== "function") {
      if (submitMsg) {
        submitMsg.textContent = window.leaderboardBridgeError
          ? "Leaderboard script failed to load. Check the browser console (F12)."
          : "Leaderboard unavailable.";
      }
      return;
    }

    hasSubmittedThisWin = true;
    if (nameInput) nameInput.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    if (playAgainBtn) playAgainBtn.disabled = true;
    if (submitMsg) submitMsg.textContent = "Saving…";

    try {
      await window.submitScore(name, difficulty, elapsedSeconds, moves);
      saveLbName(name);
      if (submitMsg) submitMsg.textContent = "Score saved on this device!";
      await loadLeaderboard(difficulty);
    } catch (_) {
      hasSubmittedThisWin = false;
      if (nameInput) nameInput.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      if (playAgainBtn) playAgainBtn.disabled = false;
      if (submitMsg) submitMsg.textContent = "Could not save score. Try again.";
    }
  }

  function resetAndDeal() {
    stopTimer();
    elapsedSeconds = 0;
    hideWin();
    buildDeck();
    renderGrid();
  }

  if (difficultySelect) {
    difficultySelect.addEventListener("change", function () {
      if (isLocked && !hasWon) return;
      difficulty = difficultySelect.value || "easy";
      resetAndDeal();
    });
  }

  if (btnNewGame) {
    btnNewGame.addEventListener("click", function () {
      if (isLocked && !hasWon) return;
      resetAndDeal();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      submitWinScore();
    });
  }

  if (playAgainBtn) {
    playAgainBtn.addEventListener("click", function () {
      resetAndDeal();
    });
  }

  document.getElementById("leaderboardBtn")?.addEventListener("click", function () {
    if (submitSection) submitSection.classList.add("hidden");
    leaderboardModal?.classList.remove("hidden");
    loadLeaderboard(difficulty);
  });

  document.getElementById("closeLeaderboard")?.addEventListener("click", function () {
    hideWin();
  });

  document.querySelectorAll(".leaderboard-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      loadLeaderboard(btn.dataset.diff || "easy");
    });
  });

  leaderboardModal?.addEventListener("click", function (e) {
    if (e.target === leaderboardModal) hideWin();
  });

  buildDeck();
  renderGrid();
})();
