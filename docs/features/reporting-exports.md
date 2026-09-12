# Scoped Report Exports: CSV, PDF, iCal (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

Let the user export *a specific view they're already looking at* — a
timesheet week, a report date range, a single project's history — as a
file, in the format that fits the destination: CSV/PDF for accounting or a
client, iCal for viewing tracked time in an external calendar app. This is
distinct from, and complements, the full-database export the app already
has.

## 2. Current state in the codebase

`BackupService` (`src/main/services/backup.service.ts`) already exposes:

- `exportJson()` — a full dump of **every** project, task, time entry, tag,
  and the settings row (`buildExportBundle()`, hardcoded range
  `1970-01-01` → tomorrow, no project filter). Exposed in Settings → Backup
  & Data as "Export JSON."
- `exportCsv()` — same full-database scope, flattened to one CSV of time
  entries (`id, project, task, description, started_at, ended_at,
  duration_seconds, source`). Exposed as "Export CSV."

Both are **all-time, all-projects dumps** meant for backup/portability, not
for producing a document about "this week" or "this client's project." There
is no way today to export just what `TimesheetPage` or `ReportsPage` is
currently showing, and no PDF or iCal export exists at all.

`ReportService` already has the exact range-scoped queries a scoped export
needs: `getTimesheetWeek(weekStart, weekStartsOn)`,
`timeEntries.listInRange({ startDate, endDate, projectIds })`. A scoped
export is mostly a new formatting/output layer on data the app already
computes — not new aggregation logic.

## 3. Proposed scope for v1

**In scope:**
- An "Export" action on `TimesheetPage.vue` and `ReportsPage`/dashboard
  range views, offering:
  - **CSV** — same columns as the existing export, but scoped to the
    visible range/project(s) instead of the whole database.
  - **PDF** — a formatted, printable version of the same data (weekly
    timesheet grid, or a report summary with the charts' underlying
    numbers as tables) via `webContents.printToPDF()` (see
    [[invoicing-billing]] — same PDF mechanism, reused here).
  - **iCal (.ics)** — one `VEVENT` per time entry in range (`DTSTART`,
    `DTEND`, `SUMMARY` = project/task/description), so a user can drop
    their tracked time into Google Calendar/Outlook/Apple Calendar as a
    read-only reference. Pure string generation, no library needed
    (the ICS format is simple enough to hand-roll for one event type, or
    use a tiny dependency-free generator).
- All three exports default to the write-file dialog / `getExportsDir()`
  pattern already used by `BackupService`, for consistency.

**Out of scope for v1:**
- Two-way iCal sync (import external calendar events, or push edits back)
  — this is export-only, one direction.
- Custom report/PDF templates or branding — one clean default layout.
- Scheduling recurring automatic exports (e.g. "email me a CSV every
  Friday") — no email/network capability belongs in this offline app.

## 4. Architecture fit

### New service: `ExportService` (`src/main/services/export.service.ts`)

Kept separate from `BackupService`, which stays focused on full-database
backup/restore/reset — exports here are read-only, scoped, and disposable.

```ts
class ExportService {
  constructor(private readonly timeEntries: TimeEntryRepository, private readonly projects: ProjectRepository, private readonly tasks: TaskRepository) {}

  exportRangeCsv(filter: TimeEntryRangeFilter, destinationPath?: string): string
  exportRangePdf(filter: TimeEntryRangeFilter, title: string, destinationPath?: string): Promise<string>
  exportRangeIcs(filter: TimeEntryRangeFilter, destinationPath?: string): string
}
```

`exportRangeCsv`/`exportRangeIcs` reuse `csvEscape`-style helpers already
private to `backup.service.ts` — worth promoting to a shared
`src/main/utils/export.ts` so both services use the same escaping logic
rather than duplicating it.

`exportRangePdf` loads an offscreen `BrowserWindow`, feeds it a
server-rendered HTML string (built from the same data as the CSV, styled
minimally), and calls `printToPDF()` — identical mechanism proposed in
[[invoicing-billing]] for invoices; if both land, factor a shared
`renderHtmlToPdf(html: string, destinationPath: string): Promise<string>`
helper.

### IPC surface

New `exports` namespace on `DesktopApi`:
```ts
exports: {
  csv(filter: TimeEntryRangeFilter): Promise<string>
  pdf(filter: TimeEntryRangeFilter, title: string): Promise<string>
  ics(filter: TimeEntryRangeFilter): Promise<string>
}
```
`TimeEntryRangeFilter` already exists as a main-process-only type
(`src/main/repositories/timeEntry.repository.ts`) — it needs to move to
`src/shared/types/` (or a matching subset defined there) to cross the IPC
boundary per the project's contract-first rule (`ipc.ts` + zod schema +
handler + preload, all four move together).

### Renderer

- `TimesheetPage.vue` and the dashboard/reports range views get a small
  "Export ▾" dropdown (CSV / PDF / iCal) next to the existing week
  navigation, calling `window.desktop.exports.*` and toasting the
  destination path (same UX as `exportJson`/`exportCsv` today in Settings).

## 5. Open questions

1. Should the scoped CSV also include `is_billable` if
   [[invoicing-billing]] ships first (or vice versa — order of
   implementation affects the shared column list)?
2. iCal all-day vs. timed events: an entry spanning midnight (already
   handled for reporting via `splitDurationByLocalDay`) — does the .ics
   export split it into two events per local day too, or emit one
   UTC-spanning event? Splitting matches the rest of the app's day-boundary
   handling and is probably the right default.
3. PDF layout: reuse the visual style of the in-app timesheet table
   directly (simplest), or design a distinct "printable report" look?
