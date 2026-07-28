/** Decorative passport ID — not a security credential or ownership proof. */
export function createWalletPassportNumber(): string {
  let part1 = 0;
  let part2 = 0;

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint16Array(2);
    crypto.getRandomValues(bytes);
    part1 = bytes[0]!;
    part2 = bytes[1]!;
  } else {
    part1 = Math.floor(Math.random() * 65536);
    part2 = Math.floor(Math.random() * 65536);
  }

  return `WD-${part1.toString(16).toUpperCase().padStart(4, "0")}-${part2.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function createWalletPassportSeed(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
