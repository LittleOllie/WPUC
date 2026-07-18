/**
 * Memory Match — device-local scores (time + moves per difficulty).
 */
import { LOCAL_LEADERBOARD_NOTE } from "../../scripts/labs-config.js";
import { addLocalScore, rankLocalScores, readLocalScores } from "../../scripts/local-leaderboard.js";

window.leaderboardBridgeError = null;
window.leaderboardBridgeReady = true;
window.leaderboardLocalNote = LOCAL_LEADERBOARD_NOTE;

function storageKey(difficulty) {
  return "lo_labs_lb_memory_" + difficulty;
}

function compareMemory(a, b) {
  if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
  return (a.moves || 0) - (b.moves || 0);
}

function getBoard(difficulty) {
  return rankLocalScores(readLocalScores(storageKey(difficulty)), compareMemory).slice(0, 20);
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
    { max: 20, compare: compareMemory }
  );
};

window.getLeaderboard = async function getLeaderboard(difficulty) {
  return getBoard(difficulty);
};
