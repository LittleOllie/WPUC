# Flex Grid — Complete Codebase Audit

**Date:** March 22, 2026  
**Scope:** Full codebase analysis for production readiness, performance, reliability, and security

---

## 1. STRUCTURE & ARCHITECTURE REVIEW

### Current Structure
```
flexgrid/
├── index.html          # 326 lines, inline scripts
├── worker.js           # 245 lines — ROOT WORKER (used by wrangler)
├── worker/index.js     # 139 lines — DUPLICATE, unused
├── wrangler.jsonc
├── src/js/app.js       # 2,531 lines — MONOLITHIC
├── src/js/config.js    # 44 lines
├── src/styles/style.css # ~1,620 lines
└── src/assets/images/  # 5 images, ~5.5 MB total
```

### Critical Issues

| Issue | Impact |
|-------|--------|
| **2,531-line app.js** | Unmaintainable. No separation of concerns. State, UI, API, image loading, export, wallet logic all mixed. |
| **Duplicate workers** | `worker.js` (root) and `worker/index.js` have different implementations. Only root is used. `worker/index.js` has no IPFS gateway fallback for `/img`. Confusing, dead code. |
| **Missing HTML elements** | `gridSize`, `customCols`, `customRows`, `customGridWrap`, `addContractInput`, `addContractBtn` referenced in app.js but **don't exist in index.html**. Code no-ops or falls back silently. |
| **Inline scripts in HTML** | 3 inline `<script>` blocks (collection search, gridSize sync, theme). Should be in app.js. |
| **No build pipeline** | No minification, bundling, or asset optimization. Raw 80KB app.js shipped to users. |
| **docs/ folder missing** | README references `docs/FLEX_GRID_SETUP.md`, `docs/WATERMARK_SYSTEM.md` — they don't exist. |

### Recommended Structure
```
flexgrid/
├── index.html
├── worker.js                    # Single worker (consolidate)
├── wrangler.jsonc
├── src/
│   ├── js/
│   │   ├── main.js              # Init, event binding
│   │   ├── config.js
│   │   ├── state.js             # State management
│   │   ├── api.js               # fetchNFTsFromWorker, fetchNFTsFromZora
│   │   ├── wallet.js            # add/remove wallet, render
│   │   ├── collections.js       # render, trait sorting
│   │   ├── grid.js              # buildGrid, reorderGrid, makeNFTTile
│   │   ├── images.js            # loadTileImage, buildImageCandidates, queue
│   │   ├── export.js            # exportPNG, canvas logic
│   │   └── ui.js                # setStatus, showLoading, updateGuideGlow
│   ├── styles/
│   │   ├── base.css
│   │   ├── components.css
│   │   └── themes.css
│   └── assets/images/           # Optimize all images
├── docs/
│   ├── FLEX_GRID_SETUP.md
│   └── WATERMARK_SYSTEM.md
└── package.json                 # Add for scripts, optional bundler
```

---

## 2. PERFORMANCE ANALYSIS (CRITICAL)

### 2.1 Slow Load Times

| Cause | Location | Fix |
|-------|----------|-----|
| **Unoptimized images** | `src/assets/images/` | header.png **2.5 MB**, tile.png **1.3 MB**, LO.png **1.1 MB** — use WebP, resize, compress. Target: <200KB each. |
| **No code splitting** | app.js 80KB | Split by route/step. Lazy load collections + grid logic until needed. |
| **Google Fonts blocking** | index.html | Add `font-display: swap` or self-host. |
| **Config fetch blocks init** | config.js | Config is fetched before enableButtons — add loading skeleton, don't block render. |

### 2.2 NFT Loading Speed

| Bottleneck | Location | Why |
|------------|----------|-----|
| **Sequential wallet fetches** | loadWallets L1772-1778 | Wallets loaded one-by-one. 3 wallets = 3× latency. |
| **No request caching** | fetchNFTsFromWorker | Same wallet+chain refetched every time. |
| **Worker NFT timeout 25s** | worker.js L63 | Per-page timeout. Large wallets can hit this. |

**Fix — Parallel wallet fetch:**
```javascript
// BEFORE: Sequential
for (let i = 0; i < state.wallets.length; i++) {
  const nfts = await fetchNFTsFromWorker({ wallet: state.wallets[i], chain });
  allNfts.push(...nfts);
}

// AFTER: Parallel (max 3 concurrent to avoid rate limits)
const BATCH = 3;
for (let i = 0; i < state.wallets.length; i += BATCH) {
  const batch = state.wallets.slice(i, i + BATCH);
  const results = await Promise.all(
    batch.map(w => fetchNFTsFromWorker({ wallet: w, chain }))
  );
  results.forEach(nfts => allNfts.push(...(nfts || [])));
}
```

### 2.3 Image Loading — Major Bottlenecks

