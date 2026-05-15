/** Mock NFT preview tiles for collection cards & carousels */
export function mockNftTiles(collection, count = 3) {
  const t = collection.theme;
  const palettes = [
    [t.primary, t.background],
    [t.secondary, t.primary],
    [t.accent, t.background],
    [t.primary, t.secondary],
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `${collection.id}-tile-${i}`,
    label: `#${1000 + i * 421}`,
    gradient: palettes[i % palettes.length],
    rotate: (i - 1) * 6,
    z: i,
  }));
}

export function mockCarouselNfts(collection, count = 10) {
  const t = collection.theme;
  const palettes = [
    [t.primary, t.background],
    [t.secondary, t.primary],
    [t.accent, t.secondary],
    [t.primary, t.accent],
    [t.secondary, t.background],
  ];
  return Array.from({ length: count }, (_, i) => ({
    id: `${collection.id}-carousel-${i}`,
    label: `${collection.shortName} #${200 + i * 89}`,
    gradient: palettes[i % palettes.length],
  }));
}
