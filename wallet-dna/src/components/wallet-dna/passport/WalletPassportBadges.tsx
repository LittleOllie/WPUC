import type { WalletBadge } from "@/lib/wallet-dna/types";

type Props = {
  badges: WalletBadge[];
  visible: boolean;
};

function badgeLabel(name: string): string {
  const labels: Record<string, string> = {
    "Collection Explorer": "Explorer",
    "One Collection Crew": "1-Collection Crew",
    "NFT Veteran": "Veteran",
    "Diamond Hands": "Diamond Hands",
    "Deep Freeze": "Deep Freeze",
    "Base Explorer": "Base Explorer",
    "World Traveller": "Traveller",
    "Loyal Holder": "Loyal Holder",
    "Vault Keeper": "Vault Keeper",
    "Base Native": "Base Native",
    "Mint Machine": "Mint Machine",
  };
  return labels[name] ?? name;
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
