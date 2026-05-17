/**
 * Procedural outdoor wind — slow direction drift, soft pulses, occasional gusts.
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothNoise(t) {
  return (
    Math.sin(t * 0.37) * 0.5 +
    Math.sin(t * 0.61 + 1.7) * 0.3 +
    Math.sin(t * 0.19 + 4.2) * 0.2
  );
}

export function createWindState() {
  return {
    dirX: 0.6,
    dirY: 0.1,
    targetDirX: 0.6,
    targetDirY: 0.1,
    strength: 0.45,
    targetStrength: 0.45,
    pulse: 0,
    ripple: 0,
    gust: 0,
    nextGustAt: 0,
    nextTargetAt: 0,
  };
}

function pickTarget(state, time) {
  const n = smoothNoise(time * 0.00008);
  state.targetDirX = lerp(0.35, 1, (n + 1) * 0.5);
  state.targetDirY = Math.sin(time * 0.00005 + 2.1) * 0.15;
  state.targetStrength = 0.32 + (Math.sin(time * 0.00012 + 1.3) + 1) * 0.22;
  state.nextTargetAt = time + 12000 + Math.random() * 18000;
}

function maybeGust(state, time) {
  if (time < state.nextGustAt) return;
  state.gust = 0.35 + Math.random() * 0.25;
  state.nextGustAt = time + 14000 + Math.random() * 22000;
}

export function stepWind(state, time, dtMs, multiplier = 1) {
  if (time >= state.nextTargetAt) pickTarget(state, time);
  maybeGust(state, time);

  const dt = Math.min(dtMs, 48) * 0.001;
  const ease = 1 - Math.pow(0.04, dt);

  state.dirX = lerp(state.dirX, state.targetDirX, ease);
  state.dirY = lerp(state.dirY, state.targetDirY, ease);
  state.strength = lerp(state.strength, state.targetStrength, ease);

  state.pulse = smoothNoise(time * 0.0009);
  state.ripple += dtMs * 0.00055;

  state.gust *= Math.pow(0.92, dtMs / 16);
  if (state.gust < 0.01) state.gust = 0;

  const strength =
    (state.strength + state.pulse * 0.12 + state.gust) * multiplier;

  return {
    dirX: state.dirX,
    dirY: state.dirY,
    strength,
    gust: state.gust,
    ripple: state.ripple,
    pulse: state.pulse,
  };
}

/** Rolling wave offset for a column (0–1 along width). */
export function waveOffset(normX, time, ripple, layerPhase, amp = 1) {
  const x = normX * Math.PI * 2.4 + layerPhase;
  return (
    (Math.sin(time * 0.00065 + x + ripple) * 0.55 +
      Math.sin(time * 0.00042 + x * 1.35 + ripple * 0.7) * 0.35 +
      Math.sin(time * 0.00028 + x * 0.6 + layerPhase) * 0.2) *
    amp
  );
}
