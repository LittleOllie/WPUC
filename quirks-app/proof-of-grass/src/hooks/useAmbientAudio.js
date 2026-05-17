import { useEffect, useRef, useCallback } from "react";

/**
 * Procedural ambient layers — no asset files required.
 */
export function useAmbientAudio(muted, weather = "sunny") {
  const ctxRef = useRef(null);
  const nodesRef = useRef(null);

  const stop = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes) return;
    try {
      nodes.gain.gain.exponentialRampToValueAtTime(0.001, nodes.ctx.currentTime + 0.4);
      setTimeout(() => {
        nodes.osc?.stop();
        nodes.noise?.stop();
        nodes.ctx?.close();
      }, 500);
    } catch {
      /* ignore */
    }
    nodesRef.current = null;
    ctxRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (muted || nodesRef.current) return;
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = weather === "night" ? 110 : 165;
      const oscGain = ctx.createGain();
      oscGain.gain.value = weather === "night" ? 0.04 : 0.02;
      osc.connect(oscGain);
      oscGain.connect(gain);
      osc.start();

      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = weather === "rain" ? 400 : 680;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = weather === "rain" ? 0.06 : 0.035;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(gain);
      noise.start();

      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 1.2);

      nodesRef.current = { ctx, gain, osc, noise };
      ctxRef.current = ctx;
    } catch {
      /* autoplay blocked */
    }
  }, [muted, weather]);

  useEffect(() => {
    if (muted) {
      stop();
      return;
    }
    start();
    return stop;
  }, [muted, weather, start, stop]);

  return { resume: () => ctxRef.current?.resume?.() };
}
