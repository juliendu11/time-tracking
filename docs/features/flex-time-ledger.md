# Flex-Time Ledger (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

A rolling, carried-over balance of hours worked vs. hours targeted — "+2h
15m this month" or "-45m this week" — instead of the current all-or-nothing
weekly percentage. Value: for anyone on a flexible schedule (contractors
billing a monthly retainer, employees with *horaires flexibles*, anyone who
works 50h one week and 30h the next by design), a percentage-of-this-week
resets to zero every Monday and throws away the fact that last week's
overage should count for something. A running balance is the metric that
actually matches how flexible-time arrangements are reasoned about.

## 2. Current state in the codebase

Two independent, **non-cumulative** goal mechanisms already exist, and
this feature deliberately doesn't touch either — it adds a third,
complementary view:

- `Project.weeklyTargetMinutes` → `ReportService.getProjectStats()` already
  computes `goalPercentage = weekSeconds / weeklyTargetMinutes` **for the
  current week only**. Nothing carries forward; hitting 130% this week has
  no effect on next week's starting point.
- `AppSettings.dailyGoalMinutes` / `weeklyGoalMinutes` (app-level, not
  per-project) feed `getDashboardSummary` and the Focus Score's "goal
  reached" boolean — again a same-period yes/no, not a running total.
- There is no persisted "balance" or "carry-over" concept anywhere in the
  schema. This is legitimately new state, not a UI layer over existing
  numbers (unlike most of the other docs in this folder).

## 3. Proposed scope for v1

**In scope:**
- Scope the ledger to the **app-level weekly goal**
  (`AppSettings.weeklyGoalMinutes`) rather than per-project targets — a
  flex-time arrangement is almost always about total hours worked, not
  hours on one specific project, so this avoids needing N separate ledgers.
- Compute the balance **on the fly from history**, not as an
  incrementally-updated stored counter (consistent with how the rest of
  the app treats time as derived from timestamps, never accumulated
  step-by-step): for each ISO week from a user-chosen **ledger start date**
  up to now, `balance += (actualWeekSeconds - weeklyGoalMinutes * 60)`.
  Recomputing from scratch is cheap (`time_entries.started_at` is already
  indexed) and means editing a past entry automatically corrects the
  balance with no special-case sync logic.
- A `ledgerStartDate` setting — the balance only exists from a point the
  user opts in from (not retroactively from account creation), so enabling
  the feature doesn't dump a confusing multi-year balance on someone who
  never intended to track flex-time before now.
- A prominent "Balance: +3h 20m" display on the Dashboard (near the
  existing weekly summary in `DashboardHeader.vue`), color-coded
  (positive/near-zero/negative), plus a small trend view — balance per
  week for, say, the last 12 weeks, as a simple bar chart reusing the
  visual language of `LastSevenDaysChart.vue`.
- Respect `weeklyGoalMinutes` changes going forward only — if the user
  edits their weekly goal, past weeks keep using whatever the goal *was
  intended to be* is actually unknowable today (no history is kept — see
  open questions), so v1 pragmatically applies the **current** goal value
  across the whole ledger window and documents that limitation clearly in
  the UI (a tooltip: "calculated using your current weekly goal").

**Out of scope for v1:**
- Per-project flex ledgers — app-level only (see scoping decision above).
- Historical goal tracking (a `weekly_goal_history` table recording every
  change with effective dates) — would make the balance fully accurate
  across goal changes, but is meaningfully more schema/logic for a v1;
  flagged as the natural v2 if the "uses current goal retroactively"
  simplification proves confusing in practice.
- Any notion of "paying out" or resetting the balance manually — it's a
  read-only computed number, not an editable ledger entry system.

## 4. Architecture fit

### Schema

Only one new setting, no new table for v1 (balance is always recomputed,
never stored):

```sql
ALTER TABLE app_settings ADD COLUMN flex_ledger_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN flex_ledger_start_date TEXT;
```

### `AppSettings` additions

```ts
flexLedgerEnabled: boolean
flexLedgerStartDate: string | null // ISO date, set when the user enables the feature
```

### `ReportService` addition

```ts
export interface FlexLedgerWeek {
  weekStart: string
  actualSeconds: number
  targetSeconds: number
  deltaSeconds: number // actual - target, can be negative
}
export interface FlexLedger {
  balanceSeconds: number // sum of all deltaSeconds since flexLedgerStartDate
  weeks: FlexLedgerWeek[] // most recent N weeks, for the trend chart
}

getFlexLedger(reference: Date, startDate: Date, weeklyGoalMinutes: number): FlexLedger {
  // walk each ISO week from startDate to reference using the same
  // getLocalWeekRange/weekStartsOn machinery getDashboardSummary already uses,
  // summing totalSecondsBetween(weekStart, weekEnd) - weeklyGoalMinutes * 60
}
```

Reuses `getLocalWeekRange` and the existing `totalSecondsBetween` private
helper already in `ReportService` — no new date-math needed beyond what
`src/shared/utils/time.ts` already provides.

### IPC surface

```ts
reports: {
  getFlexLedger(referenceIso: string): Promise<FlexLedger | null> // null if !flexLedgerEnabled
}
settings: {
  enableFlexLedger(startDateIso: string): Promise<AppSettings>
  disableFlexLedger(): Promise<AppSettings>
}
```

### Renderer

- Settings → Goals tab: a "Flex-time balance" toggle + date picker for the
  start date (defaults to today when first enabled).
- `DashboardHeader.vue` or a new small `FlexBalanceCard.vue` next to the
  existing summary, shown only when `flexLedgerEnabled`.
- A trend bar chart component, styled consistently with
  `LastSevenDaysChart.vue` (over/under bars instead of absolute totals,
  diverging from a zero baseline).

## 5. Open questions

1. Is app-level-only (vs. also offering it per-project) the right initial
   scope, or do enough users actually think in terms of "flex balance per
   client contract" that per-project deserves to be v1 instead? Leaning
   app-level based on how flex-time arrangements are typically framed
   (total hours, not per-client), but worth validating against actual
   user requests.
2. How should the balance handle weeks with **zero** tracked activity
   (vacation, sick days) — counted as a full negative delta against the
   target like any other week (the strict interpretation), or does the app
   need some notion of "excluded weeks" (time off) to avoid unfairly
   tanking the balance? This is the crux of whether v1's simple
   sum-of-deltas is actually good enough, or needs a "mark this week as
   time off" escape hatch.
3. Worth revisiting the "use current goal retroactively" simplification
   once real usage shows whether goal changes are rare (simplification is
   fine) or common (the historical-goal-tracking v2 becomes worth doing
   sooner).
