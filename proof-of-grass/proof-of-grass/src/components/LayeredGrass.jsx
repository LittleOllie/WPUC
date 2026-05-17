import { useEffect, useRef } from "react";
import {
  applyParticles,
  createParticleField,
  stepParticles,
} from "../lib/ambientParticles.js";
import {
  findHoveredGrassTile,
  loadGrassMask,
  preloadGrassMasks,
} from "../lib/grassHitTest.js";
import { GRASS_LAYER_CONFIG } from "../lib/grassLayers.js";
import { createLayerState, stepGrassLayers } from "../lib/grassPhysics.js";
import { createWindState, stepWind } from "../lib/windSystem.js";

const TILES_MIN = 4;
const TILES_MAX = 5;

function tileCountForWidth(width) {
  if (width < 520) return TILES_MIN;
  return TILES_MAX;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function isPointerInViewport(clientX, clientY) {
  return (
    clientX >= 0 &&
    clientY >= 0 &&
    clientX < window.innerWidth &&
    clientY < window.innerHeight
  );
}

function isPhoneGrassDouble() {
  return window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches;
}

export default function LayeredGrass({
  wind: windMultiplier = 1,
  onGrassMovingChange,
}) {
  const zoneRef = useRef(null);
  const onGrassMovingChangeRef = useRef(onGrassMovingChange);
  const lastMovingNotifyRef = useRef(false);
  const particlesRef = useRef(null);
  const layerElsRef = useRef([]);
  const mirrorLayerElsRef = useRef([]);
  const tileElsRef = useRef([]);
  const mirrorTileElsRef = useRef([]);
  const simRef = useRef(null);
  const windRef = useRef(createWindState());
  const particlesSimRef = useRef(createParticleField());
  const pointerRef = useRef({
    timerActive: false,
    hoverLayer: -1,
    hoverTile: -1,
    pressing: false,
    vx: 0,
  });
  const layerMasksRef = useRef([]);
  const prevPointerXRef = useRef(0.5);
  const rafRef = useRef(0);
  const resizeRafRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    onGrassMovingChangeRef.current = onGrassMovingChange;
  }, [onGrassMovingChange]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;

    const notifyMoving = (moving) => {
      if (lastMovingNotifyRef.current === moving) return;
      lastMovingNotifyRef.current = moving;
      onGrassMovingChangeRef.current?.(moving);
    };

    const syncTimerState = () => {
      notifyMoving(pointerRef.current.timerActive);
    };

    const clearPointer = () => {
      pointerRef.current = {
        timerActive: false,
        hoverLayer: -1,
        hoverTile: -1,
        pressing: false,
        vx: 0,
      };
      notifyMoving(false);
    };

    const motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = motionMq.matches;
    const onMotionChange = (e) => {
      reducedMotionRef.current = e.matches;
    };
    motionMq.addEventListener("change", onMotionChange);

    const applyPointer = (clientX, clientY) => {
      if (!document.hasFocus() || !isPointerInViewport(clientX, clientY)) {
        clearPointer();
        return;
      }

      const rect = zone.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const p = pointerRef.current;
      const tileNodes = tileElsRef.current;
      const masks = layerMasksRef.current;

      let hovered =
        tileNodes?.length && masks?.length
          ? findHoveredGrassTile(clientX, clientY, tileNodes, masks)
          : null;

      const cols = simRef.current?.[0]?.cols;
      if (hovered && cols && hovered.tile >= cols) {
        hovered = { layer: hovered.layer, tile: hovered.tile % cols };
      }

      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const vx = hovered ? x - prevPointerXRef.current : p.vx * 0.82;
      if (hovered) prevPointerXRef.current = x;

      pointerRef.current = {
        ...p,
        timerActive: hovered != null,
        hoverLayer: hovered?.layer ?? -1,
        hoverTile: hovered?.tile ?? -1,
        vx: clamp(vx, -0.1, 0.1),
      };
      syncTimerState();
    };

    const build = () => {
      const width = zone.clientWidth;
      const height = zone.clientHeight;
      if (width < 8 || height < 8) return false;

      const tiles = tileCountForWidth(width);
      const doubled = isPhoneGrassDouble();

      zone.querySelectorAll(".grass-stack").forEach((el) => el.remove());
      zone.classList.toggle("grass-zone--doubled", doubled);

      const layerEls = [];
      const mirrorLayerEls = [];
      const allTiles = [];
      const mirrorAllTiles = [];

      const appendGrassTiles = (parent, count, src, layerTiles) => {
        for (let t = 0; t < count; t++) {
          const tile = document.createElement("div");
          tile.className = "grass-tile";

          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.draggable = false;
          img.className = "grass-tile__img pog-touch-guard";
          img.decoding = "async";
          img.loading = "eager";

          tile.appendChild(img);
          parent.appendChild(tile);
          layerTiles.push(tile);
        }
      };

      const buildLayer = (cfg, stackEl) => {
        const layerEl = document.createElement("div");
        layerEl.className = `grass-layer grass-layer--${cfg.id}`;
        layerEl.setAttribute("aria-hidden", "true");
        layerEl.dataset.layer = cfg.id;
        layerEl.style.opacity = String(cfg.opacity);

        const layerTiles = [];
        const rowCount = cfg.rows ?? 1;

        if (rowCount > 1) {
          for (let r = 0; r < rowCount; r++) {
            const rowEl = document.createElement("div");
            rowEl.className = `grass-back-row grass-back-row--${r}`;
            rowEl.dataset.row = String(r);
            rowEl.style.setProperty("--tile-count", String(tiles));
            appendGrassTiles(rowEl, tiles, cfg.src, layerTiles);
            layerEl.appendChild(rowEl);
          }
        } else {
          layerEl.style.setProperty("--tile-count", String(tiles));
          appendGrassTiles(layerEl, tiles, cfg.src, layerTiles);
        }

        stackEl.appendChild(layerEl);
        return { layerEl, layerTiles };
      };

      const lowerStack = document.createElement("div");
      lowerStack.className = "grass-stack grass-stack--lower";
      zone.appendChild(lowerStack);

      let upperStack = null;
      if (doubled) {
        upperStack = document.createElement("div");
        upperStack.className = "grass-stack grass-stack--upper";
        zone.appendChild(upperStack);
      }

      GRASS_LAYER_CONFIG.forEach((cfg) => {
        const primary = buildLayer(cfg, lowerStack);
        layerEls.push(primary.layerEl);
        allTiles.push(primary.layerTiles);

        if (upperStack) {
          const mirror = buildLayer(cfg, upperStack);
          mirrorLayerEls.push(mirror.layerEl);
          mirrorAllTiles.push(mirror.layerTiles);
        }
      });

      if (!particlesRef.current) {
        const particlesContainer = document.createElement("div");
        particlesContainer.className = "grass-ambient";
        particlesContainer.setAttribute("aria-hidden", "true");
        zone.appendChild(particlesContainer);
        particlesRef.current = particlesContainer;
      } else {
        zone.appendChild(particlesRef.current);
      }

      layerElsRef.current = layerEls;
      mirrorLayerElsRef.current = mirrorLayerEls;
      tileElsRef.current = doubled
        ? allTiles.map((layerTiles, i) => [
            ...mirrorAllTiles[i],
            ...layerTiles,
          ])
        : allTiles;
      mirrorTileElsRef.current = mirrorAllTiles;
      simRef.current = GRASS_LAYER_CONFIG.map((cfg) =>
        createLayerState(cfg, tiles)
      );
      return true;
    };

    const ensureBuilt = () => {
      if (!simRef.current?.length) build();
    };

    ensureBuilt();

    preloadGrassMasks(GRASS_LAYER_CONFIG.map((c) => c.src)).then(() => {
      Promise.all(GRASS_LAYER_CONFIG.map((c) => loadGrassMask(c.src))).then(
        (masks) => {
          layerMasksRef.current = masks.filter(Boolean);
        }
      );
    });

    const phoneMq = window.matchMedia("(max-width: 767px) and (pointer: coarse)");
    const onPhoneLayoutChange = () => {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => build());
    };
    phoneMq.addEventListener("change", onPhoneLayoutChange);

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(() => {
        build();
      });
    });
    ro.observe(zone);

    const loop = (now) => {
      const dt = Math.min(now - lastTimeRef.current, 48);
      lastTimeRef.current = now;

      ensureBuilt();

      const sim = simRef.current;
      const tileNodes = tileElsRef.current;
      const layerNodes = layerElsRef.current;
      const mirrorLayerNodes = mirrorLayerElsRef.current;
      const mirrorTileNodes = mirrorTileElsRef.current;
      const reduced = reducedMotionRef.current;

      if (sim?.length && tileNodes?.length && layerNodes?.length) {
        const windSample = reduced
          ? { dirX: 0.5, dirY: 0, strength: 0.2, gust: 0, ripple: 0, pulse: 0 }
          : stepWind(windRef.current, now, dt, windMultiplier);

        if (!reduced) {
          stepGrassLayers(sim, pointerRef.current, now, windSample);
        }

        for (let li = 0; li < sim.length; li++) {
          const layer = sim[li];
          const cfg = layer.config;
          const primaryTiles =
            mirrorTileNodes[li]?.length > 0
              ? tileNodes[li]?.slice(-layer.cols) ?? []
              : tileNodes[li] ?? [];
          const layerEl = layerNodes[li];
          const mirrorEl = mirrorLayerNodes[li];
          const mirrorTiles = mirrorTileNodes[li];

          let layerTransform;
          if (!reduced) {
            layerTransform = `translate3d(${layer.layerTx.toFixed(2)}px, ${(cfg.offsetY + layer.layerTy).toFixed(2)}px, 0) scale(${cfg.scale}) rotate(${layer.layerAngle.toFixed(3)}deg)`;
            layerEl.style.transform = layerTransform;
            if (mirrorEl) mirrorEl.style.transform = layerTransform;

            for (let i = 0; i < layer.cols; i++) {
              const angle = layer.angles[i];
              const tx = layer.translates[i];
              const tileTransform = `translate3d(${tx.toFixed(2)}px, 0, 0) rotate(${angle.toFixed(3)}deg)`;
              if (primaryTiles[i]) primaryTiles[i].style.transform = tileTransform;
              if (mirrorTiles?.[i]) mirrorTiles[i].style.transform = tileTransform;
            }
          } else {
            layerTransform = `translate3d(0, ${cfg.offsetY}px, 0) scale(${cfg.scale})`;
            layerEl.style.transform = layerTransform;
            if (mirrorEl) mirrorEl.style.transform = layerTransform;
            for (let i = 0; i < layer.cols; i++) {
              if (primaryTiles[i]) primaryTiles[i].style.transform = "translate3d(0, 0, 0)";
              if (mirrorTiles?.[i]) mirrorTiles[i].style.transform = "translate3d(0, 0, 0)";
            }
          }
        }

        const particlesEl = particlesRef.current;
        if (particlesEl && !reduced) {
          stepParticles(particlesSimRef.current, now, windSample);
          applyParticles(
            particlesEl,
            particlesSimRef.current,
            zone.clientWidth,
            zone.clientHeight,
            windSample.strength
          );
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(loop);

    const onPointerMove = (e) => {
      applyPointer(e.clientX, e.clientY);
    };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      applyPointer(e.clientX, e.clientY);
      if (pointerRef.current.timerActive || pointerRef.current.hoverLayer >= 0) {
        pointerRef.current.pressing = true;
      }
    };

    const onPointerUp = (e) => {
      pointerRef.current.pressing = false;
      applyPointer(e.clientX, e.clientY);
    };

    const onPointerLeaveWindow = (e) => {
      if (e.relatedTarget != null) return;
      clearPointer();
    };

    const onWindowBlur = () => clearPointer();

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") clearPointer();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerLeaveWindow);
    document.addEventListener("pointerleave", onPointerLeaveWindow);
    zone.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("blur", onWindowBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(resizeRafRef.current);
      ro.disconnect();
      motionMq.removeEventListener("change", onMotionChange);
      phoneMq.removeEventListener("change", onPhoneLayoutChange);
      zone.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerLeaveWindow);
      document.removeEventListener("pointerleave", onPointerLeaveWindow);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [windMultiplier, onGrassMovingChange]);

  return (
    <section
      ref={zoneRef}
      className="grass-zone pog-touch-guard"
      aria-label="Interactive lawn — move through the grass"
    />
  );
}
