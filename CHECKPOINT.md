# ✅ Checkpoint: "Perfect" state

**Date:** February 14, 2025  
**Note:** This is the known-good state. If things break later, revert to this point.

## What’s in this state

- **Home:** `index.html` (Little Ollie landing, “ENTER THE SITE” → game)
- **Game:** `game.html` (One Button Hero, leaderboard, Firebase)
- **Assets:** All code references use `.webp` (convert PNGs to WebP to match)
- **Firestore:** Rules in `firestore.rules` (scores only, read/write with validation, no delete)
- **Firebase:** Config in `firebase.js` (restrict API key by referrer in Google Cloud if you like)

## How to revert to here

### If you use Git (e.g. GitHub)

1. Commit everything and create a tag:
   ```bash
   git add -A
   git commit -m "Checkpoint: perfect state Feb 14 2025"
   git tag checkpoint-perfect-feb2025
   git push origin main --tags
   ```
2. Later, to restore this exact state:
   ```bash
   git checkout checkpoint-perfect-feb2025
   ```
   Or create a new branch from it:
   ```bash
   git checkout -b recovery checkpoint-perfect-feb2025
   ```

### If you don’t use Git

- Zip or copy the whole project folder and name it e.g. `one-button-hero-web-checkpoint-feb14-2025.zip`.
- Keep that backup somewhere safe. To “revert,” replace the project folder with the contents of that zip.

---

*You asked to remember this moment as perfect. This file is that reminder.*
