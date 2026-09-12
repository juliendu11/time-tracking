# CLI Companion (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

A small command-line tool (`tt start "Client X"`, `tt stop`, `tt status`,
`tt switch "Landing page"`) that controls the *same* running timer as the
Electron app, for users who live in a terminal and don't want to
alt-tab/click into a GUI window just to start or stop tracking. Given this
app's own users are developers (per the project's own tooling — pnpm,
strict TS, Electron), this is a natural power-user affordance rather than a
niche one.

## 2. Current state in the codebase

`TimerService` (`src/main/services/timer.service.ts`) is already the
single, well-isolated source of truth for the one active timer — it lives
entirely inside the Electron main process, addressed only via
`AppContext` (`src/main/context.ts`) and exposed to the renderer exclusively
through the typed IPC bridge (`src/preload/index.ts` → `window.desktop.timer.*`).
There is currently **no channel into the main process from outside
Electron's own IPC** — no socket, no named pipe, no HTTP listener anywhere
in `src/main/`. A CLI companion needs exactly one new thing: a second,
narrow entry point into `AppContext.timer`/`.timeEntries`/`.projects` that
doesn't go through `ipcMain`/`contextBridge` (those are Electron-internal,
not reachable from a separate OS process).

## 3. Proposed scope for v1

**In scope:**
- A local **Unix domain socket** (macOS/Linux) / **named pipe** (Windows)
  opened by the main process at startup, at a fixed path under
  `app.getPath('userData')` (e.g. `timetracker.sock`) — not a TCP port, to
  avoid any network exposure or firewall prompts; this is strictly
  local-machine, single-user IPC, consistent with the app's "no server, no
  network" positioning.
- A tiny JSON-line protocol: one JSON object per line in, one JSON object
  per line out (`{ "cmd": "start", "project": "Client X" }` →
  `{ "ok": true, "snapshot": {...} }`), simple enough to implement with
  Node's built-in `net` module — no new runtime dependency for the
  transport itself.
- A minimal, dependency-light CLI binary (`tt`) — a standalone Node script
  that connects to the socket, sends one command, prints the response, and
  exits. Commands for v1:
  - `tt start <project> [--task <task>]` — resolves by name (fuzzy/prefix
    match against active projects, same matching spirit as the existing
    command palette's project search).
  - `tt stop`
  - `tt pause` / `tt resume`
  - `tt switch <project|task>`
  - `tt status` — prints current project/task + elapsed time (or "No timer
    running").
  - `tt today` — prints today's total, reusing
    `reports.getDashboardSummary`.
- Clear failure mode when the app isn't running: the socket file won't
  exist, so the CLI should fail fast with "TimeTracker isn't running —
  start the app first," not hang or crash.
- Feature-gated behind a settings toggle (`enableCliCompanion`, default
  off) so the socket isn't created for users who never asked for it — matches the app's existing pattern of opt-in surface area (idle
  detection, auto-backup, etc. are all toggleable).

**Out of scope for v1:**
- Launching/keeping the Electron app alive from the CLI if it isn't
  running (no daemon-mode split from the GUI) — the CLI is a remote control
  for an already-running app, not a replacement for it.
- Any command that mutates historical data (editing/deleting past entries,
  generating reports) — v1 is start/stop/status only, the highest-value
  and lowest-risk slice.
- Shell completion, packaging as a global npm binary, or cross-compiling —
  ship as a script in the app's resources first; polish distribution once
  the core loop is validated as useful.
- Windows named-pipe support in the very first cut, if it turns out to add
  meaningfully more complexity than the Unix socket path — could ship
  macOS/Linux first and follow up (see open questions).

## 4. Architecture fit

No schema or domain-type changes needed — the CLI is a second transport
for capabilities that already exist end-to-end.

### New: `src/main/cli/cliServer.ts`

```ts
import { createServer } from 'net'
import type { AppContext } from '@main/context'

export function startCliServer(context: AppContext, socketPath: string): void {
  const server = createServer((socket) => {
    let buffer = ''
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      let newlineIndex: number
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)
        socket.write(JSON.stringify(handleCommand(context, JSON.parse(line))) + '\n')
      }
    })
  })
  server.listen(socketPath)
}

function handleCommand(context: AppContext, message: { cmd: string; [key: string]: unknown }): object {
  // dispatch to context.timer.start/stop/pause/resume/switchProject/switchTask,
  // wrapping the same validation/error types (ValidationError, NotFoundError)
  // TimerService already throws, formatted into { ok: false, error: string }
}
```

Started from `src/main/index.ts` alongside the existing tray/shortcuts
setup, only when `context.settings.get().enableCliCompanion` is true; torn
down on quit (`server.close()`, and unlink the socket file — stale socket
files after a crash need a check-and-remove on next startup, the same
class of problem Unix socket servers commonly handle).

### Settings

`AppSettings.enableCliCompanion: boolean` (default `false`), surfaced as a
checkbox in Settings → Advanced, next to other opt-in technical toggles.

### The `tt` binary

Lives outside the Electron bundle as a separate small package (e.g.
`packages/cli/` in the repo, published independently, or simply documented
as a script the user copies into their `PATH`) — it must run under a
Node the user already has installed, since it's a thin socket client with
no need to bundle Electron itself. Project resolution (name → id) needs a
*read* of the same data the app has — simplest v1: the CLI asks the running
app (`{ "cmd": "resolve_project", "query": "Client X" }`) rather than
opening the SQLite file itself, keeping `TimerService`'s DB access as the
single writer/reader of record and avoiding any file-locking concerns
with `better-sqlite3`'s WAL mode.

## 5. Open questions

1. Windows named pipes (`\\.\pipe\timetracker`) have a different Node API
   shape than Unix sockets (still via `net.createServer`, but the "path"
   convention differs) — worth confirming Node's `net` module handles both
   transparently enough, or if platform branching is needed in
   `cliServer.ts`.
2. Should the CLI be distributable as a real global binary (`npm i -g
   @timetracker/cli` or a prebuilt executable via `pkg`/`nexe`), or is a
   documented copy-paste Node script an acceptable v1 given the target
   audience is already comfortable in a terminal?
3. Authentication/authorization: since the socket is filesystem-permission
   scoped (only the OS user who owns `userData` can connect), is that
   sufficient, or does multi-user machine sharing of one `userData` folder
   need consideration? Likely a non-issue given the single-user, local-only
   design of the whole app.
