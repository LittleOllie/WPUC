/**
 * Slider Puzzle leaderboard: submit and fetch scores from Firestore.
 */
window.leaderboardBridgeError = null;
window.leaderboardBridgeReady = false;

try {
  const { db } = await import("./firebase-slider.js");
  const { collection, addDoc, query, orderBy, limit, getDocs } = await import(
    "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js"
  );

  function boardPath(difficulty) {
    return `leaderboards/slider_${difficulty}/entries`;
  }

  async function submitScore(name, difficulty, timeSeconds, moves) {
    await addDoc(collection(db, boardPath(difficulty)), {
      playerName: name,
      difficulty: difficulty,
      timeSeconds: timeSeconds,
      moves: moves,
      createdAt: Date.now()
    });
  }

  async function getLeaderboard(difficulty) {
    const q = query(
      collection(db, boardPath(difficulty)),
      orderBy("timeSeconds", "asc"),
      limit(100)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    list.sort((a, b) => {
      if (a.timeSeconds !== b.timeSeconds) return a.timeSeconds - b.timeSeconds;
      return (a.moves ?? 0) - (b.moves ?? 0);
    });
    return list.slice(0, 20);
  }

  window.submitScore = submitScore;
  window.getLeaderboard = getLeaderboard;
  window.leaderboardBridgeReady = true;
} catch (e) {
  window.leaderboardBridgeError = e;
  console.error("Slider leaderboard failed to load:", e);
}
