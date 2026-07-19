/**
 * Shared Games Lab puzzle image pool (Memory Match, Slider Puzzle, Jigsaw Puzzle).
 * PNGs live in assets/ as 51.png … 100.png — extend LAB_PUZZLE_IMAGE_COUNT to add more.
 */
export const LAB_PUZZLE_IMAGE_COUNT = 50;
export const LAB_PUZZLE_IMAGE_START = 51;
export const LAB_PUZZLE_ASSET_BASE = "../../assets/";

export function labPuzzleImageNames() {
  return Array.from({ length: LAB_PUZZLE_IMAGE_COUNT }, (_, i) =>
    String(i + LAB_PUZZLE_IMAGE_START)
  );
}

export function labPuzzleImageSrc(name, base = LAB_PUZZLE_ASSET_BASE) {
  return base + name + ".png";
}

export function pickRandomLabPuzzleImage() {
  const names = labPuzzleImageNames();
  return names[Math.floor(Math.random() * names.length)];
}

if (typeof window !== "undefined") {
  window.LabPuzzleImages = {
    COUNT: LAB_PUZZLE_IMAGE_COUNT,
    START: LAB_PUZZLE_IMAGE_START,
    ASSET_BASE: LAB_PUZZLE_ASSET_BASE,
    names: labPuzzleImageNames,
    src: labPuzzleImageSrc,
    pickRandom: pickRandomLabPuzzleImage,
  };
}
