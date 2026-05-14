/**
 * Smart auto-layouts for the template frame hole (max 9 NFT / upload slots).
 * Each slot: { area, kind } — 'logo' = DDG grid mark; 'reveal' = DDGReveal art; 'nft' = user/wallet image.
 *
 * - `templateAreas` uses CSS grid naming; repeated names merge cells (handled in app canvas).
 * - Optional `rowFr` keeps row height ratios in sync between DOM overlay and canvas export.
 */

/** @typedef {{ area: string; kind: "nft" | "logo" | "reveal" }} PosterSlot */

/**
 * @typedef {{
 *   columns: string;
 *   rows: string;
 *   templateAreas: string;
 *   slots: PosterSlot[];
 *   rowFr?: number[];
 * }} PosterLayout */

/**
 * @param {number} nftCount selected NFT count (1–9)
 * @returns {PosterLayout}
 */
export function getPosterLayout(nftCount) {
  const n = Math.max(1, Math.min(9, nftCount | 0));

  /** @type {Record<number, PosterLayout>} */
  const L = {
    1: {
      columns: "1fr",
      rows: "1fr",
      templateAreas: '"a"',
      slots: [{ area: "a", kind: "nft" }],
    },
    /* Two-up: single row, equal halves (clean; no diagonal dead cells). */
    2: {
      columns: "1fr 1fr",
      rows: "1fr",
      templateAreas: '"a b"',
      slots: [
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
      ],
    },
    /* Logo + three NFTs; slightly taller top band for balance. */
    3: {
      columns: "1fr 1fr",
      rows: "minmax(0, 1.04fr) minmax(0, 0.96fr)",
      rowFr: [1.04, 0.96],
      templateAreas: '"logo a" "b c"',
      slots: [
        { area: "logo", kind: "logo" },
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
      ],
    },
    4: {
      columns: "1fr 1fr",
      rows: "1fr 1fr",
      templateAreas: '"a b" "c d"',
      slots: [
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
      ],
    },
    /* Two large halves on top; three wide strips below (horizontal crop). */
    5: {
      columns: "repeat(6, minmax(0, 1fr))",
      rows: "minmax(0, 1.34fr) minmax(0, 0.66fr)",
      rowFr: [1.34, 0.66],
      templateAreas: '"a a a b b b" "c c d d e e"',
      slots: [
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
        { area: "e", kind: "nft" },
      ],
    },
    /* 3×2: slightly taller top row for “hero” trio. */
    6: {
      columns: "1fr 1fr 1fr",
      rows: "minmax(0, 1.08fr) minmax(0, 0.92fr)",
      rowFr: [1.08, 0.92],
      templateAreas: '"a b c" "d e f"',
      slots: [
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
        { area: "e", kind: "nft" },
        { area: "f", kind: "nft" },
      ],
    },
    /* 3×3: grid logo top-left, seven NFTs, DDGReveal bottom-right. */
    7: {
      columns: "1fr 1fr 1fr",
      rows: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)",
      rowFr: [1, 1, 1],
      templateAreas: '"logo a b" "c d e" "f g reveal"',
      slots: [
        { area: "logo", kind: "logo" },
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
        { area: "e", kind: "nft" },
        { area: "f", kind: "nft" },
        { area: "g", kind: "nft" },
        { area: "reveal", kind: "reveal" },
      ],
    },
    /* Logo + 7: slightly shorter logo band, two balanced NFT rows. */
    8: {
      columns: "1fr 1fr 1fr",
      rows: "minmax(0, 0.92fr) minmax(0, 1.04fr) minmax(0, 1.04fr)",
      rowFr: [0.92, 1.04, 1.04],
      templateAreas: '"logo a b" "c d e" "f g h"',
      slots: [
        { area: "logo", kind: "logo" },
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
        { area: "e", kind: "nft" },
        { area: "f", kind: "nft" },
        { area: "g", kind: "nft" },
        { area: "h", kind: "nft" },
      ],
    },
    /* 3×3: tiny extra weight on bottom row for a stable “base”. */
    9: {
      columns: "1fr 1fr 1fr",
      rows: "minmax(0, 0.99fr) minmax(0, 0.99fr) minmax(0, 1.02fr)",
      rowFr: [0.99, 0.99, 1.02],
      templateAreas: '"a b c" "d e f" "g h i"',
      slots: [
        { area: "a", kind: "nft" },
        { area: "b", kind: "nft" },
        { area: "c", kind: "nft" },
        { area: "d", kind: "nft" },
        { area: "e", kind: "nft" },
        { area: "f", kind: "nft" },
        { area: "g", kind: "nft" },
        { area: "h", kind: "nft" },
        { area: "i", kind: "nft" },
      ],
    },
  };

  return L[n];
}

export function nftSlotsNeeded(nftCount) {
  const layout = getPosterLayout(nftCount);
  return layout.slots.filter((s) => s.kind === "nft").length;
}
