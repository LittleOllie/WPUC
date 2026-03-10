# Motivation in Motion — State Snapshot (Mar 8, 2026)

Reference document for the current app state. Use this to restore or understand behavior if something goes wrong.

---

## 1. App Structure

### Key Pages
- **index.html** — Dashboard: today's habits, streak, weekly chain, groups
- **habits.html** — Add/edit/delete habits
- **challenges.html** — Challenge library, active, completed
- **checkin.html** — Placeholder ("Coming next")

### Scripts Loaded on Dashboard (index.html)
- `js/app.js` — Main app bootstrap, auth, nav
- `js/checkin.js` — Today's habits, progress, checkboxes, streak, share

---

## 2. Habit Progress Calculation (Fixed)

### Logic
- **Source of truth:** `habits` array (from `users/{uid}/habits`)
- **Completed today:** `completedIds` (habit IDs from `users/{uid}/checkins/{date}`)

```javascript
// Progress display (js/checkin.js ~line 107–131)
const total = habits.length;
const completedHabitsToday = habits.filter((h) => completedIds.includes(h.id)).length;
const percent = total ? Math.round((completedHabitsToday / total) * 100) : 0;
// Display: "X / Y habits completed"
```

### Sanitization
1. **On load:** `completedIds = rawCompleted.filter((id) => habits.some((h) => h.id === id))`
2. **On save:** Persist only IDs that exist in `habits`
3. **Share achievement:** Uses `habits.filter((h) => completedIds.includes(h.id)).length`, not `completedIds.length`

### Checkbox Handler
- **Single listener:** `todayHabitsEl.addEventListener("change", ...)` — no `onClick`
- On check: add to `completedIds`, save `sanitizedCompleted`
- On uncheck: remove from `completedIds`, save `sanitizedCompleted`
- After save: `completedIds = sanitizedCompleted`

### Debug Logging
```javascript
console.log("[Checkin] Total habits:", total, "Completed habits today:", completedHabitsToday);
```

---

## 3. Firestore Structure

### Collections
- `users/{uid}/habits/{habitId}` — All habits (manual + challenge)
- `users/{uid}/checkins/{dateId}` — Daily checkin: `{ habitsCompleted: string[], celebrationShown?: boolean }`
- `users/{uid}/activeChallenges/{challengeId}` — Active challenge progress
- `users/{uid}/completedChallenges/{challengeId}` — Completed: `{ challengeId, completedAt, habitKept }`
- `challenges/{challengeId}` — Optional definitions (read-only)
- `groups/{groupId}/...` — Groups, members, activity, memberStats

### Habit Document
```javascript
// Manual habit
{ name, createdAt, completedDates, isShared, source: "manual" }

// Challenge habit
{ name, createdAt, completedDates, isShared, source: "challenge", challengeId }
```

### Checkin Document
```javascript
{ habitsCompleted: ["habitId1", "habitId2"], celebrationShown?: true }
```

---

## 4. Challenge System

### Flow
1. Start: `ensureChallengeHabitExists()` → create/link habit → create `activeChallenges` doc
2. Check habit on dashboard → `updateChallengeProgress()` increments progress
3. When `progress >= durationDays` → Keep/Remove popup → move to `completedChallenges`

### Challenge habit creation (js/challenges.js)
- Query habits by name (case-insensitive)
- If exists: add `source: "challenge"`, `challengeId` if missing
- If new: create with `source: "challenge"`, `challengeId`

### Keep vs Remove
- **Keep:** Habit stays in `habits`, challenge moved to `completedChallenges`
- **Remove:** Delete habit, set `habitKept: false`, broadcast `mim-habits-changed`

### Challenge habits and progress
- Challenge habits live in `users/{uid}/habits` — same collection as manual habits
- `source` does **not** affect progress; all habits use the same progress formula

---

## 5. Habits Page (js/habits.js)

- `onSnapshot` on habits for real-time updates
- Sorted by `createdAt` ascending
- Add: `source: "manual"`
- Edit/Delete via habit refs

---

## 6. Key File Paths

| File | Purpose |
|------|---------|
| `js/checkin.js` | Dashboard habits, progress, checkbox, streak, share |
| `js/challenges.js` | Challenge library, start challenge |
| `js/challenge-progress.js` | Increment progress, Keep/Remove flow |
| `js/challenge-complete-popup.js` | Keep/Remove modal |
| `js/challenge-definitions.js` | Built-in challenge defs |
| `js/habits.js` | Habits list page |
| `js/share-achievement.js` | Share achievement modal |
| `firestore.rules` | Firestore security rules |

---

## 7. Firestore Rules (firestore.rules)

- `users/{userId}`: read if auth, write if owner
- `habits`, `checkins`, `activeChallenges`, `completedChallenges`: owner only
- `challenges`, `badges`: read if auth, write false
- `groups`: owner/admin for update/delete; members for activity

---

## 8. Broadcast Channel

- Channel: `mim-habits-changed`
- Used when habits change (challenge start, habit removed after challenge)
- Dashboard and habits page listen and refresh

---

## 9. Built-in Challenges (challenge-definitions.js)

- Become a Fish (Drink 2L Water, 7 days)
- Week of Reading (Read 20 Minutes, 7 days)
- Daily Meditation (Meditate 10 Minutes, 7 days)
- Hydration Hero (Drink Water Daily, 14 days)

---

*Snapshot created Mar 8, 2026.*
