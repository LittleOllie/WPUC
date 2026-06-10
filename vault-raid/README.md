# Vault Raid

Old-school compact browser game — HTML, CSS, vanilla JavaScript, Firebase.

## Run

```bash
cd vault-raid
npm run dev
```

Open http://localhost:5175

## Files

| File | Purpose |
|------|---------|
| `index.html` | Login + game layout |
| `styles.css` | LO old-school styling |
| `app.js` | Game logic |
| `firebase.js` | Auth + Firestore |
| `assets/` | Logo |

## Play

Enter a **username** — progress saves in your browser (localStorage). Same name = same save.

Firebase login is disabled for now (`firebase.js` kept for later).

## Game loop

Collect **$Lollies** → buy gear → raid NPCs → stash in **Vault** → Charge refills every **5 min**.
