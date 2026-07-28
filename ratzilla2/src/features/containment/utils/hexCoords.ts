import type { AxialCoord, Vec2 } from "../types";

export const HEX_SIZE = 42;

export function axialToPixel(coord: AxialCoord, size = HEX_SIZE): Vec2 {
  const x = size * (Math.sqrt(3) * coord.q + (Math.sqrt(3) / 2) * coord.r);
  const y = size * ((3 / 2) * coord.r);
  return { x, y };
}

export function axialDistance(a: AxialCoord, b: AxialCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export const AXIAL_NEIGHBORS: AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function neighborCoord(coord: AxialCoord, direction: number): AxialCoord {
  const d = AXIAL_NEIGHBORS[direction % 6]!;
  return { q: coord.q + d.q, r: coord.r + d.r };
}

export function corridorOrientation(
  from: Vec2,
  to: Vec2,
): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function hexCorners(center: Vec2, size = HEX_SIZE): Vec2[] {
  const corners: Vec2[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}
