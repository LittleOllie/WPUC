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
import {
  MOBILE_DRAG_SENSITIVITY,
  MOBILE_HIT_PAD_RATIO,
} from "../lib/mobileGrass.js";
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

function layerConfigsForMode(portrait) {
  if (portrait) {
    return GRASS_LAYER_CONFIG.filter((c) => c.id !== "back");
  }
  /* Ultra Grass: front + middle only — back row sits too high on screen */
  return GRASS_LAYER_CONFIG.filter((c) => c.id !== "back");
}

/** Behind-stacks for thickness; portrait gets two, Ultra Grass one */
function fillStacksForMode(portrait) {
  if (portrait) {
    return ["grass-stack--fill-2", "grass-stack--fill"];
  }
  return ["grass-stack--fill"];
}

/** Extended lawn hit when finger is above visible blades (mobile pad band) */
function resolveMobilePadHover(clientX, clientY, rect, tileNodes, cols) {
  const pad = rect.height * MOBILE_HIT_PAD_RATIO;
  if (
    clientY < rect.top - pad ||
    clientY > rect.bottom ||
    clientX < rect.left ||
    clientX > rect.right
  ) {
    return null;
  }

  const layer = tileNodes.length - 1;
  const tile = clamp(
    Math.floor(((clientX - rect.left) / rect.width) * cols),
    0,
    cols - 1
  );
  return { layer, tile };
}

