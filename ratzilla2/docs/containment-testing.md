# Containment Protocol — Testing

## Automated Tests

Run: `npm test`

Location: `src/features/containment/tests/simulation.test.ts`

Coverage includes:

- Seeded random consistency
- Hex grid / distance
- Layout validation (alpha lab)
- Graph corridor lookup
- Incident seed reproducibility
- Infection blocked by sealed corridors
- Infection spreads through open corridors
- Pressure on sealed doors
- Reinforcement, serum, purge, lockdown
- Core failure / game over
- Resource caps and non-negative values
- Pause stops advancement

## Manual Tests

- [ ] Homepage → ACCESS CONTAINMENT PROTOCOL
- [ ] Direct `/containment` URL
- [ ] Refresh `/containment` (no 404 after publish)
- [ ] Seal flashing corridor on first run
- [ ] Mobile tap targets on corridors
- [ ] Pause on tab hide
- [ ] Same-seed restart vs new incident
- [ ] Reduced motion in settings
- [ ] Debug panel only in dev

## Mobile Checks

- Board readable at 375px width
- Ability bar thumb-friendly
- Pinch/zoom fallback buttons

## Known Issues

- Single JS bundle >500kB (no route lazy-load yet)
- HUD re-renders every frame (performance acceptable for ~25 rooms)
- Mutation timing long for quick playtests (~90s first mutation in production mode)
- Keyboard board navigation not yet implemented (Escape/pause via UI only)
