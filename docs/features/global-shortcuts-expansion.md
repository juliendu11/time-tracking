# Expanded Global Shortcuts (future feature)

Status: **not implemented — one shortcut exists today**, written 2026-09-12.

## 1. What this is

Today the app registers exactly one global (OS-level, works even when the
app isn't focused) keyboard shortcut: toggle the last-used timer. Value:
power users who live in the tray/background want more of the app's fast
actions available without switching focus to the window at all — starting
a *specific* favorite project/task, pausing, or popping open the manual
entry form — the same way the single toggle shortcut already works.

## 2. Current state in the codebase

`src/main/shortcuts/globalShortcuts.ts` is small and single-purpose:

```ts
export function registerGlobalShortcuts(context: AppContext): void {
  const accelerator = context.settings.get().globalShortcutToggleTimer
  applyAccelerator(context, accelerator)
}
```

- Exactly **one** accelerator, stored as a single string column
  (`AppSettings.globalShortcutToggleTimer`, default
  `CommandOrControl+Shift+Space`), bound to `toggleLastTimer()`: stop if a
  timer is running, otherwise start the most recent project/task (falling
  back to `currentProjectId`).
- `applyAccelerator()` already handles re-registering cleanly (unregisters
  the old accelerator before registering a new one) — this is the
  mechanism any additional shortcuts would reuse, just called more than
  once.
- The Settings page has a "Shortcuts" tab (confirmed by the `tab` type in
  `SettingsPage.vue`) — presumably just this one binding today, based on
  the single settings field backing it.
- There is a command palette in the renderer (`features/command-palette/`
  per the architecture doc) for in-app fast actions, but it only works
  while the app window has focus — global shortcuts are the only way to
  reach the app's actions from outside it, and only one such action exists.

## 3. Proposed scope for v1

**In scope:**
- Move from "one fixed accelerator, one fixed action" to a small list of
  **user-configurable bindings**, each an `{ accelerator, action }` pair.
  A fixed set of possible actions for v1 (not a full command-palette-over-
  global-shortcuts system):
  - Toggle last timer (today's existing behavior, kept as the default
    first entry so existing users' muscle memory doesn't break).
  - Pause/resume the active timer.
  - Start a specific **favorite** project (one binding per favorited
    project the user chooses to assign a shortcut to — reuses
    `Project.isFavorite`, already a first-class field).
  - Open the manual entry modal (bringing the main window forward if
    hidden, same as `toggleLastTimer`'s `showMainWindow`-adjacent behavior
    already does implicitly by being reachable from the tray).
- A "Shortcuts" settings tab rework: a list of current bindings with
  action dropdown + accelerator recorder (capture next keypress, like most
  apps' shortcut-editing UI), add/remove rows, conflict detection (reject
  an accelerator already bound to another action in the list, and ideally
  warn if it collides with a known OS-reserved combination, best-effort).
- Migration path: the existing `globalShortcutToggleTimer` setting becomes
  the seed data for the first row of the new bindings list, so existing
  users don't lose their configured shortcut on upgrade.

**Out of scope for v1:**
- Per-task (as opposed to per-favorite-project) shortcuts — favorites
  give a bounded, already-curated list; opening this to arbitrary tasks
  risks an unbounded settings list with little UI to manage it well.
- Cross-platform accelerator recording edge cases beyond what Electron's
  `globalShortcut` already normalizes — rely on Electron's own
  `Accelerator` string format and validation.
- Exposing *every* command-palette action as a global-shortcut candidate —
  start with the short curated list above; expanding the action catalog is
  a low-risk follow-up once the list-based settings UI exists.

## 4. Architecture fit

### Schema (new migration `000X_shortcut_bindings.sql`)

A single fixed-width settings column doesn't scale to a list — move to a
dedicated table:

```sql
CREATE TABLE shortcut_bindings (
  id TEXT PRIMARY KEY,
  accelerator TEXT NOT NULL UNIQUE,
  action_type TEXT NOT NULL, -- 'toggle_last_timer' | 'pause_resume' | 'start_project' | 'open_manual_entry'
  action_project_id TEXT REFERENCES projects(id) ON DELETE CASCADE, -- only for 'start_project'
  created_at TEXT NOT NULL
);
```

`AppSettings.globalShortcutToggleTimer` stays in place (untouched, no
breaking migration of the column itself) but is no longer read by
`registerGlobalShortcuts` once bindings exist — instead, a one-time data
migration step (in the same migration file, or a small startup check)
inserts a `toggle_last_timer` row seeded from the old column's value if
`shortcut_bindings` is empty, so existing installs carry their setting
forward automatically.

### Domain types

```ts
export type ShortcutActionType = 'toggle_last_timer' | 'pause_resume' | 'start_project' | 'open_manual_entry'

export interface ShortcutBinding {
  id: string
  accelerator: string
  actionType: ShortcutActionType
  actionProjectId: string | null
  createdAt: string
}
export type ShortcutBindingInput = Pick<ShortcutBinding, 'accelerator' | 'actionType'> &
  Partial<Pick<ShortcutBinding, 'actionProjectId'>>
```

### `globalShortcuts.ts` rework

```ts
export function registerAllShortcuts(context: AppContext): void {
  unregisterAllShortcuts()
  for (const binding of context.shortcutBindings.list()) {
    globalShortcut.register(binding.accelerator, () => runAction(context, binding))
  }
}

function runAction(context: AppContext, binding: ShortcutBinding): void {
  switch (binding.actionType) {
    case 'toggle_last_timer': return toggleLastTimer(context)
    case 'pause_resume': /* ... */
    case 'start_project': /* context.timer.switchProject(binding.actionProjectId!) */
    case 'open_manual_entry': /* showMainWindow() + IPC event to open the modal */
  }
}
```

New `ShortcutBindingRepository` (standard CRUD, `UNIQUE` constraint on
`accelerator` enforced at the DB level as the conflict-detection backstop).

### IPC surface

New `shortcuts` namespace on `DesktopApi`:
```ts
shortcuts: {
  list(): Promise<ShortcutBinding[]>
  create(input: ShortcutBindingInput): Promise<ShortcutBinding>
  delete(id: string): Promise<void>
  favoriteProjectsForPicker(): Promise<Project[]> // convenience, or reuse projects.list({ favoritesOnly: true })
}
```
Any create/delete re-runs `registerAllShortcuts()` so changes take effect
immediately without an app restart (matching how `applyAccelerator` today
already re-registers live when the single setting changes).

### Renderer

- `SettingsPage.vue` → Shortcuts tab: replace the single accelerator input
  with a list UI (action dropdown, accelerator recorder, delete button per
  row, "Add shortcut" button), reusing `BaseCheckBox`-style existing form
  primitives where applicable.
- "Open manual entry" needs a way to signal the renderer from main once the
  window is shown — an IPC event (`window.desktop.on('open-manual-entry',
  ...)` or similar) the renderer's root layout listens for, since
  `ManualEntryModal` currently only opens from explicit in-app button
  clicks.

## 5. Open questions

1. Is a hard cap on the number of bindings worth enforcing (e.g. 10), to
   keep the OS-level shortcut surface manageable and the settings list
   from growing unbounded via favorited projects?
2. Accelerator conflict detection against **other apps'** global shortcuts
   isn't really possible to check in advance — `globalShortcut.register()`
   simply fails silently-ish (returns `false`) if taken. Should the UI
   attempt the registration immediately on save and show an inline error
   if it fails, rather than only validating against the app's own binding
   list?
3. Does `open_manual_entry` need the main window to already be visible, or
   should it un-minimize/un-hide it first (like `toggleLastTimer`'s
   effective behavior via the tray does today)? Should behave consistently
   with the existing tray "Open TimeTracker" action.
