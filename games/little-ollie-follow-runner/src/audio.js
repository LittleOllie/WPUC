import { clamp } from "./utils.js";

function makeGain(ctx, value = 1) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function osc(ctx, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  return o;
}

function noiseBuffer(ctx, seconds = 1) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, (seconds * rate) | 0);
  const buf = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.75;
  return buf;
}

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.muted = false;

    this._noise = null;
    this._footstepPhase = 0;
    this._lastStepAt = -999;
  }

  async init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = makeGain(this.ctx, 0.9);
    this.sfx = makeGain(this.ctx, 1.0);
    this.sfx.connect(this.master);
    this.master.connect(this.ctx.destination);
    this._noise = noiseBuffer(this.ctx, 0.6);
  }

  setMuted(m) {
    this.muted = !!m;
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.9;
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  resume() {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  stopAll() {
    // This synth is fire-and-forget, so nothing persistent to stop.
  }

  _playWhoosh(at, strength = 0.8) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = at ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(220, t0);
    bp.frequency.exponentialRampToValueAtTime(820, t0 + 0.22);
    bp.Q.value = 0.6;
    const g = makeGain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(clamp(0.18 * strength, 0.03, 0.22), t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.sfx);
    src.start(t0);
    src.stop(t0 + 0.32);
  }

  _playBeep(at, freq = 700, dur = 0.12, strength = 0.8) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = at ?? ctx.currentTime;
    const o = osc(ctx, "triangle", freq);
    const g = makeGain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(clamp(0.16 * strength, 0.02, 0.2), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  _playThump(at, strength = 0.9) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = at ?? ctx.currentTime;
    const o = osc(ctx, "sine", 120);
    const g = makeGain(ctx, 0.0001);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(clamp(0.18 * strength, 0.03, 0.22), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(64, t0 + 0.15);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t0);
    o.stop(t0 + 0.18);
  }

  playCountdownTick(n) {
    if (!this.ctx) return;
    const base = n === 1 ? 920 : 720;
    this._playBeep(this.ctx.currentTime, base, 0.09, 0.95);
  }

  playPromptCue(action) {
    if (!this.ctx) return;
    const map = { jump: 820, duck: 620, left: 740, right: 740, punch: 880 };
    this._playBeep(this.ctx.currentTime, map[action] || 720, 0.1, 0.95);
  }

  playWhoosh() {
    if (!this.ctx) return;
    this._playWhoosh(this.ctx.currentTime, 0.8);
  }

  playImpact(action) {
    if (!this.ctx) return;
    if (action === "punch") {
      this._playThump(this.ctx.currentTime, 1.0);
      this._playBeep(this.ctx.currentTime + 0.02, 980, 0.08, 0.6);
      return;
    }
    this._playThump(this.ctx.currentTime, 0.75);
  }

  playSuccess() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    this._playBeep(t0, 740, 0.08, 0.65);
    this._playBeep(t0 + 0.09, 940, 0.08, 0.75);
    this._playBeep(t0 + 0.18, 1120, 0.1, 0.85);
  }

  updateFootsteps(simTimeSec, speed = 1) {
    if (!this.ctx) return;
    const stepRate = 2.25 * clamp(speed, 0.8, 1.35); // steps per second
    const stepInterval = 1 / stepRate;

    if (simTimeSec - this._lastStepAt >= stepInterval) {
      this._lastStepAt = simTimeSec;
      const t0 = this.ctx.currentTime;

      // Soft alternating steps.
      const strength = 0.22 + 0.06 * Math.sin(this._footstepPhase);
      this._footstepPhase += Math.PI;
      this._playThump(t0, strength);
    }
  }
}

