export interface RankDefinition {
  minScore: number;
  label: string;
}

export const RANKS: RankDefinition[] = [
  { minScore: 0, label: "Trainee" },
  { minScore: 500, label: "Field Technician" },
  { minScore: 1500, label: "Containment Officer" },
  { minScore: 3500, label: "Senior Researcher" },
  { minScore: 6000, label: "Site Commander" },
  { minScore: 10000, label: "Blackwater Director" },
  { minScore: 15000, label: "Z-26 Specialist" },
];

export function getRankForScore(score: number): string {
  let rank = RANKS[0]!.label;
  for (const r of RANKS) {
    if (score >= r.minScore) rank = r.label;
  }
  return rank;
}
