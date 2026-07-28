# Containment Simplification Plan

## Decision

Replace the resource-heavy prototype as the **default active experience** with a new `SimplifiedSimulation` module. Legacy `GameSimulation` code remains in the repo for reference but is **not wired to the UI**.

## One-sentence pitch

**Stop the red infection from reaching the Core by tapping corridors to close doors.**

## Core rules

| Rule | Implementation |
|------|----------------|
| Tap corridor | Immediately toggle open ↔ closed |
| Max closed doors | 3 (configurable); 4th close releases oldest (FIFO) |
| Infection | Travels toward Core via shortest open route; visible pulse on corridors |
| Loss | Infection reaches Core |
| Only ability | PURGE — charges over time, clears infection near Core |
| Tutorial | 3 live hints (~15s), no pause-heavy script |
| Layout | 17 rooms, no functional room labels |

## Architecture

```
engine/SimplifiedSimulation.ts   — authoritative state + tick
engine/InfectionRouter.ts        — BFS pathfinding, front movement
engine/DifficultyDirector.ts     — phase timing, sources, speed
data/simpleLayout.ts             — 17-room graph
config/simplifiedBalance.ts    — all tunables
rendering/SimpleBoardRenderer.ts — infection-first visuals
components/SimpleContainmentGame.tsx — UI shell
tests/simplified.test.ts         — active game tests
```

## Reused

- Route `/containment`, page wrapper, CSS tokens
- `SeededRandom`, `SimulationClock`, hex coords
- `CameraController`, `AudioManager`, persistence wrapper
- Canvas rendering pattern

## Removed from active UI

Power, serum, engineering, reinforce, lockdown, room selection, ability bar, detail panel, 8-step tutorial, incident briefing, mutations, integrity/pressure numbers, special room effects.

## Implementation order

1. Types + balance + layout ✅
2. Pathfinder + simulation ✅
3. Renderer ✅
4. UI components ✅
5. Wire route + tests + docs ✅

## Status

Simplified mode is the **default active experience** at `/containment`. All acceptance criteria met pending external playtest validation.
