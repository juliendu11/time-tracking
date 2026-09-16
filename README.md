# ⏱️ TimeTracker

**A local-first, offline desktop app for tracking time on your projects —
no account, no cloud, no subscription.**

Every second you track lives in a single SQLite file on your own machine.
Nothing is ever sent anywhere: no server, no telemetry, no sign-up screen
standing between you and starting a timer. Start it, work, stop it — your
data stays yours, readable, exportable, and backed up entirely offline.

Whether you're a freelancer who needs to know where the billable hours
went, a developer juggling a handful of side projects, or just someone who
wants an honest picture of how their days actually get spent, TimeTracker
gives you a fast timer, a real dashboard, and reports — without asking for
your email address first.

<p>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-2B2E3A?style=flat&logo=electron&logoColor=9FEAF9" />
  <img alt="Vue 3" src="https://img.shields.io/badge/Vue_3-35495E?style=flat&logo=vuedotjs&logoColor=4FC08D" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat&logo=typescript&logoColor=white" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-local--first-003B57?style=flat&logo=sqlite&logoColor=white" />
  <img alt="Tailwind + DaisyUI" src="https://img.shields.io/badge/Tailwind_CSS-DaisyUI-38BDF8?style=flat&logo=tailwindcss&logoColor=white" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-required-F69220?style=flat&logo=pnpm&logoColor=white" />
</p>

Built with Electron, Vue 3 (Composition API, `<script setup>`, strict
TypeScript), Tailwind CSS + DaisyUI, Pinia, and SQLite via `better-sqlite3` +
Drizzle ORM.

