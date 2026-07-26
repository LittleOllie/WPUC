import { IMAGE_CONFIG, type RingKey } from "@/lib/config";

export interface AvatarSlot {
  x: number;
  y: number;
  size: number;
  angle: number;
}

const RING_OFFSETS: Record<RingKey, number> = {
  inner: 0,
  besties: 15,
  goodFriends: 7,
  community: 22,
};

export function computeAvatarPositions(ring: RingKey, count: number): AvatarSlot[] {
  if (count <= 0) return [];

  const size = IMAGE_CONFIG.canvasSize;
  const cx = size / 2;
  const cy = size / 2;
  const radius = IMAGE_CONFIG.ringRadii[ring];
  const avatarSize = IMAGE_CONFIG.ringAvatarSizes[ring];
  const offsetDeg = RING_OFFSETS[ring];
  const step = (2 * Math.PI) / count;

  const slots: AvatarSlot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = offsetDeg * (Math.PI / 180) + i * step - Math.PI / 2;
    slots.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      size: avatarSize,
      angle,
    });
  }
  return slots;
}

export function pngFilename(username: string, date = new Date()): string {
  const d = date.toISOString().slice(0, 10);
  return `x-inner-circle-${username.toLowerCase()}-${d}.png`;
}

export { IMAGE_CONFIG };
