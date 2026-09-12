# App Activity Tracking (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

An **opt-in, informational** feature that records which application (and
optionally window title) has OS focus over time, so the user can see things
like:

```text
Today

VS Code        3h12
Chrome         1h40
Slack          0h28
```

This is explicitly **not** the same thing as the project/task timer. It does
not start/stop/pause, it does not create `TimeEntry` rows, and it never
auto-assigns tracked time to a project or task. It is a parallel, passive
signal shown next to the real tracked time so the user can answer "where did
my untracked time actually go?" — nothing more. Scope creep into
auto-categorization, productivity scoring, or website-level tracking inside
the browser is explicitly out of scope for v1.

## 2. Is it possible?

Yes, but only through a native OS integration — Electron has no cross-platform
API for "what application is currently focused" (it only knows about its own
windows). The standard approach is to poll the OS on an interval (~2–5s) using
a small native/OS-shell helper, most commonly via the
[`active-win`](https://github.com/sindresorhus/active-win) package, which
wraps:

- **Windows** — Win32 `GetForegroundWindow` / `GetWindowText` via a bundled
  native binary. Reliable.
- **macOS** — Accessibility APIs via a bundled Swift binary. Reliable, but
  requires the user to grant **Accessibility** (and, for window titles,
  **Screen Recording**) permission in System Settings the first time.
- **Linux (X11)** — shells out to `xdotool`/`xprop`/`wmctrl`-equivalent
  queries. Reliable when those tools (or the equivalent library) are present.
- **Linux (Wayland)** — **not reliably possible.** Wayland's security model
  deliberately does not expose "which window/app is focused" to arbitrary
  clients. There is no standard `xdg-desktop-portal` portal for this yet, so
  on GNOME/KDE Wayland sessions the feature will not work at all with
  `active-win` or equivalent tools as of writing. This is the biggest
  limitation and directly affects this project's own dev environment.

## 3. Limitations to design around

1. **Wayland is a dead end for now.** The feature must degrade gracefully:
   detect at startup whether focus polling actually works (first poll
   succeeds vs. throws/returns nothing) and disable itself with a clear
   message in Settings rather than silently doing nothing or erroring.
2. **macOS permission friction.** First run must explain *why* the
   permission is requested before the OS prompt appears (an OS permission
   dialog with no context reads as suspicious). If denied, same graceful
   degradation as above, with a link to re-enable it in System Settings.
3. **Native dependency in packaging.** `active-win`'s per-platform binaries
   must be unpacked from `asar` (`asarUnpack` in `electron-builder.yml`,
   already used for `**/*.node` — extend the pattern) or the bundled
   executables won't run.
4. **Privacy.** This is meaningfully more sensitive than manual time
   tracking: it can reveal window *titles* (which can contain document
   names, URLs, email subjects, etc.), not just app names. Design decisions
   below (§6) treat this as the default-off, most-sensitive feature in the
   app.
5. **Performance/battery.** Polling must be lightweight and pause entirely
   when idle detection already says the user is away (no point polling an
   idle screen), and pause while the main window itself doesn't need it
   (there's no reason to *not* poll in the background — the whole point is
   background tracking — but the poll interval should stay coarse, 2–5s,
   not sub-second).

## 4. Proposed scope for v1

**In scope:**
- Track focused **application name** only, not window title, by default.
- A single new Settings toggle, off by default: `appActivityEnabled`.
- A second, dependent toggle: `appActivityTrackWindowTitles` (off by
  default, only meaningful if the first is on) — window titles are opt-in
  on top of opt-in.
- A simple new Dashboard widget / Settings sub-page: "App Activity" list for
  the selected day, sorted by duration, app name + total time.
- A "Clear app activity data" action in Settings (separate from clearing
  real tracked time, since it's a different kind of data with different
  sensitivity).
- Automatic platform capability check; feature hidden/disabled with an
  explanation if the OS doesn't support it (Wayland, denied macOS
  permission).

