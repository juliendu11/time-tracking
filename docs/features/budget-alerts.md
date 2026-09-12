# Project Budget & Goal Alerts (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

Surface, and actively alert on, the project budget/goal tracking the
backend already computes but the UI mostly ignores: a project's total
hour **budget** (`Project.budgetMinutes`) and its weekly time **target**
(`Project.weeklyTargetMinutes`). Today these are silent numbers; the value
add is turning them into something the user actually notices — a visible
budget bar and a notification when they cross a threshold — so a freelancer
doesn't discover they've blown through a fixed-price project's hour budget
after the fact.

## 2. Current state in the codebase

This is less "build from scratch" than "finish wiring what's already
there":

- `ReportService.getProjectStats()` (`src/main/services/report.service.ts:83`)
  **already computes both percentages**:
  ```ts
  const goalPercentage = project.weeklyTargetMinutes
    ? Math.round((weekSeconds / 60 / project.weeklyTargetMinutes) * 100)
    : null
  const budgetPercentage = project.budgetMinutes
    ? Math.round((allTimeSeconds / 60 / project.budgetMinutes) * 100)
    : null
  ```
  Both are returned on `ProjectStats` (`week.goalPercentage`,
  `budgetPercentage`).
- `ProjectDetailPage.vue`, however, **does not use `stats.budgetPercentage`
  at all**, and doesn't use `stats.week.goalPercentage` either — it
  recomputes an equivalent number itself, client-side, in a `weekProgress`
  computed property, and renders only that as a "Weekly goal" progress bar.
  The backend-computed `budgetPercentage` (total budget usage) has **no UI
  surface anywhere**.
- There is no notification of any kind when either number crosses 80%,
  100%, or beyond — `NotificationService` exists and is already used for
  idle prompts and a manual test notification, but nothing calls it for
  budget/goal state.
- App-level `dailyGoalMinutes`/`weeklyGoalMinutes` (separate from
  per-project `weeklyTargetMinutes`) already feed `getDashboardSummary` and
  the Focus Score card's "goal reached" indicator — that layer is already
  reasonably surfaced and is *not* the gap this doc addresses.

## 3. Proposed scope for v1

**In scope:**
- On `ProjectDetailPage.vue`: replace the ad-hoc `weekProgress` computed
  with the backend's `stats.week.goalPercentage`, and add a second progress
  bar for `stats.budgetPercentage` ("Budget used: 62%") when
  `project.budgetMinutes` is set — same visual pattern as the existing
  weekly goal bar, just wired to the number that already exists.
- Color/urgency state on both bars: normal under 80%, warning 80–100%,
  error past 100% (DaisyUI `progress-warning`/`progress-error` classes —
  no new dependency).
- A one-time notification per crossing, per project, per period, via the
  existing `NotificationService`:
  - Weekly target crossed 100% → "You've reached your weekly target for
    {project}."
  - Total budget crossed 80% → "{project} has used 80% of its hour
    budget."
  - Total budget crossed 100% → "{project} is over its hour budget."
  - "Per period" dedup matters: the weekly-target notification must fire at
    most once per calendar week per project; the budget ones fire once per
    threshold ever (budget doesn't reset), tracked by a small piece of
    state (see schema below) so restarting the app doesn't re-fire it.
- A `notificationsEnabled` respecting toggle — reuse the existing
  app-level setting rather than adding a new one, since it's already the
  single kill switch for all notifications.

**Out of scope for v1:**
- Per-task budgets (`Task.estimatedMinutes` exists but is not part of this
  alert system — could be a natural follow-up using the same mechanism).
- Editable/custom alert thresholds — fixed at 80%/100% for v1.
- Any automatic action on threshold crossing (e.g. auto-pausing the timer)
  — purely informational.

## 4. Architecture fit

### Schema (new migration `0002_budget_alerts.sql`, or combined with
whichever other feature's migration lands first)

Track which thresholds have already fired, so alerts survive app restarts
without re-notifying:

```sql
CREATE TABLE budget_alert_state (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'weekly_target' | 'budget_80' | 'budget_100'
  period_key TEXT NOT NULL, -- ISO week (e.g. '2026-W37') for weekly_target, 'total' for budget_*
  fired_at TEXT NOT NULL,
  PRIMARY KEY (project_id, alert_type, period_key)
);
```

### `ReportService` addition

A `checkBudgetAlerts(reference: Date): BudgetAlertEvent[]` method that,
given all active projects, computes current percentages (reusing
`getProjectStats` logic) and diffs against `budget_alert_state`, inserting
new rows and returning newly-crossed alerts for the caller to notify on.

### Where it runs

Piggyback on the existing periodic tick the app already has for the tray
label refresh (`setInterval(() => rebuildTrayMenu(context), 30_000)` in
`src/main/tray/tray.ts`) or a similar lightweight interval in
`main/index.ts` — call `checkBudgetAlerts` there and pipe results into
`NotificationService.send(...)`. No new polling infrastructure needed.

### Renderer

- `ProjectDetailPage.vue`: swap the local `weekProgress` computed for
  `stats.week.goalPercentage` and add the budget bar for
  `stats.budgetPercentage`, with the warning/error color thresholds.
- No new IPC needed for the alert *display* — the existing
  `projects.getStats` call already returns both numbers. Only the
  *notification-firing* logic needs the new backend piece.

## 5. Open questions

1. Should crossing back under a threshold (e.g. deleting a time entry
   after a budget alert fired) reset `budget_alert_state` so it can fire
   again if the budget is exceeded a second time? Simplest v1: no, once
   fired for a period/type it stays fired.
2. Does a paused/archived project still get checked? Probably not —
   `checkBudgetAlerts` should skip `isArchived` and maybe `paused` status
   projects.
3. Worth extending this same mechanism to `Task.estimatedMinutes` in the
   same pass, or keep this doc project-only and treat task-level budgets
   as a separate future iteration?
