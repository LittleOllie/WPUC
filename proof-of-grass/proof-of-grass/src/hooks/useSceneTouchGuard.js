import { useEffect } from "react";

/** Long-press / save-image guards — interactive lawn only (not global scroll) */
const GRASS_GUARD_SELECTOR =
  ".grass-zone, .grass-zone__hit-pad, .grass-tile, .grass-tile__img";

/**
 * Block iOS/Android long-press menus on the grass interaction surface.
 */
export function useSceneTouchGuard(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const isGuarded = (target) =>
      target instanceof Element && Boolean(target.closest(GRASS_GUARD_SELECTOR));

    const blockIfGuarded = (e) => {
      if (!isGuarded(e.target)) return;
      e.preventDefault();
    };

    const onTouchStart = (e) => {
      if (!isGuarded(e.target)) return;
      if (e.touches.length > 1) return;
      e.preventDefault();
    };

    const capture = { capture: true };
    const touchOpts = { capture: true, passive: false };

    root.addEventListener("contextmenu", blockIfGuarded, capture);
    root.addEventListener("selectstart", blockIfGuarded, capture);
    root.addEventListener("dragstart", blockIfGuarded, capture);
    root.addEventListener("touchstart", onTouchStart, touchOpts);

    return () => {
      root.removeEventListener("contextmenu", blockIfGuarded, capture);
      root.removeEventListener("selectstart", blockIfGuarded, capture);
      root.removeEventListener("dragstart", blockIfGuarded, capture);
      root.removeEventListener("touchstart", onTouchStart, touchOpts);
    };
  }, [rootRef]);
}