export default function LayeredGrass({
  wind: windMultiplier = 1,
  onGrassMovingChange,
  portrait: portraitMode = true,
}) {
  const zoneRef = useRef(null);
  const onGrassMovingChangeRef = useRef(onGrassMovingChange);
  const lastMovingNotifyRef = useRef(false);
  const particlesRef = useRef(null);
  const layerElsRef = useRef([]);
  const tileElsRef = useRef([]);
  const fillLayerElsRef = useRef([]);
  const fillTileElsRef = useRef([]);
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

      const portrait = Boolean(portraitMode);
      const cols = simRef.current?.[0]?.cols ?? TILES_MIN;

      const activeMasks = layerConfigsForMode(portrait).map((cfg) => {
        const i = GRASS_LAYER_CONFIG.findIndex((c) => c.id === cfg.id);
        return masks[i];
      });

      let hovered =
        tileNodes?.length && activeMasks?.length
          ? findHoveredGrassTile(clientX, clientY, tileNodes, activeMasks)
          : null;

      if (hovered && cols && hovered.tile >= cols) {
        hovered = { layer: hovered.layer, tile: hovered.tile % cols };
      }

      if (!hovered && portrait && tileNodes?.length) {
        hovered = resolveMobilePadHover(clientX, clientY, rect, tileNodes, cols);
      }

      const x = clamp((clientX - rect.left) / rect.width, 0, 1);
      const vxRaw = hovered ? x - prevPointerXRef.current : p.vx * 0.82;
      const vx = portrait && hovered ? vxRaw * MOBILE_DRAG_SENSITIVITY : vxRaw;
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
      const portrait = Boolean(portraitMode);

      zone
        .querySelectorAll(
          ".grass-stack--fill, .grass-stack--fill-2, .grass-layer, .grass-zone__hit-pad, .grass-touch-shield"
        )
        .forEach((el) => el.remove());
      zone.classList.toggle("grass-zone--portrait", portrait);

      const layerEls = [];
      const allTiles = [];

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
          img.addEventListener("contextmenu", (e) => e.preventDefault());

          tile.appendChild(img);
          parent.appendChild(tile);
          layerTiles.push(tile);
        }
      };

      const buildLayer = (cfg, parentEl) => {
        const layerEl = document.createElement("div");
        layerEl.className = `grass-layer grass-layer--${cfg.id}`;
        layerEl.setAttribute("aria-hidden", "true");
        layerEl.dataset.layer = cfg.id;
        layerEl.style.opacity = String(cfg.opacity);

        const layerTiles = [];
        if (cfg.id === "back") {
          const rowEl = document.createElement("div");
          rowEl.className = "grass-back-row grass-back-row--3";
          rowEl.dataset.row = "3";
          rowEl.style.setProperty("--tile-count", String(tiles));
          appendGrassTiles(rowEl, tiles, cfg.src, layerTiles);
          layerEl.appendChild(rowEl);
        } else {
          layerEl.style.setProperty("--tile-count", String(tiles));
          appendGrassTiles(layerEl, tiles, cfg.src, layerTiles);
        }

        parentEl.appendChild(layerEl);
        return { layerEl, layerTiles };
      };

      const layerConfigs = layerConfigsForMode(portrait);
      const allFillLayerEls = [];
      const allFillTileEls = [];

      fillStacksForMode(portrait).forEach((stackClass) => {
        const stackLayerEls = [];
        const stackTileEls = [];
        const fillStack = document.createElement("div");
        fillStack.className = stackClass;
        fillStack.setAttribute("aria-hidden", "true");
        layerConfigs.forEach((cfg) => {
          const fill = buildLayer(cfg, fillStack);
          stackLayerEls.push(fill.layerEl);
          stackTileEls.push(fill.layerTiles);
        });
        zone.appendChild(fillStack);
        allFillLayerEls.push(stackLayerEls);
        allFillTileEls.push(stackTileEls);
      });

      layerConfigs.forEach((cfg) => {
        const primary = buildLayer(cfg, zone);
        layerEls.push(primary.layerEl);
        allTiles.push(primary.layerTiles);
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

      if (portrait) {
        const hitPad = document.createElement("div");
        hitPad.className = "grass-zone__hit-pad pog-touch-guard";
        hitPad.setAttribute("aria-hidden", "true");
        zone.appendChild(hitPad);

        const touchShield = document.createElement("div");
        touchShield.className = "grass-touch-shield pog-touch-guard";
        touchShield.setAttribute("aria-hidden", "true");
        zone.appendChild(touchShield);
      }

      layerElsRef.current = layerEls;
      tileElsRef.current = allTiles;
      fillLayerElsRef.current = allFillLayerEls;
      fillTileElsRef.current = allFillTileEls;
      simRef.current = layerConfigs.map((cfg) =>
        createLayerState(cfg, tiles)
      );
      return true;
    };

    build();

    preloadGrassMasks(GRASS_LAYER_CONFIG.map((c) => c.src)).then(() => {
      Promise.all(GRASS_LAYER_CONFIG.map((c) => loadGrassMask(c.src))).then(
        (masks) => {
          layerMasksRef.current = masks.filter(Boolean);
        }
      );
    });

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

      const sim = simRef.current;
      const tileNodes = tileElsRef.current;
      const layerNodes = layerElsRef.current;
      const fillLayerNodes = fillLayerElsRef.current;
      const fillTileNodes = fillTileElsRef.current;
      const reduced = reducedMotionRef.current;
      const mobileEase = Boolean(portraitMode);

      if (sim?.length && tileNodes?.length && layerNodes?.length) {
        const windSample = reduced
          ? { dirX: 0.5, dirY: 0, strength: 0.2, gust: 0, ripple: 0, pulse: 0 }
          : stepWind(windRef.current, now, dt, windMultiplier);

        if (!reduced) {
          stepGrassLayers(sim, pointerRef.current, now, windSample, { mobileEase });
        }

        const layerCount = Math.min(sim.length, layerNodes.length);
        for (let li = 0; li < layerCount; li++) {
          const layer = sim[li];
          const cfg = layer.config;
          const layerTiles = tileNodes[li] ?? [];
          const layerEl = layerNodes[li];
          if (!layerEl) continue;
          let layerTransform;
          if (!reduced) {
            const tx = layer.layerTx.toFixed(2);
            const ty = (cfg.offsetY + layer.layerTy).toFixed(2);
            const rot = layer.layerAngle.toFixed(3);
            layerTransform = `translate3d(${tx}px, ${ty}px, 0) scale(${cfg.scale}) rotate(${rot}deg)`;
            layerEl.style.transform = layerTransform;

            for (let i = 0; i < layer.cols; i++) {
              const angle = layer.angles[i];
              const tileTx = layer.translates[i];
              const tileTransform = `translate3d(${tileTx.toFixed(2)}px, 0, 0) rotate(${angle.toFixed(3)}deg)`;
              if (layerTiles[i]) layerTiles[i].style.transform = tileTransform;
              for (let si = 0; si < fillTileNodes.length; si++) {
                const fillTiles = fillTileNodes[si]?.[li];
                if (fillTiles?.[i]) fillTiles[i].style.transform = tileTransform;
              }
            }
          } else {
            layerTransform = `translate3d(0, ${cfg.offsetY}px, 0) scale(${cfg.scale})`;
            layerEl.style.transform = layerTransform;
            for (let i = 0; i < layer.cols; i++) {
              if (layerTiles[i]) layerTiles[i].style.transform = "translate3d(0, 0, 0)";
              for (let si = 0; si < fillTileNodes.length; si++) {
                const fillTiles = fillTileNodes[si]?.[li];
                if (fillTiles?.[i]) fillTiles[i].style.transform = "translate3d(0, 0, 0)";
              }
            }
          }

          for (let si = 0; si < fillLayerNodes.length; si++) {
            const fillEl = fillLayerNodes[si]?.[li];
            if (fillEl) fillEl.style.transform = layerTransform;
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
      zone
        .querySelectorAll(
          ".grass-stack--fill, .grass-stack--fill-2, .grass-layer, .grass-zone__hit-pad, .grass-touch-shield"
        )
        .forEach((el) => el.remove());
      layerElsRef.current = [];
      tileElsRef.current = [];
      fillLayerElsRef.current = [];
      fillTileElsRef.current = [];
      simRef.current = null;
      motionMq.removeEventListener("change", onMotionChange);
      zone.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerLeaveWindow);
      document.removeEventListener("pointerleave", onPointerLeaveWindow);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", onWindowBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [windMultiplier, onGrassMovingChange, portraitMode]);

  return (
    <section
      ref={zoneRef}
      className="grass-zone pog-touch-guard"
      aria-label="Interactive lawn — move through the grass"
    />
  );
}
