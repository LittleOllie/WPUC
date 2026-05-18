import { useEffect } from "react";

const GRASS_GUARD_SELECTOR =
  ".grass-zone, .grass-zone__hit-pad, .grass-touch-shield, .grass-tile, .grass-tile__img";

/**
 * Block iOS/Android long-press save-image menus on the lawn only.
 */
export function useSceneTouchGuard(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const isGuarded = (target) =>
      target instanceof Element && Boolean(target.closest(GRASS_GUARD_SELECTOR));

    let touchOnGrass = false;

    const blockIfGuarded = (e) => {
      if (!isGuarded(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onTouchStart = (e) => {
      if (!isGuarded(e.target)) {
        touchOnGrass = false;
        return;
      }
      touchOnGrass = true;
      if (e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchMove = (e) => {
      if (!touchOnGrass && !isGuarded(e.target)) return;
      if (isGuarded(e.target)) touchOnGrass = true;
      if (touchOnGrass) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchEnd = () => {
      touchOnGrass = false;
    };

    const onGesture = (e) => {
      if (!isGuarded(e.target)) return;
      e.preventDefault();
    };

    const capture = { capture: true };
    const touchOpts = { capture: true, passive: false };

    root.addEventListener("contextmenu", blockIfGuarded, capture);
    root.addEventListener("selectstart", blockIfGuarded, capture);
    root.addEventListener("dragstart", blockIfGuarded, capture);
    root.addEventListener("gesturestart", onGesture, touchOpts);
    root.addEventListener("gesturechange", onGesture, touchOpts);
    root.addEventListener("gestureend", onGesture, touchOpts);
    root.addEventListener("touchstart", onTouchStart, touchOpts);
    root.addEventListener("touchmove", onTouchMove, touchOpts);
    root.addEventListener("touchend", onTouchEnd, capture);
    root.addEventListener("touchcancel", onTouchEnd, capture);

    return () => {
      root.removeEventListener("contextmenu", blockIfGuarded, capture);
      root.removeEventListener("selectstart", blockIfGuarded, capture);
      root.removeEventListener("dragstart", blockIfGuarded, capture);
      root.removeEventListener("gesturestart", onGesture, touchOpts);
      root.removeEventListener("gesturechange", onGesture, touchOpts);
      root.removeEventListener("gestureend", onGesture, touchOpts);
      root.removeEventListener("touchstart", onTouchStart, touchOpts);
      root.removeEventListener("touchmove", onTouchMove, touchOpts);
      root.removeEventListener("touchend", onTouchEnd, capture);
      root.removeEventListener("touchcancel", onTouchEnd, capture);
    };
  }, [rootRef]);
}
