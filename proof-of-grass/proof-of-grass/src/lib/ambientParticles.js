/**
 * Very subtle pollen / dust — GPU transforms only, low particle count.
 */

const MAX = 16;

export function createParticleField() {
  const particles = [];
  for (let i = 0; i < MAX; i++) {
    particles.push({
      x: Math.random(),
      y: Math.random(),
      size: 0.6 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.00004 + Math.random() * 0.00006,
      drift: (Math.random() - 0.5) * 0.00008,
      opacity: 0.08 + Math.random() * 0.14,
    });
  }
  return { particles };
}

export function stepParticles(field, time, wind) {
  for (const p of field.particles) {
    p.x += p.drift + wind.dirX * 0.000012 * wind.strength;
    p.y -= p.speed;
    p.x += Math.sin(time * p.speed * 80000 + p.phase) * 0.000008;

    if (p.y < -0.05) {
      p.y = 1 + Math.random() * 0.1;
      p.x = Math.random();
    }
    if (p.x < -0.05) p.x = 1.05;
    if (p.x > 1.05) p.x = -0.05;
  }
}

export function applyParticles(container, field, width, height, windStrength = 1) {
  const nodes = container.children;
  const { particles } = field;
  const alphaScale = 0.75 + windStrength * 0.25;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    let el = nodes[i];
    if (!el) {
      el = document.createElement("span");
      el.className = "grass-ambient-particle";
      el.setAttribute("aria-hidden", "true");
      container.appendChild(el);
    }
    const px = p.x * width;
    const py = p.y * height;
    const wobble = Math.sin(p.phase + p.y * 12) * 2;
    el.style.transform = `translate3d(${px + wobble}px, ${py}px, 0)`;
    el.style.opacity = String(p.opacity * alphaScale);
  }
}
