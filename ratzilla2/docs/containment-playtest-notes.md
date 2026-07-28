# Containment Protocol — Playtest Notes

**Status:** Internal puzzle redesign complete — not externally validated.

## Why the corridor mode was replaced

With three door slots and three visible sources, players could seal every route immediately without deduction. The new mode requires reading number clues and managing limited lock charges under time pressure.

## Design intent

| Goal | Implementation |
|------|----------------|
| Understand quickly | SCAN / LOCK + 3-step tutorial |
| Deduction | Minesweeper-style neighbour counts |
| Tension | Real-time spread countdown |
| Resource tension | Limited locks, earn via safe reveals |
| Clear loss | Infection enters Core |

## Checklist

- [ ] First scan shows number clue
- [ ] Zero regions flood correctly
- [ ] Lock charges visible and limited
- [ ] Spread countdown readable
- [ ] Mobile SCAN/LOCK toggle works
- [ ] Core exposure warning visible
- [ ] Stage clear → next stage quickly

## Risks

- Brute-force locking still possible if charges too generous — tune `revealsPerLock` and start locks from sessions
- Stage 4+ board size on small phones needs playtest
