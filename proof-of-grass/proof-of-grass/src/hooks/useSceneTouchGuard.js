import { useEffect } from "react";
import { PORTRAIT_LAWN_FRAC } from "../lib/mobileGrass.js";

const GRASS_GUARD_SELECTOR =
  ".grass-zone, .grass-zone__hit-pad, .grass-touch-shield, .grass-tile, .grass-tile__img, .pog-touch-guard";

/** Bottom lawn band — matches portrait frame */
function isPortraitLawnTouch(clientY, root) {
  const frame = root?.querySelector(".pog-frame");
  const rect = frame?.getBoundingClientRect();
  if (rect && rect.height > 0) {
    const cutoff = rect.bottom - rect.height * PORTRAIT_LAWN_FRAC;
    return clientY >= cutoff;
  }
  const cutoff = window.innerHeight * (1 - PORTRAIT_LAWN_FRAC - 0.08);
  return clientY >= cutoff;
}

/**
 * Block iOS/Android long-press "Save Image" on the lawn.
 * Grass physics still use document pointer events (imgs use pointer-events: none on portrait).
 */
export function useSceneTouchGuard(rootRef, portrait = true) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const isGuarded = (target) =>
      target instanceof Element && Boolean(target.closest(GRASS_GUARD_SELECTOR));

    const touchInLawn = (clientY) => portrait && isPortraitLawnTouch(clientY, root);

    let lawnTouchActive = false;

    const shouldBlockTouch = (target, clientY) => {
      if (!portrait) return isGuarded(target);
      if (isGuarded(target)) return true;
      if (target instanceof HTMLImageElement && root.contains(target)) return true;
      if (target instanceof Element && target.closest(".pog-scene-visual") && touchInLawn(clientY)) {
        return true;
      }
      return touchInLawn(clientY);
    };

    const blockEvent = (e) => {
      const y =
        e.touches?.[0]?.clientY ??
        e.changedTouches?.[0]?.clientY ??
        (e.clientY ?? 0);
      if (!shouldBlockTouch(e.target, y)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onTouchStart = (e) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (!shouldBlockTouch(e.target, y)) {
        lawnTouchActive = false;
        return;
      }
      lawnTouchActive = true;
      if (e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onTouchMove = (e) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (!lawnTouchActive && !shouldBlockTouch(e.target, y)) return;
      lawnTouchActive = true;
      e.preventDefault();
      e.stopPropagation();
    };

    const onTouchEnd = () => {
      lawnTouchActive = false;
    };

    const onGesture = (e) => {
      const y = e.clientY ?? 0;
      if (!shouldBlockTouch(e.target, y)) return;
      e.preventDefault();
    };

    const capture = { capture: true };
    const touchOpts = { capture: true, passive: false };

    root.addEventListener("contextmenu", blockEvent, capture);
    root.addEventListener("selectstart", blockEvent, capture);
    root.addEventListener("dragstart", blockEvent, capture);
    root.addEventListener("gesturestart", onGesture, touchOpts);
    root.addEventListener("gesturechange", onGesture, touchOpts);
    root.addEventListener("gestureend", onGesture, touchOpts);
    root.addEventListener("touchstart", onTouchStart, touchOpts);
    root.addEventListener("touchmove", onTouchMove, touchOpts);
    root.addEventListener("touchend", onTouchEnd, capture);
    root.addEventListener("touchcancel", onTouchEnd, capture);

    const onDocContextMenu = (e) => {
      if (!portrait) return;
      blockEvent(e);
    };

    const onDocTouchStart = (e) => {
      if (!portrait) return;
      onTouchStart(e);
    };

    if (portrait) {
      document.addEventListener("contextmenu", onDocContextMenu, capture);
      document.addEventListener("touchstart", onDocTouchStart, touchOpts);
    }

    return () => {
      root.removeEventListener("contextmenu", blockEvent, capture);
      root.removeEventListener("selectstart", blockEvent, capture);
      root.removeEventListener("dragstart", blockEvent, capture);
      root.removeEventListener("gesturestart", onGesture, touchOpts);
      root.removeEventListener("gesturechange", onGesture, touchOpts);
      root.removeEventListener("gestureend", onGesture, touchOpts);
      root.removeEventListener("touchstart", onTouchStart, touchOpts);
      root.removeEventListener("touchmove", onTouchMove, touchOpts);
      root.removeEventListener("touchend", onTouchEnd, capture);
      root.removeEventListener("touchcancel", onTouchEnd, capture);
      if (portrait) {
        document.removeEventListener("contextmenu", onDocContextMenu, capture);
        document.removeEventListener("touchstart", onDocTouchStart, touchOpts);
      }
    };
  }, [rootRef, portrait]);
}
