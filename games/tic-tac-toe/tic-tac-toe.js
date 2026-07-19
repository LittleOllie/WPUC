(function initTicTacToe() {
  var WIN_LINES = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  var SCORE_KEY = "lo-ttt-scores-v1";
  var RESTART_DELAY_MS = 2400;

  var gridEl = document.getElementById("ttt-grid");
  var winLineEl = document.getElementById("ttt-win-line");
  var statusEl = document.getElementById("status-display");
  var modeSelect = document.getElementById("mode-select");
  var difficultySelect = document.getElementById("difficulty-select");
  var difficultyWrap = document.getElementById("difficulty-wrap");
  var scoreXEl = document.getElementById("score-x");
  var scoreOEl = document.getElementById("score-o");
  var scoreDrawEl = document.getElementById("score-draw");
  var btnNew = document.getElementById("btn-new-game");
  var btnResetScores = document.getElementById("btn-reset-scores");

  if (!gridEl || !statusEl || !modeSelect || !difficultySelect) return;

  var board = Array(9).fill("");
  var current = "X";
  var nextStarter = "X";
  var gameOver = false;
  var winLine = null;
  var restartTimer = null;
  var scores = loadScores();

  function loadScores() {
    try {
      var raw = localStorage.getItem(SCORE_KEY);
      if (!raw) return { x: 0, o: 0, draw: 0 };
      var parsed = JSON.parse(raw);
      return {
        x: Number(parsed.x) || 0,
        o: Number(parsed.o) || 0,
        draw: Number(parsed.draw) || 0,
      };
    } catch (err) {
      return { x: 0, o: 0, draw: 0 };
    }
  }

  function saveScores() {
    try {
      localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
    } catch (err) {
      /* ignore */
    }
  }

  function isCpuMode() {
    return modeSelect.value === "cpu";
  }

  function getDifficulty() {
    return difficultySelect.value || "hard";
  }

  function updateDifficultyVisibility() {
    if (!difficultyWrap) return;
    difficultyWrap.classList.toggle("is-hidden", !isCpuMode());
  }

  function renderScores() {
    if (scoreXEl) scoreXEl.textContent = "X: " + scores.x;
    if (scoreOEl) scoreOEl.textContent = "O: " + scores.o;
    if (scoreDrawEl) scoreDrawEl.textContent = "Draws: " + scores.draw;
  }

  function emptyBoard() {
    return Array(9).fill("");
  }

  function checkWinner(cells) {
    for (var i = 0; i < WIN_LINES.length; i++) {
      var line = WIN_LINES[i];
      var a = cells[line[0]];
      var b = cells[line[1]];
      var c = cells[line[2]];
      if (a && a === b && b === c) return { winner: a, line: line.slice() };
    }
    if (cells.every(Boolean)) return { winner: null, line: null, draw: true };
    return null;
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function turnLabel() {
    if (gameOver) return;
    if (isCpuMode()) {
      if (current === "X") {
        setStatus("Your turn — you are X");
      } else {
        setStatus("Little Ollie is thinking…");
      }
      return;
    }
    setStatus((current === "X" ? "Player 1" : "Player 2") + "'s turn (" + current + ")");
  }

  function starterMessage() {
    if (isCpuMode()) {
      return current === "X" ? "You go first — you are X" : "Little Ollie goes first";
    }
    return current === "X" ? "Player 1 goes first (X)" : "Player 2 goes first (O)";
  }

  function maybeCpuOpens() {
    if (gameOver || !isCpuMode() || current !== "O") return;
    window.setTimeout(cpuTurn, 420);
  }

  function clearWinLine() {
    if (winLineEl) winLineEl.innerHTML = "";
  }

  function drawWinLine(line) {
    if (!winLineEl || !line || line.length !== 3) {
      clearWinLine();
      return;
    }

    window.requestAnimationFrame(function () {
      var boardRect = gridEl.getBoundingClientRect();
      if (!boardRect.width || !boardRect.height) return;

      var firstCell = gridEl.querySelector('[data-index="' + line[0] + '"]');
      var lastCell = gridEl.querySelector('[data-index="' + line[2] + '"]');
      if (!firstCell || !lastCell) return;

      var firstRect = firstCell.getBoundingClientRect();
      var lastRect = lastCell.getBoundingClientRect();
      var x1 = firstRect.left + firstRect.width / 2 - boardRect.left;
      var y1 = firstRect.top + firstRect.height / 2 - boardRect.top;
      var x2 = lastRect.left + lastRect.width / 2 - boardRect.left;
      var y2 = lastRect.top + lastRect.height / 2 - boardRect.top;

      winLineEl.setAttribute("viewBox", "0 0 " + boardRect.width + " " + boardRect.height);
      winLineEl.innerHTML =
        '<line x1="' +
        x1 +
        '" y1="' +
        y1 +
        '" x2="' +
        x2 +
        '" y2="' +
        y2 +
        '" />';
    });
  }

  function renderBoard() {
    gridEl.innerHTML = "";
    for (var i = 0; i < 9; i++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "tic-tac-toe__cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", "Row " + (Math.floor(i / 3) + 1) + ", column " + ((i % 3) + 1));
      cell.dataset.index = String(i);

      var mark = board[i];
      if (mark) {
        cell.textContent = mark;
        cell.classList.add(mark === "X" ? "tic-tac-toe__cell--x" : "tic-tac-toe__cell--o");
        cell.disabled = true;
      }

      if (winLine && winLine.indexOf(i) !== -1) {
        cell.classList.add("tic-tac-toe__cell--win");
      }

      if (!mark && !gameOver) {
        cell.addEventListener("click", onCellClick);
      } else {
        cell.disabled = true;
      }

      gridEl.appendChild(cell);
    }

    if (winLine) drawWinLine(winLine);
    else clearWinLine();
  }

  function scheduleRestart(messageSuffix) {
    clearTimeout(restartTimer);
    if (messageSuffix) {
      setStatus(statusEl.textContent + messageSuffix);
    }
    restartTimer = window.setTimeout(function () {
      newGame({ alternateStarter: true });
    }, RESTART_DELAY_MS);
  }

  function finishGame(result) {
    gameOver = true;
    if (result && result.winner) {
      winLine = result.line;
      if (result.winner === "X") scores.x += 1;
      else scores.o += 1;
      saveScores();
      renderScores();
      if (isCpuMode()) {
        setStatus(result.winner === "X" ? "You win! Nice one." : "Little Ollie wins — try again!");
      } else {
        setStatus("Player " + (result.winner === "X" ? "1" : "2") + " wins!");
      }
    } else if (result && result.draw) {
      scores.draw += 1;
      saveScores();
      renderScores();
      setStatus("It's a draw — good game!");
    }
    renderBoard();
    scheduleRestart(" New game starting…");
  }

  function makeMove(index, player) {
    if (gameOver || board[index]) return false;
    board[index] = player;
    var result = checkWinner(board);
    if (result) {
      finishGame(result);
      return true;
    }
    current = current === "X" ? "O" : "X";
    renderBoard();
    turnLabel();
    return true;
  }

  function onCellClick(e) {
    var index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    if (gameOver || board[index]) return;
    if (isCpuMode() && current !== "X") return;

    makeMove(index, current);

    if (!gameOver && isCpuMode() && current === "O") {
      window.setTimeout(cpuTurn, 380);
    }
  }

  function cpuTurn() {
    if (gameOver || current !== "O") return;
    var move = pickCpuMove();
    if (move === -1) return;
    makeMove(move, "O");
  }

  function emptyIndices(cells) {
    var open = [];
    for (var i = 0; i < 9; i++) {
      if (!cells[i]) open.push(i);
    }
    return open;
  }

  function findWinningMove(cells, player) {
    for (var i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = player;
      var won = checkWinner(cells);
      cells[i] = "";
      if (won && won.winner === player) return i;
    }
    return -1;
  }

  function pickRandomMove(cells) {
    var open = emptyIndices(cells);
    if (!open.length) return -1;
    return open[Math.floor(Math.random() * open.length)];
  }

  function pickHeuristicMove(cells) {
    var win = findWinningMove(cells, "O");
    if (win !== -1) return win;
    var block = findWinningMove(cells, "X");
    if (block !== -1) return block;

    var priority = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (var i = 0; i < priority.length; i++) {
      if (!cells[priority[i]]) return priority[i];
    }
    return pickRandomMove(cells);
  }

  function pickCpuMove() {
    var difficulty = getDifficulty();
    var open = emptyIndices(board);
    if (!open.length) return -1;

    if (difficulty === "easy") {
      var easyWin = findWinningMove(board, "O");
      if (easyWin !== -1 && Math.random() < 0.55) return easyWin;
      var easyBlock = findWinningMove(board, "X");
      if (easyBlock !== -1 && Math.random() < 0.45) return easyBlock;
      return pickRandomMove(board);
    }

    if (difficulty === "medium") {
      var mediumWin = findWinningMove(board, "O");
      if (mediumWin !== -1) return mediumWin;
      var mediumBlock = findWinningMove(board, "X");
      if (mediumBlock !== -1 && Math.random() < 0.82) return mediumBlock;
      if (Math.random() < 0.45) return pickHeuristicMove(board);
      return pickBestMinimaxMove(board, 2);
    }

    return pickBestMinimaxMove(board, Infinity);
  }

  function pickBestMinimaxMove(cells, depthLimit) {
    var bestScore = -Infinity;
    var bestMoves = [];

    for (var i = 0; i < 9; i++) {
      if (cells[i]) continue;
      cells[i] = "O";
      var score = minimax(cells, 0, false, depthLimit);
      cells[i] = "";
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [i];
      } else if (score === bestScore) {
        bestMoves.push(i);
      }
    }

    if (!bestMoves.length) return pickRandomMove(cells);
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  function minimax(cells, depth, isMax, depthLimit) {
    var result = checkWinner(cells);
    if (result) {
      if (result.winner === "O") return 10 - depth;
      if (result.winner === "X") return depth - 10;
      return 0;
    }

    if (depthLimit !== Infinity && depth >= depthLimit) {
      return 0;
    }

    if (isMax) {
      var maxEval = -Infinity;
      for (var i = 0; i < 9; i++) {
        if (cells[i]) continue;
        cells[i] = "O";
        maxEval = Math.max(maxEval, minimax(cells, depth + 1, false, depthLimit));
        cells[i] = "";
      }
      return maxEval;
    }

    var minEval = Infinity;
    for (var j = 0; j < 9; j++) {
      if (cells[j]) continue;
      cells[j] = "X";
      minEval = Math.min(minEval, minimax(cells, depth + 1, true, depthLimit));
      cells[j] = "";
    }
    return minEval;
  }

  function newGame(opts) {
    opts = opts || {};
    clearTimeout(restartTimer);
    restartTimer = null;

    if (opts.alternateStarter) {
      nextStarter = nextStarter === "X" ? "O" : "X";
    } else if (opts.resetStarter) {
      nextStarter = "X";
    }

    board = emptyBoard();
    current = nextStarter;
    gameOver = false;
    winLine = null;
    clearWinLine();
    renderBoard();

    if (opts.showStarter || opts.manual) {
      setStatus(starterMessage());
    } else {
      turnLabel();
    }

    maybeCpuOpens();
  }

  modeSelect.addEventListener("change", function () {
    updateDifficultyVisibility();
    newGame({ manual: true, resetStarter: true });
  });
  difficultySelect.addEventListener("change", function () {
    if (isCpuMode()) newGame({ manual: true });
  });
  btnNew.addEventListener("click", function () {
    newGame({ manual: true });
  });
  btnResetScores.addEventListener("click", function () {
    scores = { x: 0, o: 0, draw: 0 };
    saveScores();
    renderScores();
    newGame({ manual: true, resetStarter: true });
  });

  window.addEventListener("resize", function () {
    if (winLine) drawWinLine(winLine);
  });

  updateDifficultyVisibility();
  renderScores();
  newGame({ manual: true, resetStarter: true });
})();
