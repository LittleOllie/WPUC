import { waveOffset } from "./windSystem.js";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createLayerState(config, cols) {
  return {
    config,
    cols,
    angles: new Float32Array(cols),
    velocities: new Float32Array(cols),
    translates: new Float32Array(cols),
    translateVel: new Float32Array(cols),
    layerAngle: 0,
    layerAngleVel: 0,
    layerTx: 0,
    layerTy: 0,
    layerTxVel: 0,
    layerTyVel: 0,
  };
}

/**
 * Wind + hover wobble on a single grass PNG tile.
 * @param {ReturnType<typeof createLayerState>[]} layers
 * @param {{ active: boolean, hoverLayer: number, hoverTile: number, pressing: boolean, vx: number }} pointer
 * @param {number} time ms
 * @param {{ dirX: number, dirY: number, strength: number, gust: number, ripple: number, pulse: number }} wind
 */
export function stepGrassLayers(layers, pointer, time, wind) {
  const globalSway =
    (Math.sin(time * 0.0005) * 0.52 + Math.sin(time * 0.00031 + 1.8) * 0.32) *
    wind.strength;

  const hoverLayer = pointer.hoverLayer >= 0 ? pointer.hoverLayer : -1;
  const hoverTile = pointer.hoverTile >= 0 ? pointer.hoverTile : -1;

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const cfg = layer.config;
    const cols = layer.cols;
    const parallax = cfg.parallax * wind.strength;
    const isHoveredLayer = layerIdx === hoverLayer;

    const layerWindTarget =
      globalSway * cfg.layerSway +
      wind.pulse * 0.35 * cfg.layerSway +
      wind.gust * 0.5 * cfg.layerSway;

    const layerTxTarget =
      wind.dirX * parallax * (4.5 + wind.gust * 2.5) +
      Math.sin(time * 0.00044 + cfg.phaseOffset) * parallax * 1.2;

    const layerTyTarget =
      wind.dirY * parallax * 1.4 +
      Math.sin(time * 0.00038 + cfg.phaseOffset * 0.5) * 0.5 * parallax;

    layer.layerAngleVel += (layerWindTarget - layer.layerAngle) * 0.028;
    layer.layerAngleVel *= 0.9;
    layer.layerAngle += layer.layerAngleVel;
    layer.layerAngle = clamp(layer.layerAngle, -3 * cfg.layerSway, 3 * cfg.layerSway);

    layer.layerTxVel += (layerTxTarget - layer.layerTx) * 0.028;
    layer.layerTxVel *= 0.9;
    layer.layerTx += layer.layerTxVel;

    layer.layerTyVel += (layerTyTarget - layer.layerTy) * 0.028;
    layer.layerTyVel *= 0.9;
    layer.layerTy += layer.layerTyVel;

    for (let i = 0; i < cols; i++) {
      const normX = cols > 1 ? i / (cols - 1) : 0.5;
      const phase = i * cfg.phaseStep + cfg.phaseOffset;
      const colOffset = waveOffset(normX, time, wind.ripple, cfg.phaseOffset, 1);

      const ambient =
        (Math.sin(time * cfg.windSpeed1 + phase) * cfg.windAmp1 +
          Math.sin(time * cfg.windSpeed2 + phase * 1.13) * cfg.windAmp2 +
          colOffset * cfg.windAmp1 * 0.55) *
        wind.strength;

      let target = ambient;
      let targetTx = colOffset * cfg.translateGain * 0.38 * wind.strength;

      const isHoveredTile = isHoveredLayer && i === hoverTile;
      if (isHoveredTile) {
        const wobblePhase = time * 0.0055 + cfg.phaseOffset + i * 0.9;
        const sway =
          Math.sin(wobblePhase) * cfg.maxBend * cfg.interactGain * 1.15 +
          Math.sin(wobblePhase * 1.7 + 0.6) * cfg.maxBend * cfg.interactGain * 0.45;

        const dragBoost =
          Math.abs(pointer.vx) > 0.0006
            ? Math.sign(pointer.vx) * Math.abs(pointer.vx) * cfg.maxBend * 8
            : 0;

        target += sway + dragBoost;
        targetTx +=
          Math.sin(wobblePhase * 1.25) * cfg.translateGain * 0.55 +
          Math.cos(wobblePhase * 0.85) * cfg.translateGain * 0.25;
      }

      const stiff = isHoveredTile ? cfg.stiffnessActive : cfg.stiffnessIdle;

      layer.velocities[i] += (target - layer.angles[i]) * stiff;
      layer.velocities[i] *= cfg.damping;
      layer.angles[i] += layer.velocities[i];
      layer.angles[i] = clamp(layer.angles[i], -cfg.maxAngle, cfg.maxAngle);

      layer.translateVel[i] += (targetTx - layer.translates[i]) * stiff * 1.2;
      layer.translateVel[i] *= cfg.damping;
      layer.translates[i] += layer.translateVel[i];
      layer.translates[i] = clamp(layer.translates[i], -14, 14);
    }
  }
}