| Issue | Location | Impact |
|-------|----------|--------|
| **MAX_CONCURRENT_LOADS = 6** | app.js L186 | Only 6 images load at once. Grid of 100 = 17 batches. |
| **gridImgLimit(18) UNUSED** | app.js L236, L1602 | `loadTileImage` uses `queueImageLoad` (6), not `gridImgLimit` (18). Dead code. |
| **Sequential gateway fallback** | loadTileImage L1587-1615 | Tries candidates one-by-one. 5 gateways × 8s timeout = 40s worst case per image. |
| **8s timeout per candidate** | loadImageWithTimeout L604 | Too long. 3-4s sufficient. |
| **No proxy used for grid** | gridProxyUrl L584-586 | Returns `normalizeImageUrl` (direct). Worker `/img` has IPFS multi-gateway fallback — not used! CORS/rate limits on gateways cause failures. |
| **Duplicate limiter logic** | queueImageLoad vs createLimiter | Two separate systems. Only one used. |

**Fix — Use Worker proxy for IPFS URLs, raise concurrency:**
```javascript
// gridProxyUrl: use proxy for ipfs:// URLs to leverage Worker's gateway fallback
function gridProxyUrl(src) {
  const normalized = normalizeImageUrl(src);
  if (!normalized) return src;
  const ipfsPath = getIpfsPath(src);
  if (ipfsPath && IMG_PROXY) {
    return IMG_PROXY + encodeURIComponent(normalized);
  }
  return normalized;
}
// And: MAX_CONCURRENT_LOADS = 12 (or use gridImgLimit consistently)
```

### 2.4 Rendering Performance

| Issue | Fix |
|-------|-----|
| Progressive batching (40 + 40/100ms) is good. | Keep. |
| `syncWatermarkDOMToOneTile` on resize/orientation | Debounce 150ms. |
| `updateGuideGlow` runs on every state change | Throttle or simplify. |
| Grid tile DOM: 100+ divs with img | Consider `content-visibility: auto` for offscreen tiles. |
| No virtualization | Large grids (400 tiles) create 400 DOM nodes. Acceptable for now. |

### 2.5 State Management

- Single `state` object + `state.imageLoadState` — fine for scale.
- `state.currentGridItems` — used for reorder/remove. Good.
- No persistence — user loses everything on refresh. Consider localStorage for wallets.

---

## 3. DATA LOADING & RELIABILITY

### 3.1 Why Some NFTs Fail to Load

| Root Cause | Details |
|------------|---------|
| **IPFS gateway failures** | cloudflare-ipfs, w3s, nftstorage, pinata, ipfs.io — all can timeout or fail. No proxy for grid = direct hits from browser → CORS, rate limits. |
| **Sequential fallback** | One slow gateway blocks trying the next. |
| **No retry with backoff** | loadTileImage tries each candidate once. |
| **Metadata image URL format** | Some NFTs use `ipfs://`, raw CID, or `https://...ipfs/...` — getImage/normalizeImageUrl may miss edge cases. |
| **Worker /img not used** | Worker has robust multi-gateway + placeholder. Frontend bypasses it. |

### 3.2 Robust Image Loading System

**Recommended flow:**
1. **Use Worker proxy for all IPFS URLs** — Worker tries 5 gateways server-side.
2. **Parallel candidate check** — `Promise.race` first 2 gateways, fallback to next.
3. **Shorter timeout** — 4s per candidate.
4. **Retry once** — On failure, retry with different gateway order.
5. **Concurrent limit 12** — Balance speed vs overload.

**Code sketch:**
```javascript
async function loadTileImageRobust(tile, img, rawUrl) {
  const candidates = buildImageCandidates(rawUrl);
  const useProxy = (url) => {
    const path = getIpfsPath(url);
    return path && IMG_PROXY ? IMG_PROXY + encodeURIComponent(url) : url;
  };
  for (const url of candidates) {
    const src = useProxy(url);
    try {
      await queueImageLoad(() => loadImageWithTimeout(img, src, 4000));
      // success
      return true;
    } catch (_) { /* try next */ }
  }
  markMissing(tile, img, rawUrl);
  return false;
}
```

### 3.3 fetchNFTsFromWorker — Missing Timeout

```javascript
// app.js L1957
const res = await fetch(url);  // NO TIMEOUT
```

Add AbortController + 30s timeout. Worker has 25s; align client.

---

## 4. ERROR HANDLING & EDGE CASES

### 4.1 Weak Error Handling

| Location | Issue |
|----------|-------|
| SHOW_ERROR_PANEL = false | Errors logged to errorLog but panel never shown. User sees nothing. |
| loadTileImage catch | `.catch(() => {})` in retry — swallows all errors. |
| addCollectionByContract | `fetch(url).catch(() => null)` — network error = silent. |
| fetchNFTsFromWorker | No try/catch at call site; loadWallets wraps it. Good. |
| exportPNG | try/catch shows "Oops, export failed" — generic. No details. |
| initializeConfig | Shows error in status. Good. References non-existent docs. |

