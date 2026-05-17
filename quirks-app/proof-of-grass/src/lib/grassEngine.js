/**
 * Canvas grass field — spring-damped blades with pointer repulsion + wind.
 */

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function createGrassField(width, height, density = 1) {
  const blades = [];
  const cols = Math.floor((width / 9) * density);
  const rows = Math.floor((height / 14) * density);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jitterX = (Math.random() - 0.5) * 8;
      const jitterY = (Math.random() - 0.5) * 4;
      const x = (col / cols) * width + jitterX + 4;
      const baseY = height - 2 + jitterY;
      blades.push({
        x,
        baseY,
        height: 18 + Math.random() * 28,
        width: 1.4 + Math.random() * 1.2,
        hue: 118 + Math.random() * 22,
        light: 38 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        angle: 0,
        velocity: 0,
        bend: 0,
      });
    }
  }

  return { blades, width, height };
}

export function resizeGrassField(field, width, height, density = 1) {
  if (field.width === width && field.height === height) return field;
  return createGrassField(width, height, density);
}

const particles = [];

export function spawnGrassParticle(x, y) {
  if (particles.length > 40) particles.shift();
  particles.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 1.2,
    vy: -0.5 - Math.random() * 1.5,
    life: 1,
    size: 1 + Math.random() * 2,
  });
}

export function updateAndDrawGrass(ctx, field, opts) {
  const {
    pointer,
    pointerActive,
    wind,
    time,
    dpr = 1,
    progression = 0,
    transparentBase = false,
  } = opts;

  const { blades, width, height } = field;
  const influence = pointerActive ? 72 : 0;
  const strength = 0.85;

  ctx.clearRect(0, 0, width, height);

  if (!transparentBase) {
    const soilGrad = ctx.createLinearGradient(0, height * 0.35, 0, height);
    soilGrad.addColorStop(0, "#3d7a48");
    soilGrad.addColorStop(0.4, "#2f6b3c");
    soilGrad.addColorStop(1, "#245a32");
    ctx.fillStyle = soilGrad;
    ctx.fillRect(0, height * 0.25, width, height);
  }

  for (const blade of blades) {
    const windSway =
      Math.sin(time * 0.0012 + blade.phase + blade.x * 0.02) * 0.12 * (1 + wind * 0.5);

    let target = windSway;

    if (pointer && pointerActive) {
      const dx = blade.x - pointer.x;
      const dy = blade.baseY - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < influence && dist > 0.1) {
        const falloff = 1 - dist / influence;
        const push = strength * falloff * falloff;
        target += (dx / dist) * push * 1.4;
        if (falloff > 0.6 && Math.random() < 0.02) {
          spawnGrassParticle(blade.x, blade.baseY - blade.height * 0.5);
        }
      }
    }

    const stiffness = pointerActive ? 0.14 : 0.08;
    const damping = pointerActive ? 0.78 : 0.88;
    blade.velocity += (target - blade.angle) * stiffness;
    blade.velocity *= damping;
    blade.angle += blade.velocity;

    const tipX = Math.sin(blade.angle) * blade.height * 0.15;
    const tipY = -blade.height;

    ctx.save();
    ctx.translate(blade.x, blade.baseY);
    ctx.rotate(blade.angle);

    const grad = ctx.createLinearGradient(0, 0, 0, tipY);
    grad.addColorStop(0, `hsl(${blade.hue} 42% ${blade.light - 12}%)`);
    grad.addColorStop(0.55, `hsl(${blade.hue} 48% ${blade.light}%)`);
    grad.addColorStop(1, `hsl(${blade.hue + 8} 52% ${blade.light + 14}%)`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = blade.width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(tipX * 0.5, tipY * 0.55, tipX, tipY);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 0.025;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `rgba(180, 255, 140, ${p.life * 0.5})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  if (progression >= 1) drawDecorations(ctx, field, time, progression);
}

function drawDecorations(ctx, field, time, progression) {
  const { width, height } = field;
  const flowerCount = 2 + progression * 2;
  const seed = 42;

  for (let i = 0; i < flowerCount; i++) {
    const fx = ((seed * (i + 1) * 97) % 1000) / 1000;
    const x = 24 + fx * (width - 48);
    const y = height - 8 - (i % 3) * 4;
    const bob = Math.sin(time * 0.002 + i) * 2;
    drawFlower(ctx, x, y + bob, i);
  }

  if (progression >= 2) {
    const mx = width * 0.72;
    drawMushroom(ctx, mx, height - 6, time);
  }
}

function drawFlower(ctx, x, y, i) {
  const colors = ["#ff8fab", "#ffd166", "#a8e6cf", "#c9b1ff"];
  const c = colors[i % colors.length];
  ctx.fillStyle = c;
  for (let p = 0; p < 5; p++) {
    const a = (p / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 2, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffdd55";
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawMushroom(ctx, x, y, time) {
  const wobble = Math.sin(time * 0.0015) * 0.5;
  ctx.fillStyle = "#f5e6d3";
  ctx.fillRect(x - 2, y - 10 + wobble, 4, 10);
  ctx.fillStyle = "#e85d5d";
  ctx.beginPath();
  ctx.ellipse(x, y - 12 + wobble, 8, 5, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(x - 3, y - 14 + wobble, 2, 0, Math.PI * 2);
  ctx.arc(x + 2, y - 12 + wobble, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

export function formatGrassTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
