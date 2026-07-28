import type { WalletBadge } from "@/lib/wallet-dna/types";

type Props = {
  badges: WalletBadge[];
  visible: boolean;
};

function badgeLabel(name: string): string {
  return name
    .replace(/^Collection Explorer$/, "Explorer")
    .replace(/^One Collection Crew$/, "1-Collection Crew")
    .replace(/^NFT Veteran$/, "Veteran");
}

export function WalletPassportBadges({ badges, visible }: Props) {
  if (!visible || !badges.length) return null;

  return (
    <div className="wdna-dna-card__badges">
      {badges.map((b) => (
        <span key={b.id} className="wdna-dna-card__badge">
          {badgeLabel(b.name)}
        </span>
      ))}
    </div>
  );
}
