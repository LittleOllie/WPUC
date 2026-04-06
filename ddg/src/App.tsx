import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { FrappyShell } from "./FrappyShell";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { UsernameModal } from "./components/UsernameModal";
import { LB_CHARACTER, LB_SCENE, assetUrl } from "./config/site";
import {
  getSavedHandle,
  isValidHandle,
  normalizeHandle,
  readStoredHandle,
  writeStoredHandle,
} from "./handleStorage";
import "./frappy-brew.css";

const LeaderboardModal = lazy(() => import("./components/LeaderboardModal"));

export type FrappyBrewGameOverDetail = {
  score: number;
  newPersonalBest: boolean;
  beans?: number;
  best?: number;
};

export default function App() {
  const [handle, setHandle] = useState<string | null>(() => readStoredHandle());
  const [usernameOpen, setUsernameOpen] = useState(() => !isValidHandle(readStoredHandle() ?? ""));
  const [usernameMode, setUsernameMode] = useState<"welcome" | "edit">(() =>
    isValidHandle(readStoredHandle() ?? "") ? "edit" : "welcome"
  );
  const [howToOpen, setHowToOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const openEditHandle = useCallback(() => {
    setUsernameMode("edit");
    setUsernameOpen(true);
  }, []);

  useEffect(() => {
    if (!handle || !isValidHandle(handle)) return;
    if (document.querySelector("script[data-frappy-brew]")) return;

    const s = document.createElement("script");
    s.src = `${import.meta.env.BASE_URL}frappy-brew.js`.replace(/([^:]\/)\/+/g, "$1/");
    s.async = false;
    s.setAttribute("data-frappy-brew", "");
    s.setAttribute("data-frappy-base", import.meta.env.BASE_URL);
    document.body.appendChild(s);
  }, [handle]);

  useEffect(() => {
    const onGameOver = (e: Event) => {
      const ce = e as CustomEvent<FrappyBrewGameOverDetail>;
      const d = ce.detail;
      if (!d?.newPersonalBest) return;
      const h = getSavedHandle();
      if (!h) return;
      const raw = d.score;
      const score = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(score)) return;
      const n = Math.round(score);
      if (n < 1 || n > 10_000_000) return;

      import("./leaderboard")
        .then(({ submitScore }) => submitScore(h, n, LB_CHARACTER, LB_SCENE))
        .catch(console.error);
    };
    window.addEventListener("frappy-brew-gameover", onGameOver);
    return () => window.removeEventListener("frappy-brew-gameover", onGameOver);
  }, []);

  const onSaveHandle = useCallback((normalized: string) => {
    const h = normalizeHandle(normalized);
    if (!h) return;
    writeStoredHandle(h);
    setHandle(h);
    setUsernameOpen(false);
  }, []);

  const onCloseUsername = useCallback(() => {
    setUsernameOpen(false);
  }, []);

  if (!handle || !isValidHandle(handle)) {
    return (
      <>
        <div className="page page-fullscreen">
          <div
            className="frappy-bg"
            aria-hidden
            style={{ backgroundImage: `url(${assetUrl("assets/bg0.png")})` }}
          />
          <div className="frappy-bg-overlay" aria-hidden />
        </div>
        <UsernameModal
          open
          mode="welcome"
          initialValue=""
          onSave={onSaveHandle}
          onClose={() => {}}
        />
      </>
    );
  }

  return (
    <>
      <FrappyShell
        handle={handle}
        onHowToPlay={() => setHowToOpen(true)}
        onEditHandle={openEditHandle}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
      />
      <UsernameModal
        open={usernameOpen}
        mode={usernameMode}
        initialValue={handle}
        onSave={onSaveHandle}
        onClose={onCloseUsername}
      />
      <HowToPlayModal open={howToOpen} onClose={() => setHowToOpen(false)} />
      {leaderboardOpen ? (
        <Suspense fallback={<div className="lb-suspense-fallback">Loading…</div>}>
          <LeaderboardModal open onClose={() => setLeaderboardOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
