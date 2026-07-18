/**
 * Slider Puzzle — device-local scores (replaces Firestore when global LB is off).
 * Restore global: load leaderboard-slider.js instead in index.html.
 */
import { LOCAL_LEADERBOARD_NOTE } from "../../scripts/labs-config.js";
import { addLocalScore, rankLocalScores, readLocalScores } from "../../scripts/local-leaderboard.js";

window.leaderboardBridgeError = null;
window.leaderboardBridgeReady = true;
window.leaderboardLocalNote = LOCAL_LEADERBOARD_NOTE;

function storageKey(difficulty) {
  return "lo_labs_lb_slider_" + difficulty;
}

function compareSlider(a, b) {
  if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
  return (a.moves || 0) - (b.moves || 0);
}

function getBoard(difficulty) {
  return rankLocalScores(readLocalScores(storageKey(difficulty)), compareSlider).slice(0, 20);
}

window.submitScore = async function submitScore(name, difficulty, timeSeconds, moves) {
  addLocalScore(
    storageKey(difficulty),
    {
      playerName: String(name || "Player").trim().slice(0, 30),
      difficulty,
      timeSeconds: Number(timeSeconds) || 0,
      moves: Number(moves) || 0,
    },
    { max: 20, compare: compareSlider }
  );
};

window.getLeaderboard = async function getLeaderboard(difficulty) {
  return getBoard(difficulty);
};
