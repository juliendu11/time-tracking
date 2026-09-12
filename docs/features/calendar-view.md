# Calendar View (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

A month-grid calendar showing tracked time per day (like a real calendar
app), with click/drag to create a manual time entry directly on a day —
complementing the app's existing day-by-day agenda view. Value: a
higher-altitude view than one day at a time, useful for spotting patterns
("I didn't track anything two Fridays ago") and for quickly backfilling a
missed day without opening a form and typing dates by hand.

## 2. Current state in the codebase

`TimelinePage.vue` already exists and covers the **single-day** case well:
it shows one day at a time with `shiftDay`/`goToday` navigation, and opens
`ManualEntryModal` for manual entries. This is a solid, working agenda
view — the gap is purely the "zoomed out" month view, not a replacement for
Timeline.

`ManualEntryModal.vue` already has everything a calendar's create-on-click
flow needs: project/task pickers, start/end datetime inputs, overlap
detection via `window.desktop.timeEntries.checkOverlap()`. A calendar view
mainly needs to pre-fill the date and open this same modal — no new entry
logic required.

`ReportService.getHeatmap()` already aggregates per-day duration/session/
project counts over a multi-month range, indexed on `started_at` — the same
shape a calendar month view needs for its per-day totals, though the
existing `ActivityHeatmap.vue` component renders it as a GitHub-style
contribution grid (weeks as columns), not a real calendar month layout
(weeks as rows, days aligned to weekday columns, month boundaries visible).

## 3. Proposed scope for v1

**In scope:**
- A new `CalendarPage.vue` under `features/calendar/` (or as a mode toggle
  within the existing Timeline feature — see open questions), with:
  - Standard month grid (respecting `weekStartsOn` from settings, like
    `TimesheetPage` already does).
  - Each day cell shows total tracked duration and a small color-coded bar
    per project (reusing `project.color`, same visual language as the
    Timesheet rows' color dot).
  - Click a day → jump into `TimelinePage`'s single-day view for that date
    (reuse, don't duplicate, the existing day view).
  - Click-and-drag is out of scope for the first cut (see below) — a
    "+" button on a day cell opens `ManualEntryModal` pre-filled with that
    date, 09:00–10:00 default, same defaults `ManualEntryModal` already
    uses for its own default range.
  - Month navigation (prev/next/today), mirroring `TimesheetPage`'s
    `shiftWeek`/`goToday`-equivalent pattern.
- Data source: `ReportService.getHeatmap(reference, 1, projectFilter)`
  already returns exactly the per-day aggregates needed for one month; no
  new backend aggregation required for the read side.

**Out of scope for v1:**
- True drag-to-create-a-range-of-hours-within-a-day (like Google
  Calendar's day/week view) — that's a much bigger interaction to build
  well (drag start, drag resize, snapping) and the "+" button covers the
  same end result (create an entry on a specific day) with far less UI
  risk. Could be a v2 once the month view is validated as useful.
- Week view (7-day, hour-by-hour grid) — month view first; a week view is
  a natural but separate follow-up once the month grid's data plumbing
  exists.
- Merging into `TimelinePage.vue` as a single component with a view-mode
  switch — start as a separate page/route; merge later if it turns out
  users want to flip between them constantly (see open questions).

## 4. Architecture fit

No schema or domain-type changes needed — this is a renderer-only feature
built entirely on existing IPC surface (`reports.getHeatmap`,
`timeEntries.create` via `ManualEntryModal`, `settings` for
`weekStartsOn`).

### Renderer

- `src/renderer/src/features/calendar/CalendarPage.vue` — new route
  (`/calendar`), added to the sidebar nav alongside Timeline/Timesheet.
- `src/renderer/src/features/calendar/components/CalendarMonthGrid.vue` —
  pure presentational grid, takes `HeatmapDay[]` + month/year +
  `weekStartsOn`, emits `select-day`/`create-on-day`.
- Reuses `ManualEntryModal.vue` unmodified — it already accepts a
  `startInput` default; the calendar just needs to pass the clicked date
  instead of "30 minutes ago."
- Router: add a `calendar` route in the renderer's router config next to
  the existing `timeline`/`timesheet` routes.

## 5. Open questions

1. Separate page vs. a view-mode toggle inside the existing Timeline
   feature (`Day | Month`)? A toggle keeps navigation simpler (one nav
   item, not two) but couples two components with different layout needs;
   starting separate is lower-risk and easy to merge later if it proves
   awkward to have both.
2. Should the month grid support the same per-project filter the heatmap
   already offers (`heatmapFilterCurrentOnly` in `DashboardPage.vue`), or
   always show all projects with the color-coded bars doing the
   disambiguation?
3. Does clicking a day with zero tracked time behave differently (e.g.
   straight to `ManualEntryModal`) versus a day with existing entries
   (straight to the day view)? Worth testing both to see which feels
   right rather than deciding up front.