**Out of scope for v1** (explicitly, so a future pass doesn't scope-creep):
- Per-website tracking inside browsers.
- Auto-suggesting or auto-assigning a project/task based on the focused app.
- Any cross-referencing with the Focus Score or productivity metrics.
- Syncing/exporting this data alongside the regular backup/export (it should
  get its *own* export/clear controls, kept clearly separate from the
  time-tracking data that is the core of the app).

## 5. Architecture fit

Follows the same layering as the rest of the app (`src/main/{db,
repositories, services, ipc}`):

### Schema (new migration `000X_app_activity.sql`)

```sql
CREATE TABLE app_activity_sessions (
  id TEXT PRIMARY KEY,
  app_name TEXT NOT NULL,
  window_title TEXT,              -- NULL unless trackWindowTitles is on
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_app_activity_started_at ON app_activity_sessions(started_at);
CREATE INDEX idx_app_activity_app_name ON app_activity_sessions(app_name);
```

Kept in its own table, never joined against `time_entries` — reinforces that
this is a separate, parallel dataset.

### `AppSettings` additions (`src/shared/types/domain.ts`)

```ts
appActivityEnabled: boolean
appActivityTrackWindowTitles: boolean
appActivityPollSeconds: number // default 5, min 2
```

### New service: `AppActivityService` (`src/main/services/appActivity.service.ts`)

- Wraps `active-win` (or equivalent) behind an interface so the "not
  supported on this platform" path is a first-class return value, not an
  exception:
  ```ts
  interface FocusProbe {
    isSupported(): Promise<boolean>
    getFocusedApp(): Promise<{ appName: string; windowTitle: string | null } | null>
  }
  ```
- Polls on `appActivityPollSeconds`, pauses while `IdleService` reports the
  user idle or the settings toggle is off.
- Coalesces consecutive polls for the same app into one open session row
  (same pattern as `TimerService`: an "open" session with `endedAt = null`
  gets closed and a new one opened when the focused app changes), closing
  the open row on app quit.

### Repository: `AppActivityRepository`

Standard CRUD + `listInRange`/`aggregateByApp(start, end)`, mirroring
`TimeEntryRepository`'s query shape.

### IPC surface

New `appActivity` namespace on `DesktopApi`
(`src/shared/types/ipc.ts` + `src/preload/index.ts` + a new
`src/main/ipc/handlers` entry), e.g.:

```ts
appActivity: {
  isSupported(): Promise<boolean>
  getSummary(startDate: string, endDate: string): Promise<AppActivitySummary[]>
  clearAll(): Promise<void>
}
```

### Renderer

- `Settings → Advanced` (or a new "Privacy" tab) gets the two toggles + the
  platform-support notice + "Clear app activity data".
- A small `features/dashboard/components/AppActivityList.vue` widget,
  rendered only when `appActivityEnabled && isSupported`.

## 6. Privacy defaults (non-negotiable for v1)

- Off by default, two-level opt-in (app names, then separately window
  titles).
- 100% local — already true for the whole app, but worth stating explicitly
  here since this data type is the one most likely to get a "should this
  sync somewhere" question later. It should not be included in the regular
  JSON/CSV export or Full Backup by default; a separate, explicit export
  action if ever needed.
- A visible, permanent indicator in the UI while this is enabled (not just a
  buried settings toggle) — e.g. a small icon in the sidebar or tray — so it
  is never running silently without the user being able to tell at a
  glance.

## 7. Open questions for whoever implements this

1. Do we want a day/app granularity only, or also an hour-of-day breakdown
   (reusing the existing heatmap/hour-bucket patterns from
   `ReportService`)?
2. Should `active-win` be the actual dependency, or a thinner
   platform-specific implementation to reduce the native-binary footprint
   (the app currently only has one native dependency, `better-sqlite3`,
   which is N-API/prebuild-based and adds no packaging complexity — a
   second native dependency with per-platform shelled-out binaries is a
   bigger packaging commitment and should be a deliberate choice)?
3. Retention: keep forever like time entries, or auto-prune app activity
   data after N days by default, given it's a lower-stakes/higher-volume
   dataset than actual tracked work time?
