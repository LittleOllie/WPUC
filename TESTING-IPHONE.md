# Testing on iPhones

How to make sure the game looks and works the same on different iPhone models.

## What’s already in place

- **Viewport:** `viewport-fit=cover` so the game can use the full screen and safe areas on notched iPhones.
- **Safe areas:** Top (Back, HUD) and all overlays use `env(safe-area-inset-*)` so nothing is hidden by the notch or home indicator on any iPhone.

## How to test on each iPhone model

### 1. Real devices (most reliable)

1. Deploy the site (e.g. GitHub Pages) and open the **live URL** on each iPhone you care about.
2. Check:
   - Back button and HUD are not under the notch or Dynamic Island.
   - Buttons at the bottom of overlays (Start, Play Again, Leaderboard) are above the home indicator.
   - Layout doesn’t break on small (e.g. SE) vs large (e.g. Pro Max) screens.
   - Tap targets work (Start, Rules, jump in game, leaderboard, etc.).

### 2. Xcode Simulator (Mac only)

1. Install Xcode, then open **Xcode → Window → Devices and Simulators** and run an iPhone simulator (e.g. iPhone 15, iPhone SE).
2. In Simulator, open **Safari** and go to your **local** URL (e.g. `http://localhost:8000` if you run a local server) or your GitHub Pages URL.
3. Try several simulator sizes (SE, 14, 15 Pro Max) to cover different screen widths and safe areas.

### 3. Chrome DevTools device mode (quick check only)

1. On your computer, open the site in Chrome → **Inspect → Toggle device toolbar** (or Ctrl+Shift+M).
2. Pick a device (e.g. “iPhone 14 Pro”) and refresh.
3. Use this for layout and viewport size only. It does **not** match real Safari on iOS (touch, safe areas, or some CSS).

### 4. Cloud testing (no physical iPhones)

- **BrowserStack** or **Sauce Labs:** Run real Safari on real iOS devices in the cloud and open your GitHub Pages URL.
- **LambdaTest** and similar services also offer real device testing.

## iPhone sizes to consider

| Device        | Logical width | Notes                    |
|---------------|---------------|--------------------------|
| iPhone SE     | 375px         | Small screen             |
| iPhone 14/15  | 390px         | Common size              |
| iPhone 14/15 Plus | 428px    | Larger                   |
| iPhone 14/15 Pro Max | 430px | Largest, notch/Dynamic Island |

Your CSS already uses `max-width`, `vw`, and media queries (e.g. 768px, 480px), so layout should scale across these. Safe-area padding ensures notched models don’t clip the UI.

## Quick checklist before release

- [ ] Open the **live** site (e.g. GitHub Pages) on at least one real iPhone.
- [ ] Confirm Back and HUD are not under the notch/Dynamic Island.
- [ ] Confirm overlay buttons are above the home indicator.
- [ ] Test tap: Start, Rules, jump in game, leaderboard, submit score.
- [ ] If possible, try one small (SE) and one large (Pro/Pro Max) device or simulator.
