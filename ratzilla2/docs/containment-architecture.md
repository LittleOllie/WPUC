# Containment Protocol — Architecture

## Active mode: ContainmentPuzzleSimulation

The default `/containment` route mounts `PuzzleContainmentGame`.

```
src/features/containment/
├── engine/puzzle/
│   ├── ContainmentPuzzleSimulation.ts  # Authoritative loop
│   ├── HexPuzzleBoard.ts               # Generation + validation
│   ├── ClueSystem.ts                   # Numbers + zero-flood
│   ├── LockSystem.ts                   # Lock charges
│   ├── InfectionSpreadSystem.ts        # Timed spread toward Core
│   └── StageDirector.ts                # Stage configs
├── rendering/PuzzleBoardRenderer.ts
├── components/
│   ├── PuzzleContainmentGame.tsx
│   ├── PuzzleHud.tsx
│   ├── PuzzleModeBar.tsx
│   └── …panels
├── config/puzzleBalance.ts
├── types/puzzle.ts
└── tests/puzzle.test.ts
```

## Legacy (unused by UI)

- `SimplifiedSimulation` — corridor three-door mode
- `GameSimulation` — original resource prototype

## Loop

- Real-time `update(now)` decrements spread countdown; spread events on zero
- Pause freezes countdown and spread
- Canvas renderer reads snapshot; hex hit-testing for scan/lock

## Persistence

- Key: `blackwater-containment-v1`
- Best score, tutorial flag, settings

## Route

- `/containment` — no boot sequence on restart