---

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Development](#development)
- [Database](#database)
- [Architecture](#architecture)
- [Build](#build)
- [Packaging](#packaging)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Data location](#data-location)
- [Backup & restore](#backup--restore)
- [What's implemented vs. roadmap](#whats-implemented-vs-roadmap)

---

## Features

### ⏱️ Timer & time tracking
- One-click start/stop/pause/resume, always derived from timestamps —
  never a counter that can drift or lose time across a restart or sleep.
- Start several independent timers at once, on different projects or tasks,
  or directly on a project without selecting a task.
- Pause, resume, and stop each active timer independently from the sidebar,
  tray, or mini-timer window.
- A dedicated **Timers** workspace lists every active timer and can launch
  another one for any project, with an optional task and description.
- **Idle & sleep detection**: if you step away or your machine sleeps
  while a timer runs, TimeTracker never silently keeps (or silently
  discards) that time — it asks you to **Remove**, **Keep**, or **Split**
  the session once you're back.
- Manual time entries for anything tracked after the fact, with automatic
  overlap detection against your existing entries.
- A **mini timer** window (always-on-top, optional) for keeping an eye on
  the clock without the full app in view.

### 📁 Projects & tasks
- Projects with color, icon, status, favorites, archiving, an optional
  hourly rate/currency, and both a **weekly hour target** and a **total
  budget** — with live progress tracking against both.
- Tasks with priority, status, favorites, and time estimates, filterable
  and sortable per project.
- Tags for cutting across projects however you actually think about your
  work.

### 📊 Dashboard & insights
- Today/this-week totals with week-over-week change.
- A 7-day chart, a 12-month contribution-style heatmap, a project
  distribution donut, and a top-tasks breakdown.
- A **Focus Score** — session length, interruptions, and goal completion
  distilled into one number, with a plain-language breakdown, not a
  black-box metric.
- Streaks, daily averages, longest session, most productive day/hour, and
  weekly consistency — all computed locally from your own history.

### 🧾 Timesheet & reports
- A weekly, spreadsheet-style **Timesheet** with inline duration editing
  (`2h30`, `1:30`, `90m` all parse the same way) and one-click "duplicate
  last week."
- A day-by-day **Timeline** agenda view.
- A flexible **Reports** page: group by project, task, day, week, month,
  or tag, over any preset or custom date range, with optional
  side-by-side comparison against the previous period.

### 🔍 Search & command palette
- `⌘/Ctrl + K` opens a command palette that searches projects, tasks, time
  entries, and tags at once, and surfaces **smart suggestions** — "probably
  what you want to start next" ranked from recency, frequency, your
  current project, your habitual time of day, and favorites. Fully local,
  transparent scoring — no ML, no external service.

### 🔔 Notifications & idle detection
- Desktop notifications for idle prompts and other timer events, with a
  one-click test notification in Settings.
- Configurable idle threshold; idle decisions apply consistently to every
  timer that was running during the absence.

### 🖥️ Desktop integration
- A system **tray** icon showing the live timers and quick access to
  recent tasks — start/stop/pause without opening the window.
- A **global keyboard shortcut** (configurable) to start/stop the
  last-used timer from anywhere, even while the app isn't focused.

### 💾 Data & privacy
- Everything lives in one local SQLite database — no account, no cloud
  sync, nothing leaves your machine.
- Automatic backups on a daily/weekly schedule (with pruning), plus manual
  backup, restore (with an automatic safety backup first), and JSON/CSV
  export whenever you want a copy in your own hands.

### 🎨 Customization
- Theme (light/dark/system), language, week start day, 12h/24h time,
  and date format.
- Per-behavior toggles for idle detection, quick-switch behavior, launch
  at startup, minimize to tray, and more — all in a dedicated Settings
  page, not buried in a config file.

---

## Requirements

- Node.js 20+ (tested with Node 24)
- [pnpm](https://pnpm.io) 9+

## Installation

```bash
pnpm install
```

On first install, pnpm will ask to approve native build scripts for
`better-sqlite3`, `electron` and `electron-winstaller` (see
`pnpm-workspace.yaml` → `allowBuilds`). These are required — `better-sqlite3`
ships prebuilt N-API binaries, `electron` downloads its runtime binary, and
`electron-winstaller` prepares the Windows installer tooling.

## Development

```bash
pnpm dev
```

Starts Vite in watch mode for the renderer and relaunches Electron on main
process changes.

To start with ~6 months of realistic demo data (dev only, never bundled into
a production build):

```bash
pnpm seed
```

## Database

- Engine: SQLite via `better-sqlite3`, queried through Drizzle ORM
  (`src/main/db/schema.ts`).
- Location: `app.getPath('userData')/timetracker.sqlite3` — on Linux that's
  `~/.config/TimeTracker/timetracker.sqlite3` (unpackaged dev builds use the
  `time-tracking` folder name, matching `package.json`'s `name`).
- Migrations: plain, versioned SQL files under `src/main/db/migrations/`,
  applied once each and tracked in a `_migrations` table
  (`src/main/db/migrator.ts`). Never edit a shipped migration — add a new one.
- Pragmas: WAL journal mode, foreign keys enforced, `synchronous = NORMAL`.
- Indexes: on `tasks.project_id`, `time_entries.project_id`,
  `time_entries.task_id`, `time_entries.started_at`, `time_entries.ended_at`,
  and `time_entry_tags.tag_id` — the columns every dashboard/report query
  filters or sorts by.

## Architecture

```text
Electron Main Process
    ├── SQLite (better-sqlite3 + Drizzle)
    ├── repositories/        (typed CRUD, one per entity)
    ├── services/             (TimerService, ReportService, BackupService,
    │                          IdleService, SuggestionService, SearchService,
    │                          NotificationService)
    ├── tray / global shortcuts / mini timer window
    └── ipc/registerHandlers.ts   (validated, typed IPC surface)
             │  contextBridge, contextIsolation: true, sandbox: true
             ▼
Electron Preload  (src/preload/index.ts — exposes window.desktop.*)
             ▼
Vue Renderer
    ├── features/*    (dashboard, projects, tasks, timer, timeline,
    │                   timesheet, reports, settings, command-palette)
    ├── stores/*      (Pinia: timer, projects, tasks, tags, settings, ui)
    └── layouts/AppLayout.vue
```

The renderer never touches SQLite or Node APIs directly. `nodeIntegration`
is disabled, `contextIsolation` and `sandbox` are enabled, and the preload
script exposes only a narrow, fully-typed `window.desktop` API
(`src/shared/types/ipc.ts`) — never raw `ipcRenderer`, `fs`, or `shell`.

### The timer

`TimerService` (`src/main/services/timer.service.ts`) is the single source
of truth for all active timers in the app. They are backed by the
`active_timer` table, not renderer state:

- Elapsed time is always **derived from timestamps** (`startedAt`,
  `accumulatedPauseSeconds`, `pausedAt`) — never from an incrementing
  counter — so it survives page navigation, app restarts, and sleep.
- `start()` inserts an independent timer without changing timers that are
  already active; pause, resume, and stop operations target a timer ID.
- Idle time and sleep gaps never silently disappear: `IdleService` detects
  them and the renderer prompts **Remove idle time / Keep idle time / Split
  session** before anything is changed.

## Build

```bash
pnpm build
```

Runs `electron-vite build`, producing `out/main`, `out/preload`, and
`out/renderer`.

## Packaging

```bash
pnpm run package:linux   # AppImage + deb
pnpm run package:win     # NSIS installer
pnpm run package:mac     # dmg
pnpm run package         # current platform
```

Uses `electron-builder` (config in `electron-builder.yml`). App icons live
in `build/` (Windows `.ico`, generic `.png`) and are auto-converted for
macOS `.icns`. Tray icons and the window icon ship in `resources/` and are
copied into the packaged app via `extraResources`.

> **Note:** building a `.deb` requires the bundled `fpm` tool, which needs
> `libcrypt.so.1`. Recent Fedora hosts that only ship `libcrypt.so.2` need
> `libxcrypt-compat` installed to produce `.deb` packages; AppImage building
> has no such dependency and works out of the box.

## Testing

```bash
pnpm test        # vitest run, once
pnpm test:watch  # vitest, watch mode
```

Tests are concentrated on the logic where a bug would silently corrupt
tracked time: `TimerService` (start/stop/pause/resume/restore/idle
resolution), day-boundary and DST-safe time splitting
(`src/shared/utils/time.ts`), duration parsing/formatting, and report
aggregation (dashboard totals, heatmap splitting, grouping, weekly
timesheet).

## Project structure

```text
src/
  main/            Electron main process
    db/            schema, migrations, migrator, client
    repositories/   ProjectRepository, TaskRepository, TimeEntryRepository, …
    services/        TimerService, ReportService, BackupService, IdleService, …
    ipc/            typed IPC handler registration
    windows/        main window, mini timer window
    tray/           system tray menu
    shortcuts/      global shortcut registration
  preload/          contextBridge-exposed window.desktop API
  renderer/
    src/
      features/     one folder per feature (dashboard, projects, timer, …)
      stores/        Pinia stores, organised by domain
      layouts/        AppLayout.vue (sidebar + content)
      router/
  shared/
    types/          domain.ts (entities), ipc.ts (IPC contract)
    utils/           time.ts, duration.ts — pure, tested functions
    validation/      zod schemas for every IPC input
tests/
  unit/             vitest specs
  helpers/          in-memory SQLite test environment
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + K` | Command Palette |
| `⌘/Ctrl + P` | Quick switcher (opens the same palette) |
| `Esc` | Close the active overlay |
| `CommandOrControl+Shift+Space` (global, configurable in Settings) | Start/stop the last-used timer, even when the app isn't focused |

## Data location

- Database: `<userData>/timetracker.sqlite3`
- Backups: `<userData>/backups/`
- Exports (CSV/JSON): `<userData>/exports/`
- Logs: `<userData>/logs/app.log` (rotated at 5MB)

Find `<userData>` from **Settings → Advanced → Open logs folder**, or
**Settings → Backup & Data → Open backup folder**.

## Backup & restore

Automatic backups run on a configurable daily/weekly schedule (Settings →
Backup & Data), pruned to a configurable count. Manual backup, JSON/CSV
export, and restore (with an automatic safety backup taken before
overwriting) are all available from the same screen.

## What's implemented vs. roadmap

Implemented and real (not mocked): project/task CRUD with archiving and
favorites, the full timer lifecycle including idle/sleep handling, manual
time entries with overlap detection, dashboard (today/week, 7-day chart,
12-month heatmap, project distribution, top tasks, streaks, focus score),
Timeline, weekly Timesheet with flexible duration parsing, Reports with
grouping and period comparison, Command Palette with smart suggestions,
global shortcut, system tray, mini timer window, idle detection, desktop
notifications, JSON/CSV export, and automatic/manual backup with restore.

Kept explicitly out of this pass rather than faked: code-signing for
packaged installers, an auto-update server, and a Pomodoro *notification*
flow (the settings exist and are wired for a future timer/notification
integration, but the countdown UI itself isn't built).

Design docs for a longer list of possible future features — invoicing &
billable time, scoped CSV/PDF/iCal exports, project budget alerts, a real
Pomodoro engine, recurring tasks, a calendar view, expanded global
shortcuts, a CLI companion, a "Wrapped"-style annual recap, a flex-time
balance ledger, end-of-day gap review, and splitting a tracked block across
projects — live under [`docs/features/`](docs/features/), each covering
current state, proposed scope, and architecture fit before any of it is
built.
