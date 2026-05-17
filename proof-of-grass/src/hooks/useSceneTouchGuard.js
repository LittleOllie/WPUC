import { useEffect } from "react";

const GUARD_SELECTOR =
  ".grass-zone, .grass-tile__img, .pog-scene-visual, .pog-sky-bg, .pog-llama, .pog-fence, .pog-cloud";

/**
 * Block iOS long-press / save-image / selection on the scene without affecting
 * document scrolling (this app uses overflow:hidden on body).
 */
export function useSceneTouchGuard(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const isGuarded = (target) =>
      target instanceof Element && Boolean(target.closest(GUARD_SELECTOR));

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
