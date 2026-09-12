# Split a Time Entry Across Projects (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

Let the user take one tracked block of time — just stopped, or an existing
entry — and divide it across multiple projects/tasks by percentage or
explicit duration: "that 2-hour block was actually 75 minutes on Client A
and 45 minutes on Client B." Value: for anyone doing genuinely
interleaved context-switching work within a single sitting (consulting,
support work, agency work juggling several small clients in one morning),
forcing a stop/restart of the timer for every few minutes of switching is
both annoying and produces artificially fragmented, hard-to-read history —
a post-hoc split matches how the work actually happened.

## 2. Current state in the codebase

There is no splitting concept for a *single* time entry today. The one
existing use of "split" in the codebase is unrelated: `IdleService`'s
"Remove idle time / Keep idle time / **Split session**" prompt splits a
timer session around a *detected idle gap* (before-idle vs. after-idle),
not across different projects — different problem, same word. Worth
keeping the two clearly distinguished in the UI (e.g. call this one
"Split across projects" or "Reallocate time") so users don't confuse it
with idle-session splitting.

Everything this needs to build on already exists:
- `TimeEntryRepository.create()`/`.delete()` already handle validation
  (`isValidRange`) and duration computation.
- The app already computes duration cleanly from start/end timestamps
  everywhere (`computeElapsedSeconds`, `ManualEntryModal`'s duration
  preview) — allocating a total duration across N slices by percentage is
  simple arithmetic on top of that, no new time-math primitives needed.
- `TimeEntrySource` is already an extensible union
  (`'timer' | 'manual' | 'timesheet' | 'idle_adjustment' | 'import'`) —
  precedent for adding a new source value cleanly.

## 3. Proposed scope for v1

**In scope:**
- A "Split" action available from: the stop-timer flow (offered right
  after stopping, as an alternative to just saving the single entry — a
  natural moment, since the user just finished the mixed-work block and
  remembers the breakdown), and from any existing entry's row menu in
  Timeline/Timesheet (retroactive split).
- A `SplitEntryModal.vue`: shows the original entry's total duration, and
  a list of allocation rows (project + optional task + percentage **or**
  explicit duration — the two stay in sync, editing one recalculates the
  other), with a running "remaining: 12m" indicator and a hard block on
  saving until allocations sum to exactly the original duration.
- The split is **atomic and destructive on the original**: the source
  entry is deleted and replaced by N new entries, each a contiguous slice
  of the original time range in the order the user lists them (slice 1
  gets `[originalStart, originalStart + slice1Duration)`, slice 2
  continues from there, etc.) — order matters for the resulting timeline
  read-out, and the UI should let the user drag-reorder rows.
- New entries get `source: 'split'` (see open questions) so they're
  identifiable later (e.g. in reports, or if [[invoicing-billing]] needs
  to reason about which entries came from a split).
- Undo: reuse the existing delete/restore pattern
  (`TimeEntryRepository.restore()` already exists for undo-delete) by
  keeping the original entry's full data in memory for one "Undo split"
  toast action after saving, recreating the original and deleting the N
  slices if clicked.

**Out of scope for v1:**
- Splitting by anything other than contiguous time slices (e.g.
  "alternating minutes between two projects") — always contiguous blocks
  in the order specified.
- Bulk/multi-entry splitting (selecting several entries and splitting them
  all with the same allocation ratios) — one entry at a time for v1.
- Tag/description carryover logic beyond "copy the original's description
  to every slice unless the user edits it per-row" — simple default, fully
  editable per row before saving.

## 4. Architecture fit

### Domain types

Extend `TimeEntrySource` with `'split'`, and add a request/response shape
for the operation:

```ts
export type TimeEntrySource =
  | 'timer' | 'manual' | 'timesheet' | 'idle_adjustment' | 'import' | 'split'

export interface SplitAllocation {
  projectId: string
  taskId: string | null
  durationSeconds: number
  description: string | null
}
```

### `TimeEntryRepository` addition

A single transactional method rather than composing separate
create/delete calls from the renderer, so a failure partway through can't
leave the data in a half-split state:

```ts
splitEntry(entryId: string, allocations: SplitAllocation[]): TimeEntry[] {
  const original = this.getOrThrow(entryId)
  const totalRequested = allocations.reduce((sum, a) => sum + a.durationSeconds, 0)
  if (totalRequested !== original.durationSeconds) {
    throw new ValidationError('Allocations must sum to the original entry\'s duration.')
  }

  return this.db.transaction(() => {
    this.delete(entryId)
    let cursor = new Date(original.startedAt)
    const created: TimeEntry[] = []
    for (const allocation of allocations) {
      const sliceEnd = new Date(cursor.getTime() + allocation.durationSeconds * 1000)
      created.push(this.create({
        projectId: allocation.projectId,
        taskId: allocation.taskId,
        description: allocation.description ?? original.description,
        startedAt: cursor.toISOString(),
        endedAt: sliceEnd.toISOString(),
        source: 'split',
        tagIds: original.tagIds
      }))
      cursor = sliceEnd
    }
    return created
  })
}
```

### IPC surface

```ts
timeEntries: {
  // ...existing methods
  split(entryId: string, allocations: SplitAllocation[]): Promise<TimeEntry[]>
}
```
Plus a zod schema in `src/shared/validation/schemas.ts` validating that
allocations is non-empty and each `durationSeconds > 0` (the sum-matches-
original check stays server-side, since it depends on the entry being
split).

### Renderer

- `SplitEntryModal.vue` — new component under
  `features/timer/` or `features/timeline/` (wherever
  `ManualEntryModal.vue` lives), reusing its project/task picker pattern.
- Timeline/Timesheet row menus and the post-stop-timer flow both get a
  "Split across projects…" entry point opening this modal with the
  relevant entry pre-loaded.
- A toast with "Undo" after a successful split, following the same
  pattern as other destructive actions already using
  `uiStore.pushToast`.

## 5. Open questions

1. Is `'split'` the right source value, or should slices keep
   `source: 'manual'` and instead carry a `splitFromEntryId` /
   `splitGroupId` reference for provenance (lets you later query "show me
   everything that came from this one split event," not just "was this
   ever split")? A group id is more powerful but is genuinely new schema
   (a nullable FK column) rather than reusing the existing enum — worth
   deciding based on whether that lineage will actually be queried
   anywhere, or if the simpler enum value is enough.
2. Should splitting be offered as a suggestion (not just an on-request
   action) when a stopped session is unusually long (e.g. > 90 minutes),
   on the theory that very long single blocks are the ones most likely to
   actually be mixed work? Could tie into the existing `SuggestionService`.
3. Percentage vs. duration as the primary input: does the UI default to
   percentage sliders (feels more natural for "roughly 60/40") or minute
   inputs (feels more precise/billing-safe, relevant if
   [[invoicing-billing]] ships and split entries feed directly into
   invoices)? Supporting both with live sync (as scoped above) sidesteps
   picking one, at the cost of slightly more UI complexity.
