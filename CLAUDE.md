# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

TimeTracker: a local-first, offline Electron desktop time-tracking app. No
account, no cloud, no server — everything persists in a SQLite database on
the user's machine. Stack: Electron, Vue 3 (Composition API, `<script
setup>`, strict TypeScript), Tailwind CSS + DaisyUI, Pinia, SQLite via
`better-sqlite3` + Drizzle ORM. Package manager is pnpm (required — do not
use npm/yarn).

`PROMPT.md` is the original (French) spec used to bootstrap the project via
an AI coding session; it documents original intent but is not kept in sync
with the code — prefer the code and `README.md`/`docs/` over it.

## Commands

```bash
pnpm install                # first install prompts to approve native build
                             # scripts (better-sqlite3, electron, electron-winstaller)
                             # — required, see pnpm-workspace.yaml allowBuilds

pnpm dev                    # electron-vite dev: Vite watch + Electron reload
pnpm seed                   # build + launch with ~6 months of demo data (dev only)

pnpm typecheck:node         # tsc --noEmit -p tsconfig.node.json (main/preload/shared)
pnpm typecheck:web          # vue-tsc --noEmit -p tsconfig.web.json (renderer)
pnpm typecheck              # both of the above
pnpm lint                   # eslint .

pnpm test                   # vitest run (once)
pnpm test:watch             # vitest watch mode
pnpm vitest run tests/unit/timer.service.spec.ts   # single file
pnpm vitest run -t "name"                          # single test by name

pnpm build                  # electron-vite build -> out/main, out/preload, out/renderer
pnpm run package:linux      # AppImage + deb (deb needs libxcrypt-compat on Fedora)
pnpm run package:win        # NSIS installer
pnpm run package:mac        # dmg
```

Always run `pnpm typecheck` and `pnpm lint` after non-trivial changes; CI (`.github/workflows/build-*.yml`) runs
typecheck + lint + test + package on
every push/PR to `main`.

## Architecture

```text
Electron Main Process
    ├── SQLite (better-sqlite3 + Drizzle)      src/main/db/
    ├── repositories/  (typed CRUD, one per entity)
    ├── services/      (TimerService, ReportService, BackupService,
    │                   IdleService, SuggestionService, SearchService,
    │                   NotificationService)
    ├── tray / global shortcuts / mini timer window
    └── ipc/registerHandlers.ts   (validated, typed IPC surface)
             │  contextBridge, contextIsolation: true, sandbox: true
             ▼
Electron Preload  (src/preload/index.ts — exposes window.desktop.*)
             ▼
Vue Renderer (src/renderer/src)
    ├── features/*    (dashboard, projects, tasks, timer, timeline,
    │                   timesheet, reports, settings, command-palette, search)
    ├── stores/*      (Pinia: timer, projects, tasks, tags, settings, ui)
    └── layouts/AppLayout.vue
```

The renderer **never** touches SQLite or Node APIs directly. `nodeIntegration`
is disabled and `contextIsolation`/`sandbox` are enabled; the preload script
exposes only a narrow, fully-typed `window.desktop` API (`src/shared/types/ipc.ts`) — never raw `ipcRenderer`, `fs`, or
`shell`. When
adding a new IPC operation: define the contract in `src/shared/types/ipc.ts`,
add a zod schema in `src/shared/validation/schemas.ts`, implement the handler
under `src/main/ipc/`, and expose it through the preload bridge — all four
pieces move together.

Path aliases: `@main/*`, `@preload/*`, `@shared/*` (see `tsconfig.node.json`)
in main/preload/shared code, and `@renderer/*`, `@shared/*` (see
`tsconfig.web.json`) in renderer code.

### The timer

`TimerService` (`src/main/services/timer.service.ts`) is the single source
of truth for all active timers in the app, backed by the `active_timer`
table — not renderer state:

- Elapsed time is always **derived from timestamps** (`startedAt`,
  `accumulatedPauseSeconds`, `pausedAt`) — never an incrementing counter —
  so it survives page navigation, app restarts, and sleep.
- `start()` creates an independent timer. Pause, resume, and stop operations
  target a timer ID and never alter the other active timers.
- Idle time and sleep gaps never silently disappear: `IdleService` detects
  them and the renderer prompts **Remove idle time / Keep idle time / Split
  session** before anything is changed.

### Database

- Engine: SQLite via `better-sqlite3`, queried through Drizzle ORM (`src/main/db/schema.ts`).
- Location: `app.getPath('userData')/timetracker.sqlite3` (on Linux,
  `~/.config/TimeTracker/...`; unpackaged dev builds use the `time-tracking`
  folder name from `package.json`'s `name`).
- Migrations: plain, versioned SQL files under `src/main/db/migrations/`,
  applied once each and tracked in a `_migrations` table (`src/main/db/migrator.ts`). **Never edit a shipped migration —
  add a new
  one.**
- Pragmas: WAL journal mode, foreign keys enforced, `synchronous = NORMAL`.
- Indexed columns: `tasks.project_id`, `time_entries.project_id`,
  `time_entries.task_id`, `time_entries.started_at`, `time_entries.ended_at`,
  `time_entry_tags.tag_id` — match any new dashboard/report query's
  filter/sort columns against these before adding a new index.

## Testing focus

Tests concentrate on logic where a bug would silently corrupt tracked time (`tests/unit/`, in-memory SQLite via
`tests/helpers/setupDb.ts`):
`TimerService` (start/stop/pause/resume/restore/idle resolution),
day-boundary and DST-safe time splitting (`src/shared/utils/time.ts`),
duration parsing/formatting (`src/shared/utils/duration.ts`), and report
aggregation (dashboard totals, heatmap splitting, grouping, weekly
timesheet).

## Documentation

- `docs/build-and-release.md` — packaging/CI/release state, what's not
  wired up yet (code signing, notarization, auto-update — no
  `electron-updater` dependency exists). `package.json`'s `repository` field
  has a placeholder owner that must be fixed before `release.yml` can
  publish.
- `docs/features/app-activity-tracking.md` — a **design-only, not
  implemented** doc for a possible future opt-in "focused app" tracker.
  Notably: not reliably possible on Linux/Wayland (this project's own dev
  environment), so any implementation must degrade gracefully rather than
  assume it works.

## Règles — CodeGraph (obligatoire)

@.claude/rules/codegraph.md
