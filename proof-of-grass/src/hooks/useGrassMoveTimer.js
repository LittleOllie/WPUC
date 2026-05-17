import { useCallback, useEffect, useRef, useState } from "react";
import { formatTouchTimer } from "../lib/formatTime.js";

/**
 * Counts up only while the pointer is in the grass band (bottom → top of lawn).
 */
export function useGrassMoveTimer() {
  const [ms, setMs] = useState(0);
  const [moving, setMovingState] = useState(false);
  const movingRef = useRef(false);
  const lastTickRef = useRef(performance.now());
  const rafRef = useRef(0);

  const setMoving = useCallback((next) => {
    if (movingRef.current === next) return;
    movingRef.current = next;
    setMovingState(next);
    lastTickRef.current = performance.now();
  }, []);

  useEffect(() => {
    const tick = (now) => {
      if (movingRef.current) {
        const dt = now - lastTickRef.current;
        lastTickRef.current = now;
        if (dt > 0 && dt < 100) {
          setMs((prev) => prev + dt);
        }
      } else {
        lastTickRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    lastTickRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    ms,
    moving,
    formatted: formatTouchTimer(ms),
    setMoving,
  };
}
