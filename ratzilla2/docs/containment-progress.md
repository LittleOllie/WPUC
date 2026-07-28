# Containment Protocol — Progress

## Hex puzzle redesign ✅ (default experience)

- [x] Puzzle redesign plan (`containment-puzzle-redesign.md`)
- [x] `ContainmentPuzzleSimulation` + subsystems
- [x] Hex board generation with validation
- [x] Clue numbers + zero-flood reveal
- [x] Lock charges + earn-on-reveal
- [x] Real-time spread toward Core
- [x] Stage progression (1–6+)
- [x] `PuzzleBoardRenderer` + `PuzzleContainmentGame`
- [x] SCAN / LOCK mode bar + desktop right-click lock
- [x] 3-step live tutorial
- [x] `tests/puzzle.test.ts` (18 cases)
- [x] Docs updated
- [x] Corridor simplified mode disconnected from UI

## Prior work (legacy, inactive)

- Resource-heavy prototype
- Corridor simplified mode (three-door)

## Verify locally

```bash
cd ratzilla2
npm run dev    # /containment
npm test
npm run build
```
