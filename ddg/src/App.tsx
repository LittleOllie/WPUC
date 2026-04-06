import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { GameShell } from "./components/GameShell";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { UsernameModal } from "./components/UsernameModal";
import { LB_CHARACTER, LB_SCENE } from "./config/site";
import { getSavedHandle } from "./xhandle";
import "../frappy-brew.css";

const LeaderboardModal = lazy(() =>
  import("./components/LeaderboardModal").then((m) => ({ default: m.LeaderboardModal }))
);

export default function App() {
  const [savedHandle, setSavedHandle] = useState(() => getSavedHandle() ?? "");
  const [gameReady, setGameReady] = useState(() => getSavedHandle() !== null);
  const [showUsernameModal, setShowUsernameModal] = useState(() => getSavedHandle() === null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const onHandleSaved = useCallback(() => {
    const h = getSavedHandle() ?? "";
    setSavedHandle(h);
    setShowUsernameModal(false);
    setGameReady(true);
  }, []);

  useEffect(() => {
    if (!gameReady) return;
    if (document.querySelector("script[data-frappy-brew]")) return;
    const s = document.createElement("script");
    s.src = `${import.meta.env.BASE_URL}frappy-brew.js`;
    s.async = false;
    s.dataset.frappyBrew = "1";
    document.body.appendChild(s);
  }, [gameReady]);

  useEffect(() => {
    const onGameOver = (ev: Event) => {
      const handle = getSavedHandle();
      if (!handle) return;
      const e = ev as CustomEvent<{ score: number; newPersonalBest?: boolean }>;
      const s = e.detail?.score;
      if (typeof s !== "number" || !Number.isFinite(s) || s < 1) return;
      if (!e.detail?.newPersonalBest) return;
      void import("./leaderboard")
        .then(({ submitScore }) => submitScore(handle, s, LB_CHARACTER, LB_SCENE))
        .catch((err) => {
          console.error("Leaderboard submit failed:", err);
        });
    };
    window.addEventListener("frappy-brew-gameover", onGameOver);
    return () => window.removeEventListener("frappy-brew-gameover", onGameOver);
  }, []);

  return (
    <>
      {showUsernameModal && (
        <UsernameModal
          onSaved={onHandleSaved}
          initialHandle={savedHandle}
          isEdit={savedHandle.length > 0}
          onCancel={savedHandle.length > 0 ? () => setShowUsernameModal(false) : undefined}
        />
      )}
      {showLeaderboard && (
        <Suspense fallback={null}>
          <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
        </Suspense>
      )}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {gameReady && (
        <GameShell
          displayHandle={savedHandle}
          onEditHandle={() => setShowUsernameModal(true)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}
    </>
  );
}
