# Containment Puzzle Redesign

## Decision

Replace the **visible-corridor / three-door** simplified mode as the default `/containment` experience.

Internal testing showed players could block every visible infection source with the same number of door slots, removing deduction and tension. The new default is a **Minesweeper-inspired hex containment puzzle** with real-time spread.

## One-sentence pitch

**Reveal safe rooms, use number clues to find the infection, and lock it down before it reaches the Core.**

## Core loop

1. **SCAN** hidden cells — safe cells show adjacent-infection counts; infected scans trigger an outbreak penalty.
2. **LOCK** suspected infection — limited charges; correct locks contain spread; wrong locks waste capacity.
3. **Countdown** — uncontained infection spreads toward the Core on a visible timer.
4. **Win stage** — all hidden infections are locked (contained).
5. **Lose** — infection enters the Core.

## Architecture

```
types/puzzle.ts
config/puzzleBalance.ts
engine/puzzle/
  HexPuzzleBoard.ts      — generation, validation, adjacency
  ClueSystem.ts          — counts, zero-flood, clue updates
  LockSystem.ts          — charges, earn-on-reveal
  InfectionSpreadSystem.ts — timed spread toward Core
  StageDirector.ts       — stage configs, progression
  ContainmentPuzzleSimulation.ts — authoritative loop
rendering/PuzzleBoardRenderer.ts
components/PuzzleContainmentGame.tsx (+ Hud, ModeBar, panels)
tests/puzzle.test.ts
```

## Reused

- `/containment` route, Blackwater CSS tokens, Canvas + CameraController
- `SeededRandom`, `hexCoords`, persistence, settings, audio hooks
- Legacy corridor/simulation code left unused (not wired to UI)

## Removed from active UI

Corridors, door slots, Purge, resources, room labels, corridor hit-testing.

## Implementation status

Delivered as default `/containment` experience. See `containment-progress.md`.
