import { useCallback, useEffect, useState } from "react";
import { GameShell } from "./components/GameShell";
import { HowToPlayModal } from "./components/HowToPlayModal";
import { UsernameModal } from "./components/UsernameModal";
import { getSavedHandle } from "./xhandle";
import "../frappy-brew.css";

export default function App() {
  const [savedHandle, setSavedHandle] = useState(() => getSavedHandle() ?? "");
  const [gameReady, setGameReady] = useState(() => getSavedHandle() !== null);
  const [showUsernameModal, setShowUsernameModal] = useState(() => getSavedHandle() === null);
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
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
      {gameReady && (
        <GameShell
          displayHandle={savedHandle}
          onEditHandle={() => setShowUsernameModal(true)}
          onOpenHowToPlay={() => setShowHowToPlay(true)}
        />
      )}
    </>
  );
}
