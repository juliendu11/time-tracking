# Pomodoro Mode (future feature)

Status: **not implemented — settings scaffolding only**, written 2026-09-12.

## 1. What this is

A focus/break timer cycle (classic Pomodoro: N minutes focus → short break,
repeating, with a longer break every 4 cycles) layered on top of the
existing project/task timer, with break reminders via the app's existing
notification system. Value: users who want structured work sessions rather
than open-ended tracking, and a built-in nudge to actually take breaks
(complementing `IdleService`, which detects *unintentional* inactivity but
does nothing to *encourage* intentional rest).

## 2. Current state in the codebase

Grepping the codebase for `pomodoro` turns up exactly four hits, all
scaffolding with no runtime behavior behind them:

- `src/main/db/migrations/0001_init.sql` / `src/main/db/schema.ts` — four
  columns on `app_settings`: `pomodoro_enabled` (default `false`),
  `pomodoro_focus_minutes` (default 25), `pomodoro_break_minutes` (default
  5), `pomodoro_long_break_minutes` (default 15).
- `src/shared/types/domain.ts` — the matching four fields on `AppSettings`.
- `src/shared/validation/schemas.ts` — zod validation for the same four
  fields.
- `src/main/repositories/settings.repository.ts` — plain read/write of the
  same four fields, no logic.
- `SettingsPage.vue` exposes **only** the `pomodoroEnabled` checkbox
  ("Enable Pomodoro"); the three minute fields have no form inputs yet.

There is **no `PomodoroService`, no state machine, no timer, no
notification tied to any of this** — enabling the checkbox today changes a
stored boolean and nothing else happens anywhere in the app. This is a
clean, well-scoped gap: the data model is already right, only the engine
and UI are missing.

## 3. Proposed scope for v1

**In scope:**
- A `PomodoroService` in the main process (`src/main/services/pomodoro.service.ts`),
  structured like `TimerService`/`IdleService` — timestamp-derived state,
  not a ticking counter, so it survives navigation/sleep the same way the
  main timer does.
- Phases: `focus` → `break` → `focus` → `break` → `focus` → `break` →
  `focus` → `long_break`, cycling (every 4th break is long), using the
  three existing duration settings.
- Coupling to the real timer, kept loose: starting a Pomodoro session does
  **not** require an active project timer (some users just want the
  interval bell); if a project timer *is* running when a focus phase ends,
  fire a break notification but don't force-pause the timer — that's the
  user's call, matching this app's existing "never silently mutate tracked
  time" philosophy (`TimerService`'s idle-handling docstring already states
  this principle for idle time; extend the same posture here).
- Notifications via the existing `NotificationService` at each phase
  transition ("Focus session done — take a 5 minute break." / "Break's
  over — back to it.").
- Settings UI: add the three missing minute inputs (focus/short break/long
  break) next to the existing "Enable Pomodoro" checkbox.
- A small persistent indicator while a session is active — reuse the
  existing mini-timer window / tray label pattern (`rebuildTrayMenu` in
  `src/main/tray/tray.ts` already rebuilds on `timer.on('changed')`; add an
  equivalent `pomodoro.on('changed')` hook) showing current phase +
  remaining time.
- A simple start/stop control in the renderer (e.g. next to the main timer
  controls, or its own small widget) — "Start Pomodoro" / "Stop Pomodoro."

**Out of scope for v1:**
- Auto-pausing or auto-stopping the actual `TimeEntry` timer on phase
  change — notification only, per the coupling note above.
- Per-project or per-task Pomodoro settings — one global configuration,
  matching how the four settings fields are already modeled (on
  `AppSettings`, not `Project`).
- Session history/stats (e.g. "12 pomodoros today") — could be a natural
  follow-up once the engine exists and the dashboard's `AdditionalMetrics`
  pattern could absorb it, but adds a new table for v1 with no immediate
  ask.
- Sound customization — reuse whatever sound `NotificationService`/OS
  notifications already use.

## 4. Architecture fit

No schema changes needed — `AppSettings` already has everything the engine
reads. If session history is added later, that would need its own table
(`pomodoro_sessions`), but v1 as scoped above is stateless beyond "is a
session currently running and in which phase," which fits the same
single-row pattern as `active_timer`:

```sql
-- only needed if the running session must survive an app restart;
-- otherwise this can be pure in-memory state in PomodoroService, restarted
-- fresh on launch (simpler — recommended default for v1)
```

Recommendation: keep it in-memory only for v1 (like `IdleService`'s
transient state), not persisted — restarting the app mid-Pomodoro simply
resets it, which is an acceptable simplification given no other part of
the app persists purely-informational transient timers either.

### New service: `PomodoroService` (`src/main/services/pomodoro.service.ts`)

```ts
type PomodoroPhase = 'focus' | 'break' | 'long_break'
interface PomodoroSnapshot {
  phase: PomodoroPhase
  phaseStartedAt: string
  phaseDurationSeconds: number
  cycleCount: number // completed focus phases, for long-break cadence
}

class PomodoroService extends EventEmitter {
  start(): PomodoroSnapshot
  stop(): void
  skip(): PomodoroSnapshot // manually advance to next phase
  getSnapshot(): PomodoroSnapshot | null
  // internally: a single setTimeout scheduled to the phase's end,
  // rescheduled on start/skip; emits 'changed' and calls
  // NotificationService on each transition
}
```

### IPC surface

New `pomodoro` namespace on `DesktopApi`:
```ts
pomodoro: {
  start(): Promise<PomodoroSnapshot>
  stop(): Promise<void>
  skip(): Promise<PomodoroSnapshot>
  getSnapshot(): Promise<PomodoroSnapshot | null>
  onChanged(callback: (snapshot: PomodoroSnapshot | null) => void): () => void
}
```
Following the same subscribe-over-IPC pattern the timer already uses for
live updates to the renderer.

### Renderer

- `SettingsPage.vue` → Timer tab: three new number inputs for the minute
  settings, shown only when `pomodoroEnabled` is checked.
- A small `PomodoroWidget.vue` (near the main timer controls or in the
  sidebar) showing phase + remaining time + start/stop/skip.
- `src/main/tray/tray.ts`: extend `rebuildTrayMenu` to show the Pomodoro
  phase alongside the existing timer status when a session is active.

## 5. Open questions

1. Should a Pomodoro session require `pomodoroEnabled` to be toggled first
   in Settings, or should "Start Pomodoro" be available any time (with the
   settings toggle only controlling some other default behavior, e.g.
   auto-start on app launch)? Given the checkbox is literally named "Enable
   Pomodoro," gating the whole feature behind it is the more intuitive
   reading.
2. Multiple monitors/mini-timer window: should the mini timer window (already
   supports `showMiniTimer`/`miniTimerAlwaysOnTop`) grow a Pomodoro-phase
   display, or stay timer-only with Pomodoro status only in the tray?
3. Is there any desire to auto-start the next phase's countdown
   automatically, vs. requiring a manual "I'm ready, start focus" click
   after a break — classic Pomodoro apps differ on this and it changes the
   `PomodoroService` phase-transition logic (auto-chain vs.
   pause-between-phases).