### 4.2 Silent Failures

- `addContractBtn` / `addContractInput` — elements missing, handlers never attach.
- `gridSize` / `customGridWrap` — script does `if(!gridSize) return` — silent.
- Image load failure — only `updateImageProgress` shows "X failed". No per-tile feedback until retry.

### 4.3 Recommendations

1. **User-visible error panel** — Toggle `SHOW_ERROR_PANEL` for production, or show a simplified "Something went wrong" with retry.
2. **Surfaced errors** — Replace `.catch(() => {})` with at least `console.warn` or increment a visible "issues" counter.
3. **Add missing elements** — Either add `addContractInput`, `addContractBtn`, `gridSize`, etc. to HTML, or remove dead references from app.js.

---

## 5. UX / UI IMPROVEMENTS

### 5.1 Friction Points

| Issue | Suggestion |
|-------|------------|
| **4 steps + Build button** | Consider: After selecting 2+ collections, auto-build or make Build one-tap. Current flow is Add wallets → Load → Select → Build → Grid. Could combine Load+Select or Build on 2nd collection select. |
| **Wallet section collapsed by default** | Fixed: Now expands on step 1. Good. |
| **No skeleton during NFT load** | Add skeleton grid or shimmer for collections list while loading. |
| **Loading overlay** | Good. Spinner + message. Ensure it always hides (currently good). |
| **Retry / Remove unloaded** | Good UX. Keep. |
| **Mobile** | CSP, viewport set. Touch targets 44px. Test on real device. |
| **Export feedback** | "Creating your masterpiece... X%" — good. "Saved! Check your downloads" — add filename. |

### 5.2 Loading States

- Wallet load: showLoading — good.
- Grid image load: stageFooter + progress bar — good.
- Config load: blocks everything. Add "Loading…" overlay until config ready.

### 5.3 Layout

- Collapsible sections work.
- `min-width: 0` used to prevent overflow. Good.
- walletSectionContent padding 12px — fixed clipping. Good.

---

## 6. SECURITY REVIEW

### 6.1 CRITICAL — API Key Exposure

**worker.js line 14-15 and worker/index.js line 14-15:**
```javascript
const CONFIG = {
  alchemyApiKey: "2LxYSccU9cpZLJ3HEjV6Q",  // EXPOSED IN SOURCE
  ...
};
```

- Key is in source control and deployed Worker.
- Anyone can call the Worker, extract the key from `/api/config/flex-grid`, or reverse-engineer it.
- **Immediate:** Use Cloudflare secrets (wrangler secret put ALCHEMY_API_KEY) and read via `env.ALCHEMY_API_KEY`.
- **Rotate the key** — assume compromised.

### 6.2 Other Security Notes

| Item | Status |
|------|--------|
| CORS `*` | Worker allows all origins. For public app, acceptable. |
| CSP | Restrictive. Good. img-src allows https: — broad but needed for NFT images. |
| XSS | escapeHtml used. innerHTML only for error log. Low risk. |
| API key in frontend | config.js fetches from Worker. Key not in frontend bundle. Good. |
| No auth | By design. Public grid builder. |

---

## 7. CODE QUALITY CLEANUP

### 7.1 Dead / Unused Code

| Code | Location | Action |
|------|----------|--------|
| gridImgLimit, loadImgWithLimiter | app.js L236, L294-296 | Remove or switch loadTileImage to use it. |
| loadImgWithTimeout | app.js L265 | Different from loadImageWithTimeout (L605). Unused. Remove. |
| worker/index.js | worker/ | Delete or consolidate into worker.js. |
| imageProgressBarWrap, imageProgressBar | app.js L443-447 | "Legacy" — remove if not in HTML. |
| barWrap, bar | L484-485 | Same. |
| addContractBtn, addContractInput handlers | L2396-2403 | Elements missing. Remove or add HTML. |
| getGridChoice gridSize/customCols/customRows | L1188-1203 | Elements missing. Falls back to "auto". Remove or add HTML. |
| gridSize/customGridWrap inline script | index.html L275-287 | Both null. Remove script. |

### 7.2 Inconsistent Naming

- `loadImgWithTimeout` vs `loadImageWithTimeout` — two functions, similar purpose.
- `queueImageLoad` vs `gridImgLimit` — two limiters.
- `PLACEHOLDER_DATA_URL` vs `TILE_PLACEHOLDER_SRC` — different placeholders.

### 7.3 Simplify

- `gridProxyUrl` and `safeProxyUrl` — both return normalizeImageUrl. Consolidate.
- `getImage` has 10+ fallbacks — consider helper for metadata path.

---

## 8. ACTION PLAN

