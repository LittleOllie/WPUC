# FlexGrid ↔ Quirkies (Flecks) cross-audit

Technical comparison only. No merge of products; Quirkies keeps pairing, collections, and UX.

## 1. Reusable strengths (FlexGrid)

| Area | Pattern |
|------|--------|
| **Image loads** | Global `imageCache` Map (URL → winning URL); `primeImageCacheFromManualPreview` avoids duplicate fetches when rebuilding grid. |
| **Concurrency** | `queueImageLoad` + `MAX_CONCURRENT_LOADS` (12) so tiles don’t stampede the network. |
| **Per-URL probe** | `loadImageWithTimeout` uses a **preflight `Image()`** before assigning `img.src`, with timeout (4–12s). |
| **Candidates** | `buildImageCandidates`: proxy first, then deduped gateway list for IPFS path. |
| **Grid paint** | Progressive append (`INITIAL_TILE_COUNT` 96, batches of 64) + `requestAnimationFrame` for watermark sync — main thread stays responsive on huge grids. |
| **Export wait** | `waitForExportImages`: `complete` + `naturalWidth > 0`, load/error listeners, **10s cap per tile** so export never hangs indefinitely. |
| **Export draw** | `exportTileDrawRect` ~1% bleed; `drawImageCover` for object-fit:cover; `loadImageWithRetry` for watermark asset. |
| **NFT dedupe** | `dedupeNFTs` by contract+token (+ expansion rules) before display. |
| **Wallet fetch** | Batched wallets (`WALLET_BATCH_SIZE` 3) with progress UI. |
| **Metadata** | Contract logo cache + in-flight dedupe; `getImage` skips collection logo as token art. |

## 2. Weak points / gaps (Quirkies today)

| Area | Gap |
|------|-----|
| **Preview “ready”** | `quirksWaitForPreviewGridImages` treated `complete && src` as done — can be true for broken dimensions; **no per-image timeout** (export enable could wait forever). |
| **Export `Image()`** | `quirksLoadImageWithFallbacks` tried gateways **without per-URL timeout** — one slow gateway blocks the chain until browser gives up. |
| **Concurrency** | Memory-constrained path staggers `data-quirks-src` loads; desktop fires many tiles at once (browser-limited only). |
| **Progressive DOM** | Full grid innerHTML/build in one pass — OK for moderate tile counts; less smooth than FlexGrid for very large previews. |

## 3. Worth porting (implemented or recommended)

**Done in this pass (low risk):**

- Align **preview wait** with FlexGrid: `naturalWidth` / `naturalHeight`, guarded `oneDone`, **12s** timeout per tile.
- Add **per-candidate timeout + short stagger** in `quirksLoadImageWithFallbacks` (export/canvas path).

**Recommended later (higher scope):**

- Optional **session Map** `resolvedUrlByRaw` for grid tiles (in addition to existing `localStorage` in `nftImageLoader.js`).
- **Preflight `Image()`** before swapping tile `src` (FlexGrid-style) for fewer broken intermediate states on `<img>`.
- **Progressive tile append** only if profiling shows main-thread pain at large N (keep grouped-set logic unchanged).

## 4. Do NOT port

- FlexGrid multi-wallet model, template layouts, manual picker UX, Zora paths, settings surface.
- Replacing Quirkies Worker with FlexGrid Worker URLs.
- Dropping **quirksPairing** / grouped units / Flecks-specific flows.

## 5. Upgrade order (safest → riskier)

1. **Export/preview wait + timeouts** (this PR) — reliability, no UX change to pairing.
2. **Session URL memo for grid** — performance, small code.
3. **Preflight image probe for tiles** — behavior tweak; test on mobile.
4. **Progressive grid rendering** — only if needed; must preserve unit indices and DnD.
