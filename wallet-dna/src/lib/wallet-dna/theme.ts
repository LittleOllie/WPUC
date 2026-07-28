export const walletDNATheme = {
  background: "var(--wallet-dna-bg)",
  surface: "var(--wallet-dna-surface)",
  elevatedSurface: "var(--wdna-panel)",
  border: "var(--wallet-dna-border)",
  textPrimary: "var(--wallet-dna-text)",
  textSecondary: "var(--wallet-dna-muted)",
  action: "var(--wallet-dna-accent)",
  personalityAccent: "var(--lo-blue)",
} as const;

export const personalityAccents: Record<string, { accent: string; glow: string }> = {
  "multi-chain-explorer": { accent: "#38bdf8", glow: "rgba(56, 189, 248, 0.25)" },
  "diamond-collector": { accent: "#67e8f9", glow: "rgba(103, 232, 249, 0.22)" },
  "collection-loyalist": { accent: "#fbbf24", glow: "rgba(251, 191, 36, 0.22)" },
  "mint-hunter": { accent: "#fb923c", glow: "rgba(251, 146, 60, 0.22)" },
  "base-explorer": { accent: "#3b82f6", glow: "rgba(59, 130, 246, 0.25)" },
  "base-pioneer": { accent: "#2563eb", glow: "rgba(37, 99, 235, 0.25)" },
  "vault-keeper": { accent: "#a78bfa", glow: "rgba(167, 139, 250, 0.22)" },
  "balanced-collector": { accent: "#34d399", glow: "rgba(52, 211, 153, 0.2)" },
  "art-wanderer": { accent: "#c084fc", glow: "rgba(192, 132, 252, 0.2)" },
  "active-mover": { accent: "#f472b6", glow: "rgba(244, 114, 182, 0.2)" },
  "new-collector": { accent: "#94a3b8", glow: "rgba(148, 163, 184, 0.2)" },
  default: { accent: "#6366f1", glow: "rgba(99, 102, 241, 0.22)" },
};

export function accentForPersonality(id: string) {
  return personalityAccents[id] ?? personalityAccents.default;
}

export const EXPLORER_URLS = {
  ethereum: (contract: string, tokenId: string) =>
    `https://etherscan.io/nft/${contract}/${tokenId}`,
  base: (contract: string, tokenId: string) =>
    `https://basescan.org/nft/${contract}/${tokenId}`,
} as const;
