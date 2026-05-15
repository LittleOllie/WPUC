export const TRADE_TYPES = {
  WTT: "WTT",
  WTS: "WTS",
  WTB: "WTB",
  COMMUNITY_ENTRY: "Community Entry",
  TRAIT_HUNT: "Trait Hunt",
  OPEN_OFFERS: "Open To Offers",
};

export const TRADE_TYPE_LABELS = {
  WTT: "Want To Trade",
  WTS: "Want To Sell",
  WTB: "Want To Buy",
  "Community Entry": "Community Entry",
  "Trait Hunt": "Trait Hunt",
  "Open To Offers": "Open To Offers",
};

export const STATUSES = {
  ACTIVE: "Active",
  IN_TALKS: "In Talks",
  PENDING: "Pending",
  EXPIRED: "Expired",
};

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const mockListings = [
  {
    id: "lst-001",
    trader: { name: "GorgezCollector", verified: true, twitter: "@dedgorgez_fan", discord: "gorgez#1234", email: "" },
    offeringCollectionId: "ddg",
    offeringLabel: "DDG #1842",
    offeringTokenId: "1842",
    nftGradient: ["#e63cb4", "#12051f"],
    lookingForCollectionId: "longlost",
    lookingForLabel: "Long Lost entry piece",
    lookingForType: "nft",
    tradeType: "Community Entry",
    status: "Active",
    expiresAt: daysFromNow(7),
    notes: "Looking to trade into Long Lost lore. Open to fair 1:1 or + small ETH.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-002",
    trader: { name: "PortalSkater", verified: true, twitter: "@longlostportal", discord: "portal#8821", email: "" },
    offeringCollectionId: "longlost",
    offeringLabel: "Long Lost #331",
    offeringTokenId: "331",
    nftGradient: ["#8b3dff", "#07030d"],
    lookingForCollectionId: "quirkies",
    lookingForLabel: "Quirkies — open to offers",
    lookingForType: "open",
    tradeType: "Open To Offers",
    status: "Active",
    expiresAt: daysFromNow(5),
    notes: "Flexible on Quirkies traits. Prefer colourful / rare eyes.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-003",
    trader: { name: "NeonQuirk", verified: true, twitter: "@quirkiesneon", discord: "neon#0042", email: "neon@example.com" },
    offeringCollectionId: "quirkies",
    offeringLabel: "Quirkies #902",
    offeringTokenId: "902",
    nftGradient: ["#00d4ff", "#ff4fa3"],
    lookingForCollectionId: null,
    lookingForLabel: "Skull Mask trait (any collection)",
    lookingForType: "trait",
    tradeType: "Trait Hunt",
    status: "Active",
    expiresAt: daysFromNow(10),
    notes: "Hunting Skull Mask traits across communities. Will trade multiple if needed.",
    wantEth: null,
    wantTrait: "Skull Mask",
    traitBadges: ["Skull Mask", "Trait Hunt"],
  },
  {
    id: "lst-004",
    trader: { name: "DDGFlipper", verified: false, twitter: "@ddgflip", discord: "", email: "" },
    offeringCollectionId: "ddg",
    offeringLabel: "DDG #77",
    offeringTokenId: "77",
    nftGradient: ["#ff66cc", "#e63cb4"],
    lookingForCollectionId: null,
    lookingForLabel: "0.45 ETH",
    lookingForType: "eth",
    tradeType: "WTS",
    status: "Active",
    expiresAt: daysFromNow(3),
    notes: "Clean sale — no rush. DM on X.",
    wantEth: "0.45",
    wantTrait: null,
  },
  {
    id: "lst-005",
    trader: { name: "LostAndFound", verified: true, twitter: "@lostfound", discord: "lost#9900", email: "" },
    offeringCollectionId: "longlost",
    offeringLabel: "Long Lost #1205",
    offeringTokenId: "1205",
    nftGradient: ["#39ff88", "#8b3dff"],
    lookingForCollectionId: "ddg",
    lookingForLabel: "DDG ritual tier",
    lookingForType: "nft",
    tradeType: "WTT",
    status: "In Talks",
    expiresAt: daysFromNow(6),
    notes: "In talks with two collectors. Still open to better offers.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-006",
    trader: { name: "QuirkiesArcade", verified: true, twitter: "@quirkiesarcade", discord: "arcade#7777", email: "" },
    offeringCollectionId: "quirkies",
    offeringLabel: "Quirkies #4410",
    offeringTokenId: "4410",
    nftGradient: ["#ffd84d", "#00d4ff"],
    lookingForCollectionId: "ddg",
    lookingForLabel: "DDG community entry",
    lookingForType: "nft",
    tradeType: "Community Entry",
    status: "Active",
    expiresAt: daysFromNow(14),
    notes: "Want to join DDG family. Have strong Quirkies piece.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-007",
    trader: { name: "ETHBuyer_DD", verified: true, twitter: "@ethbuyer", discord: "", email: "" },
    offeringCollectionId: "ddg",
    offeringLabel: "DDG #2001",
    offeringTokenId: "2001",
    nftGradient: ["#64d5df", "#12051f"],
    lookingForCollectionId: null,
    lookingForLabel: "Long Lost #500–600 range",
    lookingForType: "nft",
    tradeType: "WTB",
    status: "Pending",
    expiresAt: daysFromNow(7),
    notes: "WTB specific Long Lost range for my set.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-008",
    trader: { name: "OpenOfferKing", verified: false, twitter: "@openoffer", discord: "open#1111", email: "" },
    offeringCollectionId: "longlost",
    offeringLabel: "Long Lost #88",
    offeringTokenId: "88",
    nftGradient: ["#c084fc", "#07030d"],
    lookingForCollectionId: null,
    lookingForLabel: "Open to all offers",
    lookingForType: "open",
    tradeType: "Open To Offers",
    status: "Active",
    expiresAt: daysFromNow(12),
    notes: "Surprise me — ETH, NFTs, or cross-community swaps.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-009",
    trader: { name: "TraitHunter_X", verified: true, twitter: "@traithunter", discord: "hunter#3333", email: "" },
    offeringCollectionId: "ddg",
    offeringLabel: "DDG #555",
    offeringTokenId: "555",
    nftGradient: ["#e63cb4", "#ff66cc"],
    lookingForCollectionId: "quirkies",
    lookingForLabel: "Laser Eyes trait",
    lookingForType: "trait",
    tradeType: "Trait Hunt",
    status: "Active",
    expiresAt: daysFromNow(4),
    notes: "Laser Eyes on Quirkies preferred. Can add ETH.",
    wantEth: "0.1",
    wantTrait: "Laser Eyes",
    traitBadges: ["Laser Eyes"],
  },
  {
    id: "lst-010",
    trader: { name: "CrossCommunity", verified: true, twitter: "@crosscomm", discord: "cross#5555", email: "cross@example.com" },
    offeringCollectionId: "quirkies",
    offeringLabel: "Quirkies #100",
    offeringTokenId: "100",
    nftGradient: ["#ff4fa3", "#061427"],
    lookingForCollectionId: "longlost",
    lookingForLabel: "Long Lost portal art",
    lookingForType: "nft",
    tradeType: "WTT",
    status: "Active",
    expiresAt: daysFromNow(9),
    notes: "Love Long Lost portal aesthetic. Fair trade only.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-011",
    trader: { name: "GorgezWhale", verified: true, twitter: "@gorgezwhale", discord: "whale#0001", email: "" },
    offeringCollectionId: "ddg",
    offeringLabel: "DDG #1",
    offeringTokenId: "1",
    nftGradient: ["#12051f", "#e63cb4"],
    lookingForCollectionId: "quirkies",
    lookingForLabel: "Grail Quirkies",
    lookingForType: "nft",
    tradeType: "WTT",
    status: "In Talks",
    expiresAt: daysFromNow(2),
    notes: "High-tier swap. Serious collectors only.",
    wantEth: null,
    wantTrait: null,
  },
  {
    id: "lst-012",
    trader: { name: "NewToDDG", verified: false, twitter: "@newtoddg", discord: "", email: "" },
    offeringCollectionId: "longlost",
    offeringLabel: "Long Lost #2000",
    offeringTokenId: "2000",
    nftGradient: ["#8b3dff", "#39ff88"],
    lookingForCollectionId: "ddg",
    lookingForLabel: "Enter DDG community",
    lookingForType: "nft",
    tradeType: "Community Entry",
    status: "Active",
    expiresAt: daysFromNow(7),
    notes: "First time listing — want to join DDG collectors.",
    wantEth: null,
    wantTrait: null,
  },
];

export function getListingById(id) {
  return mockListings.find((l) => l.id === id) ?? null;
}

export function getListingsByCollection(collectionId) {
  return mockListings.filter(
    (l) =>
      l.offeringCollectionId === collectionId ||
      l.lookingForCollectionId === collectionId
  );
}

export function getJoinListingsForCollection(collectionId) {
  return mockListings.filter((l) => l.lookingForCollectionId === collectionId);
}

export function getTimeRemaining(expiresAt) {
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return { expired: true, label: "Expired" };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return { expired: false, label: `${days}d ${hours}h left` };
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { expired: false, label: `${hours}h ${mins}m left` };
}
