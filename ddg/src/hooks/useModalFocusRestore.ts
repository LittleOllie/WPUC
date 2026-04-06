import { type RefObject, useEffect } from "react";

/**
 * When `open` becomes true, focuses the first focusable node inside `containerRef`.
 * On cleanup (modal closes), restores focus to the element that had focus before open.
 */
export function useModalFocusRestore(
  open: boolean,
  containerRef: RefObject<HTMLElement | null>,
  focusSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
): void {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const id = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(focusSelector);
      el?.focus();
    });
    return () => {
      cancelAnimationFrame(id);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, containerRef, focusSelector]);
}
