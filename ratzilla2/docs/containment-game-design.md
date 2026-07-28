# Containment Protocol — Game Design

## Default experience: Hex containment puzzle

The visible-corridor / three-door mode was replaced after internal testing showed players could block every source without deduction. The active game is a **Minesweeper-inspired hex puzzle** with real-time infection spread.

### One-sentence pitch

**Reveal safe rooms, use number clues to find the infection, and lock it down before it reaches the Core.**

### Core loop

1. **SCAN** hidden hex cells — safe cells show how many adjacent cells are infected.
2. **LOCK** suspected infection — limited charges; correct locks stop spread; wrong locks waste capacity.
3. **Timer** — uncontained infection spreads toward the Core on a visible countdown.
4. **Win stage** — all infections are locked (contained).
5. **Lose** — infection enters the Core.

### Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Reveal | Left-click / SCAN mode | SCAN mode + tap |
| Lock | Right-click / LOCK mode | LOCK mode + tap |

### Progression

Short escalating stages: larger boards, more hidden infections, faster spread timers. Rules stay constant.

### Scoring

Safe reveals, correct locks, stage completion, spread-time bonus, deduction streaks. Penalties for scanning infection, wrong locks, Core exposure.

### Tutorial (~20s)

1. SCAN A ROOM (highlighted safe cell)
2. NUMBERS SHOW NEARBY INFECTION
3. LOCK THE HIGHLIGHTED INFECTION

---

## Legacy modes (inactive)

- **Corridor simplified mode** — tap corridors, 3-door limit (`SimplifiedSimulation`)
- **Resource-heavy prototype** — power/serum/engineering (`GameSimulation`)

Neither is wired to the active UI.

## Out of scope

NFT gating, wallet, multiplayer, online leaderboards, monetisation.
