export const collections = [
  {
    id: "ddg",
    name: "DropDed Gorgez",
    shortName: "DDG",
    chain: "Ethereum",
    contract: "0x9c51a3cb5094b26aa1dcb380f3dc7e1a7c681c2d",
    openSea: "https://opensea.io/collection/gorgez",
    twitter: "https://x.com/DedGorgez",
    discord: "https://discord.gg/u4C6r7d4e6",
    website: "http://DedGorgez.com",
    logo: "/assets/collections/ddg/DDGLogo.png",
    theme: {
      primary: "#e63cb4",
      secondary: "#64d5df",
      background: "#12051f",
      accent: "#ff66cc",
    },
    vibe: "dark elegance, ritual, neon, premium collector energy",
    description:
      "DropDed Gorgez is a bold collector community built around striking art, strong identity, and Web3 culture.",
    tagline: "Beauty fades. Legends don't.",
    founderMessage:
      "We built DDG for collectors who want real connections — not just floor prices. TradePort helps our community find the right swaps safely.",
    activeTrades: 12,
    wantedCount: 8,
  },
  {
    id: "longlost",
    name: "The Long Lost",
    shortName: "Long Lost",
    chain: "Ethereum",
    contract: "0x1347a97789cd3aa0b11433e8117f55ab640a0451",
    openSea: "https://opensea.io/collection/the-long-lost",
    twitter: "https://x.com/LongLostNFT",
    discord: "",
    website: "https://longlostnft.com",
    logo: "/assets/collections/longlost/LLLogo.png",
    theme: {
      primary: "#8b3dff",
      secondary: "#39ff88",
      background: "#07030d",
      accent: "#c084fc",
    },
    vibe: "mystery, portals, conspiracy wall, underground, skater, purple glow",
    description:
      "The Long Lost is a mysterious, lore-driven community with underground energy, strong visuals, and a collector-first feel.",
    tagline: "Get LOST AF.",
    founderMessage:
      "Every piece tells a story. Use TradePort to find collectors who get the lore — and trade with people you can verify.",
    activeTrades: 9,
    wantedCount: 14,
  },
  {
    id: "quirkies",
    name: "Quirkies",
    shortName: "Quirkies",
    chain: "Ethereum",
    contract: "0xd4b7d9bb20fa20ddada9ecef8a7355ca983cccb1",
    openSea: "https://opensea.io/collection/quirkiesoriginals",
    twitter: "https://x.com/quirkiesnft",
    discord: "",
    website: "https://Quirkies.io",
    logo: "/assets/collections/quirkies/QuirkiesLogo.png",
    theme: {
      primary: "#00d4ff",
      secondary: "#ff4fa3",
      background: "#061427",
      accent: "#ffd84d",
    },
    vibe: "neon, playful chaos, arcade, colourful, energetic",
    description:
      "Quirkies is a colourful, energetic NFT community with playful art, big personality, and a strong collector culture.",
    tagline: "Collectibles. Lifestyle. Community.",
    founderMessage:
      "Quirkies is all about energy and community. TradePort makes it easy to say what you have and what you want — no marketplace noise.",
    activeTrades: 15,
    wantedCount: 11,
  },
];

export function getCollectionById(id) {
  return collections.find((c) => c.id === id) ?? null;
}

export function collectionThemeVars(theme) {
  if (!theme) return {};
  return {
    "--collection-primary": theme.primary,
    "--collection-secondary": theme.secondary,
    "--collection-bg": theme.background,
    "--collection-accent": theme.accent,
  };
}
