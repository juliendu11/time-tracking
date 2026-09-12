# TimeTracker

A local-first, offline desktop time tracking application. No account, no
cloud, no server — everything lives in a SQLite database on your machine.

Built with Electron, Vue 3 (Composition API, `<script setup>`, strict
TypeScript), Tailwind CSS + DaisyUI, Pinia, and SQLite via `better-sqlite3` +
Drizzle ORM.

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
of truth for the one active timer in the whole app. It's backed by a
single-row `active_timer` table, not renderer state:

- Elapsed time is always **derived from timestamps** (`startedAt`,
  `accumulatedPauseSeconds`, `pausedAt`) — never from an incrementing
  counter — so it survives page navigation, app restarts, and sleep.
- `start()` atomically stops any running timer (inside one SQLite
  transaction) before starting the new one.
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
tracked time: `TimerService` (start/stop/switch/pause/resume/restore/idle
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
