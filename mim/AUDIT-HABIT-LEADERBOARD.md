# Habit Tracking & Leaderboard System — Full Audit

**Date:** March 10, 2026  
**Scope:** Habit completion, leaderboard scoring, challenges, dashboard day selector, Firestore collections

---

## 1. HABIT COMPLETION TRACKING

### Current Model

| Location | Path | Structure | Purpose |
|----------|------|-----------|---------|
| **Primary** | `users/{uid}/habits/{habitId}` | `completedDates: ["YYYY-MM-DD", ...]` | Array of dates when habit was completed |
| **Derived** | `users/{uid}/checkins/{dateId}` | `habitsCompleted: [habitId1, ...]` | Habit IDs completed on that date |
| **habitCompletions** | N/A | **Does not exist** | Spec calls for a dedicated collection |

### Data Flow

- Checkbox change in `checkin.js` → `arrayUnion(selectedDate)` / `arrayRemove(selectedDate)` on `habit.completedDates`
- Same handler syncs `checkins/{dateId}` with `habitsCompleted`
- `backfillCompletedDatesFromCheckins()` migrates legacy `habitsCompleted` → `completedDates` on load

### Gap for Part 2

- No `habitCompletions` collection exists
- Completion is stored by date via `habit.completedDates` (array of YYYY-MM-DD)
- To add `habitCompletions` without deleting data: add write-through when completing habits; backfill from `habit.completedDates`

---

## 2. LEADERBOARD SCORING

### Current Behavior

| Aspect | Implementation |
|--------|----------------|
| Storage | `groups/{groupId}/members/{uid}` → `points` (number) |
| Accumulation | Points **do** accumulate; no daily reset |
| Award | `awardGroupChallengePoints()` on check (increment) |
| Revoke | `revokeGroupChallengePoints()` on uncheck (decrement) |
| Recalc | `recalculateGroupMemberPoints()` on group load |

### Current Formula

- `totalPoints = Σ (habit.completedDates.length × habitDef.points)` for each group challenge habit
- **Gap:** Does NOT filter by challenge `startDate` / `endDate` — all completed dates count

### Leaderboard Display

- `group.js` → `refreshMembersAndLeaderboard()` sorts members by `points` desc
- `onSnapshot` on `members` keeps it live

### Gap for Part 1 & 7

- Leaderboard already accumulates; Part 7 requires date-range filtering
- Part 1 is mostly met; ensure no resets occur

---

## 3. CHALLENGE SYSTEM

### Group Challenges (Primary for Leaderboard)

| Path | Fields |
|------|--------|
| `groups/{groupId}/challenges/{challengeId}` | `name`, `createdBy`, `habits: [{habitId, points}]`, `requireAccept`, `startDate`, `endDate`, `status` |

- `startDate` / `endDate` **already exist** (YYYY-MM-DD)
- Default: today → +14 days (set in create modal, no UI to change)
- Habits linked via `source: "groupChallenge"`, `challengeId`, `groupId`, `habitId`

### Gap for Part 5 & 6

- Challenge duration fields exist; Part 5 logic not enforced in award/revoke/recalc
- Part 6: Create modal lacks Start Date / End Date inputs (fixed 14-day default)

---

## 4. DASHBOARD DAY SELECTOR

### Current Implementation

- **File:** `js/checkin.js` → `renderDaySelector()`
- **Range:** 7 days (6 days ago → today); `for (let i = 6; i >= 0; i--)`
- **Editable:** Today + up to 3 days in the past (`isDayEditable()`)
- **Locked:** 4+ days ago — cannot select or edit

### UI States (Part 9)

- Green: `weekly-day-btn--complete` (all habits done)
- Red-ish: `weekly-day-btn--incomplete` (partial)
- Grey: `weekly-day-btn--future` (future day)
- Grey/locked: `weekly-day-btn--locked` (past, not editable)

Spec calls for: Green, Yellow, Red, Grey — current uses green/red/grey. Yellow can map to incomplete.

### Gap for Part 3 & 4

- Cannot scroll to **any** date; limited to 7 days
- Locked days cannot be viewed (only editable window)
- No "Add Current Habits" / "Add Custom Habits" for past days

---

## 5. FIRESTORE COLLECTIONS

### User Data (Preserve)

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | Profile, streak, groupIds |
| `users/{uid}/habits` | Habits with `completedDates`, `source`, `challengeId`, `groupId` |
| `users/{uid}/checkins` | `habitsCompleted`, `habitNotes` per date |
| `users/{uid}/activeChallenges` | Personal challenge progress |
| `users/{uid}/completedChallenges` | Completed personal challenges |
| `users/{uid}/badgeProgress` | Badge unlock state |

### Group Data

| Collection | Purpose |
|------------|---------|
| `groups/{groupId}` | Group metadata |
| `groups/{groupId}/members` | Member info, **points** |
| `groups/{groupId}/challenges` | Challenge defs with `startDate`, `endDate` |
| `groups/{groupId}/activity` | Activity feed |
| `groups/{groupId}/memberStats` | Weekly checkin stats |

### New (Part 2)

| Collection | Purpose |
|------------|---------|
| `users/{uid}/habitCompletions` | Per-date completion records (optional write-through) |

---

## 6. EXISTING DATA & MIGRATION RISKS

### Must Preserve

- `habit.completedDates` — do NOT wipe
- `checkins.habitsCompleted` — keep in sync
- `members.points` — recalc only; do not reset to 0 for existing members without recomputing
- All checkin/habit history — no deletions

### Backwards Compatibility

- Old habits without `createdDate` → treat as active for all dates
- Old completions in `completedDates` → count for leaderboard (with date filter when Part 7 applied)
- Map old entries to new system using **completion date** as fallback (not "today")

---

## 7. IMPLEMENTATION CHECKLIST

| Part | Task | Status |
|------|------|--------|
| 1 | Leaderboard accumulation (no reset) | Done |
| 2 | Add `habitCompletions` collection (write-through, backfill) | Done |
| 3 | Dashboard day scrolling — select ANY date | Done |
| 4 | Add Current Habits / Add Custom Habits for past days | Done |
| 5 | Challenge duration in data model | Done |
| 6 | Admin Start/End Date in create challenge modal | Done |
| 7 | Leaderboard: filter by `startDate` ≤ date ≤ `endDate` | Done |
| 8 | Preserve existing data, no deletes | Done |
| 9 | UI color indicators (green/yellow/red/grey) | Done |
| 10 | Test scenarios | Manual verification needed |

---

## 8. IMPLEMENTATION SUMMARY

### Files Changed/Added

- `js/group-challenges.js`: Challenge date filtering in award, revoke, recalc
- `js/checkin.js`: Day selector with week nav; Add Current/Custom Habits; habitCompletions write-through; award for any date
- `js/habit-completions.js`: New module for habitCompletions collection
- `js/group.js`: Start/End date inputs in create challenge modal
- `firestore.rules`: habitCompletions subcollection rules
- `index.html`: Day selector nav, Add Habits section, Add Custom modal
- `group.html`: Challenge start/end date inputs
- `css/style.css`: Yellow for incomplete, day selector nav, add habits UI
