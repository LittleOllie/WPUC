# Containment Protocol — Balancing

Active tunables: `src/features/containment/config/puzzleBalance.ts`

## Stages (gentle ramp)

| Stage | Cells | Infections | Spread | Notes |
|-------|-------|------------|--------|-------|
| 1 | 19 | 2 | 14s | +10s grace before first spread, 3 start locks |
| 2 | 19 | 2 | 13s | Same board size as stage 1, +8s grace |
| 3 | 25 | 3 | 12s | Board expands, third infection introduced |
| 4 | 25 | 3 | 11s | |
| 5 | 25 | 4 | 10s | |
| 6 | 37 | 4 | 9s | Full large board |
| 7 | 37 | 5 | 7s | |
| 8+ | 37 | 6 | 5s | |

## Locks

| Constant | Value |
|----------|-------|
| `PUZZLE_LOCKS.revealsPerLock` | 2 safe reveals → +1 lock |
| `PUZZLE_LOCKS.maxStored` | 6 |
| `PUZZLE_LOCKS.stageCarryCap` | 3 (early stages) |

## Outbreak

| Constant | Value |
|----------|-------|
| `PUZZLE_OUTBREAK.scanPenaltyMs` | 3000 ms off spread timer |

## Scoring

See `PUZZLE_SCORING` in `puzzleBalance.ts`.

Legacy balance in `balance.ts` and `simplifiedBalance.ts` — inactive.
