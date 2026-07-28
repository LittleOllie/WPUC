import { stableHash } from "@/lib/wallet-dna/utils/helpers";

type Props = {
  walletAddress: string;
  size?: number;
  className?: string;
};

/** Decorative identicon — not a security or identity verification feature. */
export function WalletFingerprint({ walletAddress, size = 48, className }: Props) {
  const seed = stableHash(`${walletAddress}:fingerprint`);
  const cells = 5;
  const cellSize = size / cells;
  const rects: Array<{ x: number; y: number; fill: string }> = [];

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < Math.ceil(cells / 2); x++) {
      const bit = (seed >> ((y * 3 + x) % 28)) & 1;
      if (!bit) continue;
      const fill = y % 2 === 0 ? "#4c6fff" : "#6de0ff";
      rects.push({ x: x * cellSize, y: y * cellSize, fill });
      rects.push({ x: (cells - 1 - x) * cellSize, y: y * cellSize, fill });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label="Decorative wallet fingerprint pattern"
    >
      <rect width={size} height={size} fill="rgba(76,111,255,0.08)" rx={6} />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={cellSize - 1} height={cellSize - 1} fill={r.fill} opacity={0.75} rx={1} />
      ))}
    </svg>
  );
}
