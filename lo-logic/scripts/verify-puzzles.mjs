import { PUZZLES } from "../js/puzzles.js";
import { fragmentMatchesSolution } from "../js/fragments.js";
import { fragmentsPinUniqueSolution } from "../js/puzzle-solver.js";

let failed = false;

for (const p of PUZZLES) {
  for (let i = 0; i < p.fragments.length; i++) {
    if (!fragmentMatchesSolution(p.fragments[i], p.solution)) {
      console.error(`Puzzle ${p.id} fragment ${i + 1} does not match solution`);
      failed = true;
    }
  }

  const unique = fragmentsPinUniqueSolution(p.fragments, p.solution);

  console.log(
    `Puzzle ${p.id} (${p.difficulty}): ${p.fragments.length} clues${unique ? " ✓ unique" : " ✗ NOT UNIQUE"}`,
  );

  if (!unique) failed = true;
}

if (failed) process.exit(1);
console.log("\nAll puzzles OK.");
