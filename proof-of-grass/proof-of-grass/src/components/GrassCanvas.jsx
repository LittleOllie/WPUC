import { useCallback, useEffect, useRef } from "react";
import {
  createGrassField,
  resizeGrassField,
  updateAndDrawGrass,
} from "../lib/grassEngine.js";

export default function GrassCanvas({
  progression,
  onInteraction,
  wind = 0.5,
  weather,
  transparentBase = true,
}) {
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const pointerRef = useRef({ x: -999, y: -999, active: false });
  const rafRef = useRef(0);
  const lastRef = useRef(performance.now());
  const movingRef = useRef(false);

  const setPointer = useCallback((x, y, active) => {
    pointerRef.current = { x, y, active };
    if (active) {
      movingRef.current = true;
      onInteraction?.();
    }
  }, [onInteraction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const density = w < 500 ? 0.75 : 1;
      fieldRef.current = fieldRef.current
        ? resizeGrassField(fieldRef.current, canvas.width, canvas.height, density)
        : createGrassField(canvas.width, canvas.height, density);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const loop = (now) => {
      const dt = now - lastRef.current;
      lastRef.current = now;
      const ctx = canvas.getContext("2d");
      if (ctx && fieldRef.current) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(canvas.width / canvas.offsetWidth, canvas.height / canvas.offsetHeight);
        updateAndDrawGrass(ctx, fieldRef.current, {
          pointer: pointerRef.current,
          pointerActive: pointerRef.current.active,
          wind: weather === "rain" ? 1.2 : wind,
          time: now,
          progression,
          transparentBase,
        });
      }
      if (movingRef.current && pointerRef.current.active) {
        onInteraction?.();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [progression, wind, weather, onInteraction]);

  const localCoords = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = canvasRef.current.width / rect.width;
    return {
      x: (clientX - rect.left) * dpr,
      y: (clientY - rect.top) * dpr,
    };
  };

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full touch-none"
      aria-label="Interactive lawn — rub the grass to relax"
      onPointerMove={(e) => {
        const { x, y } = localCoords(e.clientX, e.clientY);
        setPointer(x, y, true);
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const { x, y } = localCoords(e.clientX, e.clientY);
        setPointer(x, y, true);
      }}
      onPointerUp={(e) => {
        setPointer(-999, -999, false);
        movingRef.current = false;
      }}
      onPointerLeave={() => {
        if (!movingRef.current) setPointer(-999, -999, false);
      }}
      onPointerCancel={() => setPointer(-999, -999, false)}
    />
  );
}
