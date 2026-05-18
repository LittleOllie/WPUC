import { useCallback, useState } from "react";
import {
  DISPLAY_IMMERSIVE,
  DISPLAY_PORTRAIT,
  loadDisplayMode,
  saveDisplayMode,
} from "../lib/displayMode.js";

export function useDisplayMode() {
  const [mode, setMode] = useState(loadDisplayMode);

  const immersive = mode === DISPLAY_IMMERSIVE;
  const portrait = !immersive;

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next = prev === DISPLAY_IMMERSIVE ? DISPLAY_PORTRAIT : DISPLAY_IMMERSIVE;
      saveDisplayMode(next);
      return next;
    });
  }, []);

  const setPortrait = useCallback(() => {
    saveDisplayMode(DISPLAY_PORTRAIT);
    setMode(DISPLAY_PORTRAIT);
  }, []);

  const setImmersive = useCallback(() => {
    saveDisplayMode(DISPLAY_IMMERSIVE);
    setMode(DISPLAY_IMMERSIVE);
  }, []);

  return { mode, immersive, portrait, toggle, setPortrait, setImmersive };
}