### Phase 1 — Critical (Do First)

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1 | **Move Alchemy key to env** — use `wrangler secret put ALCHEMY_API_KEY`, read in worker via `env.ALCHEMY_API_KEY`. Rotate key. | Security | 30 min |
| 2 | **Use Worker /img proxy for IPFS grid images** — Update gridProxyUrl to use IMG_PROXY when URL is IPFS. | Reliability | 1 hr |
| 3 | **Optimize images** — Compress header.png, tile.png, LO.png to WebP, <200KB each. | Load time −50%+ | 1 hr |
| 4 | **Parallel wallet fetch** — Load 2–3 wallets in parallel in loadWallets. | NFT load −40% | 30 min |
| 5 | **Add fetchNFTsFromWorker timeout** — AbortController 30s. | Reliability | 15 min |

### Phase 2 — High Impact

| # | Task | Impact |
|---|------|--------|
| 6 | **Raise MAX_CONCURRENT_LOADS to 12** | Grid images load 2× faster |
| 7 | **Shorten loadImageWithTimeout to 4000ms** | Fail faster, try next gateway sooner |
| 8 | **Remove dead code** — gridImgLimit, loadImgWithLimiter, loadImgWithTimeout | Clarity |
| 9 | **Consolidate workers** — Delete worker/index.js or merge into worker.js | Maintainability |
| 10 | **Create docs/** — Add FLEX_GRID_SETUP.md, fix README links | Onboarding |

### Phase 3 — Medium Impact

| # | Task |
|---|------|
| 11 | Add gridSize, customCols, customRows to HTML or remove getGridChoice custom logic |
| 12 | Add addContractInput, addContractBtn if "Add by contract" is desired feature |
| 13 | Move inline scripts from index.html to app.js |
| 14 | Throttle syncWatermarkDOMToOneTile on resize |
| 15 | Enable SHOW_ERROR_PANEL for dev, add user-friendly "Something went wrong" for prod |

### Phase 4 — Longer Term

- Split app.js into modules (see Structure).
- Add package.json + optional Vite/rollup for bundling.
- Add localStorage for wallets (optional persistence).
- Add basic E2E tests for critical path.

---

## 9. BEFORE / AFTER EXAMPLES

### 9.1 gridProxyUrl — Use Proxy for IPFS

**BEFORE:**
```javascript
function gridProxyUrl(src) {
  return normalizeImageUrl(src); // no proxy
}
```

**AFTER:**
```javascript
function gridProxyUrl(src) {
  const normalized = normalizeImageUrl(src);
  if (!normalized) return src;
  const ipfsPath = getIpfsPath(src);
  if (ipfsPath && IMG_PROXY) {
    return IMG_PROXY + encodeURIComponent(normalized);
  }
  return normalized;
}
```

### 9.2 Parallel Wallet Load

**BEFORE:**
```javascript
for (let i = 0; i < state.wallets.length; i++) {
  const nfts = await fetchNFTsFromWorker({ wallet: state.wallets[i], chain });
  allNfts.push(...(nfts || []));
}
```

**AFTER:**
```javascript
const WALLET_BATCH = 3;
for (let i = 0; i < state.wallets.length; i += WALLET_BATCH) {
  const batch = state.wallets.slice(i, i + WALLET_BATCH);
  const results = await Promise.all(
    batch.map(w => fetchNFTsFromWorker({ wallet: w, chain }))
  );
  results.forEach(nfts => allNfts.push(...(nfts || [])));
}
```

### 9.3 Worker Config — Use Secret

**BEFORE (worker.js):**
```javascript
const CONFIG = {
  alchemyApiKey: "2LxYSccU9cpZLJ3HEjV6Q",
  ...
};
```

**AFTER:**
```javascript
// In fetch handler, receive env from context
export default {
  async fetch(request, env) {
    const alchemyApiKey = env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) throw new Error("Missing ALCHEMY_API_KEY");
    // use alchemyApiKey
  },
};
```
Set via: `wrangler secret put ALCHEMY_API_KEY`

---

## Summary

| Area | Grade | Top Fix |
|------|-------|---------|
| Structure | D | Split app.js, remove duplicate worker |
| Performance | C | Optimize images, parallel wallets, use proxy |
| Reliability | C | Use Worker proxy for IPFS, add timeouts |
| Error Handling | C | Show errors, remove silent catches |
| UX | B | Minor tweaks |
| Security | F | **Immediate:** Move API key to secrets |
| Code Quality | D | Remove dead code, consolidate |

**Goal: 10× faster, 10× more reliable, production-ready**

- **Quick wins:** Phase 1 (secrets, proxy, images, parallel wallets) — ~4 hours.
- **Biggest perf gain:** Image optimization + proxy usage.
- **Biggest reliability gain:** Worker proxy for IPFS + timeouts.
