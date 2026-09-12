# End-of-Day Gap Review (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

A proactive prompt — on demand, or once at a chosen time each day — that
finds the untracked gaps in today's timeline (the stretches between
tracked entries during the hours the user actually works) and offers to
categorize them, instead of leaving that time to silently vanish. This is
the mirror image of `IdleService`: idle detection catches time that
*was* tracked but shouldn't have been (away from keyboard while a timer
ran); gap review catches time that was **never tracked at all** because
the user forgot to start a timer, worked without one, or was in a meeting
with no timer running.

## 2. Current state in the codebase

Nothing like this exists today, but the exact building blocks it needs are
already in place and battle-tested elsewhere:

- `TimeEntryRepository.listInRange()` (`src/main/repositories/timeEntry.repository.ts:81`)
  already returns all entries for a day, sorted by `startedAt` (indexed),
  which is all a gap-finder needs to walk consecutive entries and measure
  the space between them.
- `rangesOverlap`/`isValidRange` (`src/shared/utils/time.ts`) already
  provide the interval math primitives; a gap-finder is the *complement*
  of the overlap check `ManualEntryModal.vue` already calls via
  `window.desktop.timeEntries.checkOverlap()` — same domain, opposite
  question ("what's NOT covered" instead of "does this collide").
- `ManualEntryModal.vue` already has the exact UI needed to fill a gap —
  project/task picker + start/end inputs, pre-fillable with the gap's
  bounds — no new entry-creation UI required, only a new *trigger* into
  the existing one.
- `NotificationService` already exists for the "once a day, at a chosen
  time" trigger path (same infrastructure [[pomodoro-mode]] and
  [[budget-alerts]] would use for their own periodic checks).

## 3. Proposed scope for v1

**In scope:**
- A `findGaps(date, workStartHour, workEndHour): Gap[]` computation in
  `ReportService`: given a day's entries, walk them in order and emit a
  `Gap` for every stretch ≥ a minimum threshold (default 20 minutes,
  configurable) between `workStartHour` and `workEndHour` (or between the
  first entry of the day and now, if simpler — see open questions) that
  isn't covered by an entry.
- Two new settings: `gapReviewEnabled` (off by default), and a
  `gapReviewMinimumMinutes` threshold — reuses the existing pattern of
  small, focused settings additions (`streakThresholdMinutes` is an
  existing precedent for exactly this kind of "minimum duration to count"
  knob).
- **On-demand** entry point for v1: a "Review my day" button on
  `TimelinePage.vue` that lists today's gaps and, for each, offers
  "Fill in" (opens `ManualEntryModal` pre-filled with the gap's start/end)
  or "Skip" (dismiss, don't ask again for that specific gap today —
  tracked in-memory for the session, not persisted).
- A gentle, **optional** end-of-day notification (only if
  `gapReviewEnabled` and `notificationsEnabled`) at a user-chosen time
  (default 18:00): "You have 2 untracked gaps today (1h 40m) — review
  them?" clicking through to the same review list.

**Out of scope for v1:**
- Any automatic guessing of what a gap *was* (no calendar integration, no
  app-activity correlation — see the existing, separate,
  not-implemented `app-activity-tracking.md` design doc, which explicitly
  keeps that kind of signal out of scope for now too).
- Multi-day retroactive gap review (e.g. "review last week") — today only
  for v1, to keep the prompt feeling like a quick daily habit rather than
  a big cleanup chore.
- Persisting "skip" decisions permanently (e.g. "always ignore gaps
  between 12:00–13:00 for lunch") — a real feature idea, but adds
  configuration surface better validated after the basic flow proves
  useful.

## 4. Architecture fit

### Schema

Two new settings only, no new tables (gaps are always computed on the fly
from existing `time_entries`, never persisted):

```sql
ALTER TABLE app_settings ADD COLUMN gap_review_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN gap_review_minimum_minutes INTEGER NOT NULL DEFAULT 20;
ALTER TABLE app_settings ADD COLUMN gap_review_notify_hour INTEGER NOT NULL DEFAULT 18;
```

### `ReportService` addition

```ts
export interface TimeGap {
  startedAt: string
  endedAt: string
  durationSeconds: number
}

findGaps(date: Date, minimumMinutes: number): TimeGap[] {
  const { start, end } = getLocalDayRange(date)
  const entries = this.timeEntries
    .listInRange({ startDate: start.toISOString(), endDate: end.toISOString() })
    .filter((e) => e.endedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const gaps: TimeGap[] = []
  let cursor = entries[0] ? new Date(entries[0].startedAt) : start
  for (const entry of entries) {
    const entryStart = new Date(entry.startedAt)
    if (entryStart.getTime() - cursor.getTime() >= minimumMinutes * 60_000) {
      gaps.push({ startedAt: cursor.toISOString(), endedAt: entry.startedAt, durationSeconds: Math.round((entryStart.getTime() - cursor.getTime()) / 1000) })
    }
    cursor = new Date(Math.max(cursor.getTime(), new Date(entry.endedAt as string).getTime()))
  }
  // trailing gap from the last entry to "now" is intentionally NOT included —
  // the user might just not be done yet; only gaps *between* tracked entries count
  return gaps
}
```

### IPC surface

```ts
reports: {
  findGaps(dateIso: string, minimumMinutes: number): Promise<TimeGap[]>
}
```

### Where the notification check runs

Same lightweight daily-tick mechanism proposed in [[budget-alerts]] and
[[recurring-tasks]] — worth building **one shared low-frequency scheduler**
in the main process that all three of these periodic/daily checks hook
into, rather than each feature adding its own `setInterval`.

### Renderer

- `TimelinePage.vue` gains a "Review my day" button (badge showing gap
  count when > 0) opening a `GapReviewModal.vue` — a simple list of gaps
  with "Fill in" (→ `ManualEntryModal` pre-filled) / "Skip" per row.
- Settings → Idle detection tab (or a new "Daily review" section near it,
  given the conceptual kinship with idle handling) gets the enable toggle,
  minimum-minutes input, and notification-hour input.

## 5. Open questions

1. Should the work-hours window be configurable (start/end hour settings),
   or is "any gap between the day's first and last tracked entry" a good
   enough v1 heuurotic that avoids adding two more settings fields?
   Leaning toward the simpler no-work-hours-window version for v1 — it
   naturally adapts to whoever's actual schedule, at the cost of not
   catching a gap *before* the first tracked entry of the day (e.g. missed
   the first hour of work entirely).
2. Should a filled-in gap default to `source: 'manual'` (existing value)
   or get its own `'gap_fill'` source value, to distinguish "backfilled via
   gap review" from an ordinary manual entry in future reporting? A
   distinct source costs nothing and preserves useful provenance.
3. Is the end-of-day notification path worth building in v1, or should
   this ship purely as an on-demand "Review my day" button first, adding
   the proactive notification only once the on-demand flow proves people
   actually use it?
