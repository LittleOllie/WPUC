# FlexGrid Refactor — Implementation Checklist

**Started:** 2026-07-21  
**Baseline:** `app.js` 9,152 lines (~312 KB); hero assets ~9 MB; no build pipeline; legacy `worker/` with hardcoded key.

## Phase 1 — Security
- [ ] Remove legacy `flexgrid/worker/` executable code; README-only pointer to `../worker.js`
- [ ] Confirm no hardcoded API keys in tracked files
- [ ] Add in-Worker rate limiting (API + `/img`) with 429 + Retry-After
- [ ] Audit high-risk `innerHTML` paths; use `escapeHtml` / text nodes
- [ ] Tighten CSP where safe; move inline scripts to modules

## Phase 2 — Performance
- [ ] Optimise large PNG assets → WebP (+ fallbacks where needed)
- [ ] Lazy-load GIF vendor scripts
- [ ] esbuild bundle + minify for production
- [ ] Font preconnect; document cache headers

## Phase 3 — Modularise frontend
- [ ] `core/` — constants, dom, state, escapeHtml, errors
- [ ] `ui/` — loading, theme, notifications, modals
- [ ] `wizard/` — disclaimer, navigation helpers
- [ ] `wallets/` — validation, storage, loading hooks
- [ ] `collections/` — search filter
- [ ] `platform/` — ios, mobile
- [ ] Reduce `app.js` to bootstrap + coordination

## Phase 4 — Error handling
- [ ] User-facing toast system
- [ ] Review silent `.catch` blocks
- [ ] Preserve timeout behaviour; clear loading states

## Phase 5 — Dead code
- [ ] Remove `fetchNFTsFromZora` if unused
- [ ] Retire or update `app.html`
- [ ] Replace stale `AUDIT_REPORT.md`

## Phase 6 — Documentation
- [ ] `docs/FLEX_GRID_SETUP.md`
- [ ] `docs/ARCHITECTURE.md`
- [ ] `docs/SECURITY.md`
- [ ] `docs/TESTING.md`
- [ ] Update root `README.md`

## Phase 7 — Tests
- [ ] Vitest unit tests (validation, cache, escape, limits)
- [ ] API mock tests
- [ ] Optional Playwright smoke test

## Phase 8 — Accessibility
- [ ] Remove `user-scalable=no`
- [ ] Disclaimer → `sessionStorage` dismiss
- [ ] Modal focus / keyboard

## Phase 9 — Verification
- [ ] `npm run check` / `npm run test` / `npm run build`
- [ ] Manual chain checklist
