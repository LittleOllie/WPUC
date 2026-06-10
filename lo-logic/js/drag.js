/**
 * Unified pointer drag — tray + board, mobile-first, no HTML5 DnD.
 */

const GHOST_OFFSET = "translate(-50%, -50%)";

/**
 * @param {object} opts
 * @param {(id: string) => void} [opts.onPick]
 * @param {(payload: object) => void} [opts.onDrop]
 * @param {() => void} [opts.onCancel]
 */
export function initTileDrag({ onPick, onDrop, onCancel }) {
  let active = null;

  const clearHighlights = () => {
    document.querySelectorAll(".lo-slot--hover").forEach((s) => {
      s.classList.remove("lo-slot--hover");
    });
    document.querySelectorAll(".lo-tray--hover").forEach((t) => {
      t.classList.remove("lo-tray--hover");
    });
  };

  const getSource = (tile) => {
    const slot = tile.closest(".lo-slot");
    const tray = tile.closest(".lo-tray");
    if (tray) return { type: "tray", tile, el: tile };
    if (slot) {
      return {
        type: "slot",
        tile,
        el: tile,
        r: Number(slot.dataset.row),
        c: Number(slot.dataset.col),
        slot,
      };
    }
    return null;
  };

  const highlightAt = (x, y) => {
    clearHighlights();
    if (active?.ghost) active.ghost.style.visibility = "hidden";
    const under = document.elementFromPoint(x, y);
    if (active?.ghost) active.ghost.style.visibility = "";
    const slot = under?.closest?.(".lo-slot");
    const tray = under?.closest?.(".lo-tray");
    if (slot) slot.classList.add("lo-slot--hover");
    if (tray) tray.classList.add("lo-tray--hover");
  };

  const onPointerDown = (e) => {
    if (active || e.button > 0 || document.body.classList.contains("lo-reveal-active")) return;
    const tile = e.target.closest(".lo-tile");
    if (!tile || tile.classList.contains("lo-tile-ghost")) return;

    const source = getSource(tile);
    if (!source) return;

    const rect = tile.getBoundingClientRect();
    active = {
      pointerId: e.pointerId,
      source,
      ghost: tile.cloneNode(true),
      startX: e.clientX,
      startY: e.clientY,
      originRect: rect,
    };

    active.ghost.classList.add("lo-tile-ghost");
    active.ghost.classList.remove("lo-tile--dragging");
    active.ghost.style.pointerEvents = "none";
    document.body.appendChild(active.ghost);
    positionGhost(active.ghost, e.clientX, e.clientY);

    tile.classList.add("lo-tile--dragging");
    tile.style.visibility = "hidden";

    try {
      tile.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    onPick?.(tile.dataset.tileId);
    e.preventDefault();
  };

  const positionGhost = (ghost, x, y) => {
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    ghost.style.transform = `${GHOST_OFFSET} scale(1.08)`;
  };

  const onPointerMove = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;
    positionGhost(active.ghost, e.clientX, e.clientY);
    highlightAt(e.clientX, e.clientY);
  };

  const finish = (e, dropped) => {
    if (!active || e.pointerId !== active.pointerId) return;

    const { source, ghost, originRect } = active;
    const tile = source.tile;
    const tileId = tile.dataset.tileId;

    if (tile.isConnected) {
      tile.classList.remove("lo-tile--dragging");
      tile.style.visibility = "";
      try {
        tile.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }

    clearHighlights();

    if (!dropped) {
      animateReturn(ghost, originRect, () => {
        ghost.remove();
        onCancel?.();
      });
    } else {
      ghost.remove();
    }

    active = null;
  };

  const onPointerUp = (e) => {
    if (!active || e.pointerId !== active.pointerId) return;

    const { ghost } = active;
    ghost.style.visibility = "hidden";
    const under = document.elementFromPoint(e.clientX, e.clientY);
    ghost.style.visibility = "";
    const slot = under?.closest?.(".lo-slot");
    const tray = under?.closest?.(".lo-tray");
    const { source } = active;
    const tileId = source.tile.dataset.tileId;

    let handled = false;

    if (slot) {
      const to = { r: Number(slot.dataset.row), c: Number(slot.dataset.col) };
      if (source.type === "tray") {
        onDrop?.({ tileId, to, from: "tray" });
        handled = true;
      } else if (source.type === "slot") {
        onDrop?.({
          tileId,
          to,
          from: { r: source.r, c: source.c },
        });
        handled = true;
      }
    } else if (tray && source.type === "slot") {
      onDrop?.({
        tileId,
        to: "tray",
        from: { r: source.r, c: source.c },
      });
      handled = true;
    }

    finish(e, handled);
  };

  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
}

function animateReturn(ghost, targetRect, onDone) {
  const cx = targetRect.left + targetRect.width / 2;
  const cy = targetRect.top + targetRect.height / 2;
  ghost.style.transition = "left 0.28s cubic-bezier(0.34, 1.4, 0.64, 1), top 0.28s cubic-bezier(0.34, 1.4, 0.64, 1), transform 0.28s ease";
  requestAnimationFrame(() => {
    ghost.style.left = `${cx}px`;
    ghost.style.top = `${cy}px`;
    ghost.style.transform = `${GHOST_OFFSET} scale(1)`;
  });
  setTimeout(onDone, 300);
}
