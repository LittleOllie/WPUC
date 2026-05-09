export function createTimeline({ speed = 1 } = {}) {
  const s = Math.max(0.85, Math.min(1.25, speed));

  // 45-second scripted demo (impact times). No randomness.
  const events = [
    { time: 3.0, action: "jump", obstacle: "toyBlocks", lane: "center" },
    { time: 6.0, action: "duck", obstacle: "lowBar", lane: "center" },
    { time: 9.0, action: "left", obstacle: "conesRight", lane: "right" },
    { time: 12.0, action: "right", obstacle: "conesLeft", lane: "left" },
    { time: 15.0, action: "punch", obstacle: "foamTarget", lane: "center" },
    { time: 18.0, action: "jump", obstacle: "puddle", lane: "center" },
    { time: 21.0, action: "duck", obstacle: "rainbowBar", lane: "center" },
    { time: 24.0, action: "left", obstacle: "conesRight", lane: "right" },
    { time: 27.0, action: "right", obstacle: "conesLeft", lane: "left" },
    { time: 30.0, action: "jump", obstacle: "crate", lane: "center" },
    { time: 32.0, action: "duck", obstacle: "lowSign", lane: "center" },
    { time: 34.0, action: "punch", obstacle: "balloonTarget", lane: "center" },
    { time: 36.0, action: "left", obstacle: "conesRight", lane: "right" },
    { time: 38.0, action: "right", obstacle: "conesLeft", lane: "left" },
    { time: 40.0, action: "jump", obstacle: "finishRamp", lane: "center" },
  ].map((e) => ({ ...e, time: e.time / s }));

  // Finish line celebration window.
  const endAt = 45 / s;
  return { events, endAt };
}

