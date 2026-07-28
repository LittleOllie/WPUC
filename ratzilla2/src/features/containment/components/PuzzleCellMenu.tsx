import { useLayoutEffect, useRef, useState } from "react";
import type { PuzzleCell } from "../types/puzzle";

export interface CellMenuAnchor {
  x: number;
  y: number;
}

interface PuzzleCellMenuProps {
  anchor: CellMenuAnchor;
  wrapRef: React.RefObject<HTMLElement | null>;
  selectedCell: PuzzleCell;
  locks: number;
  maxLocks: number;
  onScan: () => void;
  onLock: () => void;
  onUnlock: () => void;
}

function canScan(cell: PuzzleCell): boolean {
  return !cell.isCore && cell.state === "hidden";
}

function canLock(cell: PuzzleCell): boolean {
  return !cell.isCore && cell.state !== "locked";
}

function canUnlock(cell: PuzzleCell, locks: number, maxLocks: number): boolean {
  return cell.state === "locked" && locks < maxLocks;
}

export default function PuzzleCellMenu({
  anchor,
  wrapRef,
  selectedCell,
  locks,
  maxLocks,
  onScan,
  onLock,
  onUnlock,
}: PuzzleCellMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(anchor);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const wrap = wrapRef.current;
    if (!menu || !wrap) {
      setPosition(anchor);
      return;
    }

    const pad = 8;
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    const ww = wrap.clientWidth;
    const wh = wrap.clientHeight;

    let x = anchor.x + 18;
    let y = anchor.y;

    if (x + mw + pad > ww) {
      x = anchor.x - mw - 18;
    }
    if (x < pad) x = pad;
    if (x + mw > ww - pad) x = ww - mw - pad;

    y = Math.min(Math.max(mh / 2 + pad, y), wh - mh / 2 - pad);

    setPosition({ x, y });
  }, [anchor, wrapRef, selectedCell.id, selectedCell.state]);

  const scanReady = canScan(selectedCell);
  const lockReady = canLock(selectedCell);
  const unlockReady = canUnlock(selectedCell, locks, maxLocks);

  return (
    <div
      ref={menuRef}
      className="cp-cell-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Room actions"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {scanReady && (
        <button
          type="button"
          className="cp-cell-menu__btn cp-cell-menu__btn--scan"
          onClick={onScan}
        >
          Scan
        </button>
      )}
      {lockReady && (
        <button
          type="button"
          className="cp-cell-menu__btn cp-cell-menu__btn--lock"
          disabled={locks <= 0}
          onClick={onLock}
        >
          Lock
        </button>
      )}
      {unlockReady && (
        <button
          type="button"
          className="cp-cell-menu__btn cp-cell-menu__btn--unlock"
          onClick={onUnlock}
        >
          Unlock
        </button>
      )}
      {selectedCell.state === "locked" && !unlockReady && (
        <span className="cp-cell-menu__note">Lock storage full</span>
      )}
    </div>
  );
}
