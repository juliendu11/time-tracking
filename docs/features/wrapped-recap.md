# "Wrapped"-Style Recap Card (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

A shareable, visual recap of a period's tracked time — monthly or annual —
in the spirit of Spotify Wrapped: top project, most productive day/hour,
longest streak, total hours, a mini heatmap. Rendered as a single image the
user can save or share. Value: this is almost pure upside — the numbers
already exist in the codebase (see below), so the entire cost is a
presentation layer, and it gives users a reason to open the app and feel
good about their tracked time rather than only seeing it as a chore.

## 2. Current state in the codebase

Nearly all the source data this needs is **already computed** by
`ReportService` (`src/main/services/report.service.ts`) for the dashboard —
this feature is much closer to "new view over existing data" than "new
metric":

- `getAdditionalMetrics(reference, streakThresholdMinutes)` already
  returns `dailyAverageSeconds`, `longestSessionSeconds`, `sessionsToday`,
  `sessionsWeek`, `activeDaysWeek`, `currentStreakDays`,
  `mostProductiveWeekday`, `mostProductiveHourRange`,
  `weeklyConsistencyPercent` — currently computed only over the *current*
  week/day, but the underlying logic generalizes to an arbitrary range
  trivially (it already takes a `reference` date and walks backward).
- `getFocusScore` already returns a `FocusScoreBreakdown` (score,
  average session length, interruption count).
- `getProjectDistribution(start, end)` and `getTopTasks(start, end,
  limit)` already return exactly "top project" / "top task" for any range.
- `getHeatmap(reference, months, projectId?)` already produces the
  per-day data a mini contribution-graph visual needs.
- **Nothing renders any of this as a shareable image** — the dashboard
  renders it as live Vue components in the app window, not exportable.
  There's no `capturePage`/image-export precedent anywhere in the
  codebase.

## 3. Proposed scope for v1

**In scope:**
- A `getRecap(start: Date, end: Date): RecapData` method in `ReportService`
  that's a thin composition of the existing methods above run over the
  requested range instead of the current week — no new aggregation
  algorithms, just parameterizing what's already there and picking the
  "headline" facts (total tracked hours, top project + its share, top
  task, longest streak within the range, most productive weekday/hour,
  number of active days, one fun superlative like longest single session).
- Two preset periods for v1: **"This month"** and **"This year"** — picked
  from a small menu, not an arbitrary date range picker (a recap is a
  celebratory snapshot, not a report; keep the entry point simple).
- A `RecapCard.vue` component: a fixed-aspect-ratio (e.g. 1080×1350,
  portrait, share-friendly) card laid out with the headline numbers, using
  the project colors already in the data model for visual identity, plus a
  compact version of the existing heatmap style.
- Export as PNG via `webContents.capturePage()` on an offscreen
  `BrowserWindow` rendering the card — the same "render HTML in an
  offscreen window, capture it" mechanism proposed for PDF output in
  [[invoicing-billing]] and [[reporting-exports]], just captured as an
  image instead of printed as a PDF. Worth building one shared
  `renderOffscreen(html: string): BrowserWindow` helper all three features
  use.
- Entry point: a "Your year in review" / "Monthly recap" prompt, either
  on-demand from Settings/Dashboard, or a one-time gentle surface at the
  start of a new month/year (dismissible, not a recurring nag).

**Out of scope for v1:**
- Direct social sharing integrations (posting to any platform) — this is
  an **offline, local-first app**; export a PNG file and let the user share
  it however they want, exactly like the existing `exportJson`/`exportCsv`
  "here's your file" pattern.
- Custom/arbitrary date ranges for the recap — two presets only, to keep
  the feature feeling like a distinct "moment" rather than another report
  variant (that's what [[reporting-exports]] is for).
- Multiple card templates/themes — one well-designed default layout for
  v1.
- Per-project recaps — recap is whole-account, matching how Wrapped-style
  features work elsewhere (a summary of *you*, not a filtered report).

## 4. Architecture fit

No schema changes needed — purely computed from existing `time_entries`/
`projects` data, nothing new to persist (a "have we shown this year's
recap yet" dismissal flag could live in a single new `AppSettings` boolean
if the "gentle prompt at year start" entry point is built; skippable if
recap stays purely on-demand for v1).

### `ReportService` addition

```ts
export interface RecapData {
  rangeLabel: string // "2026" or "September 2026"
  totalSeconds: number
  activeDays: number
  topProject: ProjectDistributionSlice | null
  topTask: TopTaskEntry | null
  longestStreakDays: number
  longestSessionSeconds: number
  mostProductiveWeekday: number | null
  mostProductiveHourRange: { startHour: number; endHour: number } | null
  heatmap: HeatmapDay[] // for the mini contribution graph on the card
}

getRecap(start: Date, end: Date): RecapData {
  // composes getProjectDistribution, getTopTasks, getHeatmap, and a
  // range-generalized version of the streak/superlative logic already in
  // getAdditionalMetrics
}
```

The streak logic in `getAdditionalMetrics`'s private `computeStreak` is
"current streak ending today" — a recap instead needs "longest streak
*within* the range," a small variant of the same walk (track a running
streak and its max instead of stopping at the first gap).

### IPC surface

```ts
reports: {
  // ...existing methods
  getRecap(startIso: string, endIso: string): Promise<RecapData>
  exportRecapImage(startIso: string, endIso: string): Promise<string> // returns saved PNG path
}
```

### Renderer

- `src/renderer/src/features/recap/RecapCard.vue` — the visual card,
  designed to look good both live (in-app) and captured as a static image
  (no animations/hover states relied on for content).
- `src/renderer/src/features/recap/RecapModal.vue` — period picker (month/
  year) + the card preview + a "Save image" button calling
  `exportRecapImage`.
- A subtle entry point: a button in Settings/About, or a small "🎉 Your
  September recap is ready" toast/banner at month rollover if the
  proactive-prompt path is built.

## 5. Open questions

1. Should the "longest streak within range" and "most productive
   weekday/hour" computations be capped to a reasonable data window (e.g.
   skip if the account has less than a week of history) so a brand-new
   user doesn't get a recap that's mostly zeros/nulls?
2. Is a proactive monthly/yearly prompt worth the added complexity (a
   dismissal-tracking setting + a startup check for "has the period
   rolled over"), or is an on-demand-only entry point (Settings → "View
   my recap") enough for v1 and lower risk of feeling naggy?
3. Card visual identity: lean on the app's existing DaisyUI theme tokens
   (so it matches light/dark mode) or design one fixed, theme-independent
   "recap" look (more Wrapped-like — bold, own palette, not tied to the
   user's chosen app theme)? The latter probably reads better as a
   "special occasion" artifact.
