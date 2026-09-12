# Recurring Task Templates (future feature)

Status: **not implemented — design doc only**, written 2026-09-12.

## 1. What this is

Let a task recreate itself on a schedule — "Weekly team sync," "Monthly
invoicing admin," "Daily standup" — instead of the user manually re-creating
the same task every week. Value: for the recurring administrative/meeting
work that sits alongside real project work, this removes repetitive manual
setup and keeps a consistent task history to track time against.

## 2. Current state in the codebase

`Task` (`src/shared/types/domain.ts:47`) has no recurrence concept at all:

```ts
export interface Task {
  id: string
  projectId: string
  name: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  estimatedMinutes: number | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
  archivedAt: string | null
}
```

No fields, no background job, no "template" notion anywhere in
`src/main/services/`. This is a clean net-new feature — no existing
half-built plumbing to reconcile with, unlike Pomodoro or invoicing.

There is a precedent for scheduled background work in the app already:
`AppSettings.autoBackupEnabled`/`autoBackupFrequency` drives a periodic
backup job (`BackupService` + a scheduler in main process startup). A
recurrence engine for tasks follows the same shape: a small piece of
main-process state checked periodically (or on app launch), not a
full cron implementation.

## 3. Proposed scope for v1

**In scope:**
- A **recurrence rule** attachable to a task, with a simple fixed set of
  patterns (not a full RRULE parser — see open questions):
  `daily`, `weekly`, `biweekly`, `monthly`, plus which day(s) it applies to
  where relevant (e.g. weekly on Monday).
- Recurring tasks work as **templates that spawn regular tasks**: the
  recurring definition lives separately from the concrete `Task` rows it
  produces, so time tracked against "Weekly sync (Sep 15)" is a normal,
  independent `Task` with its own time entries — deleting or editing one
  occurrence never touches the template or other occurrences.
- On app launch and once a day thereafter (piggybacking on the existing
  auto-backup check interval, or the same daily boundary logic
  `src/shared/utils/time.ts` already has for day-boundary splitting),
  check all active recurrence templates and create the next occurrence's
  `Task` if it's due and doesn't already exist.
- A "Make recurring" action on the existing task creation/edit form
  (`TaskFormModal`), and a small "Recurring tasks" management view (list of
  templates, pause/resume, edit pattern, delete template — deleting a
  template never deletes tasks it already spawned).
- New tasks are created with the template's name/description/priority/
  estimated minutes copied over; `status` always starts at `todo`.

**Out of scope for v1:**
- Full iCal RRULE syntax (custom N-day intervals, complex "3rd Tuesday of
  the month" rules) — the four fixed patterns above cover the realistic
  common cases for a personal time tracker; a free-text RRULE field can be
  a v2 if someone genuinely needs it.
- Recurring **time entries** (auto-logging time without the user starting a
  timer) — recurrence only creates the task shell; time is still tracked
  the normal way.
- Notifications/reminders tied to recurrence ("don't forget your weekly
  sync task") — that's a distinct feature, could layer on
  `NotificationService` later.

## 4. Architecture fit

### Schema (new migration `000X_recurring_tasks.sql`)

```sql
CREATE TABLE task_templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  estimated_minutes INTEGER,
  recurrence_pattern TEXT NOT NULL, -- 'daily' | 'weekly' | 'biweekly' | 'monthly'
  recurrence_weekday INTEGER,       -- 0-6, for weekly/biweekly; NULL otherwise
  recurrence_day_of_month INTEGER,  -- 1-31, for monthly; NULL otherwise
  is_paused INTEGER NOT NULL DEFAULT 0,
  last_spawned_at TEXT,             -- date of the most recent occurrence created
  created_at TEXT NOT NULL
);

ALTER TABLE tasks ADD COLUMN template_id TEXT REFERENCES task_templates(id) ON DELETE SET NULL;
```

`tasks.template_id` links a spawned occurrence back to its template
(nullable — most tasks have none), enough to show "part of a recurring
series" in the UI without coupling task deletion to the template.

### Domain types (`src/shared/types/domain.ts`)

```ts
export type RecurrencePattern = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface TaskTemplate {
  id: string
  projectId: string
  name: string
  description: string | null
  priority: TaskPriority
  estimatedMinutes: number | null
  recurrencePattern: RecurrencePattern
  recurrenceWeekday: number | null
  recurrenceDayOfMonth: number | null
  isPaused: boolean
  lastSpawnedAt: string | null
  createdAt: string
}
export type TaskTemplateInput = Pick<TaskTemplate, 'projectId' | 'name' | 'recurrencePattern'> &
  Partial<Omit<TaskTemplate, 'id' | 'projectId' | 'name' | 'recurrencePattern' | 'createdAt' | 'lastSpawnedAt'>>
```

`Task.templateId: string | null` added to the existing `Task` interface.

### New service: `TaskTemplateService` (`src/main/services/taskTemplate.service.ts`)

- CRUD for templates via a new `TaskTemplateRepository`.
- `spawnDueOccurrences(reference: Date): Task[]` — for each active
  (`!isPaused`) template, computes whether `reference` is a due date given
  `recurrencePattern`/`lastSpawnedAt`, and if so creates the `Task` via the
  existing `TaskRepository.create()` with `templateId` set, then updates
  `lastSpawnedAt`.
- Called once at app startup and once per day thereafter — same trigger
  point as the existing auto-backup scheduling in main process init.

### IPC surface

New `taskTemplates` namespace on `DesktopApi`, mirroring the existing
`tasks` namespace shape (`create`, `update`, `delete`, `listForProject`,
`pause`/`resume`).

### Renderer

- `TaskFormModal.vue` gains a "Repeat" section (pattern selector +
  weekday/day-of-month picker as relevant), only shown for new tasks (a
  template can't retroactively adopt an existing task — creating a fresh
  template is simpler than task-to-template migration).
- A `TaskRow.vue` badge/icon when `task.templateId` is set, indicating
  "part of a recurring series," with a link to the template's settings.
- A small `RecurringTasksPage.vue` or a tab under Settings/Advanced to
  manage templates.

## 5. Open questions

1. If a template is paused mid-cycle, does the next `resume` immediately
   spawn a "make-up" occurrence for the missed date, or just resume the
   forward schedule from resume-time? Simplest v1: forward-only, no
   backfill.
2. What happens to a template when its `Project` is archived — auto-pause,
   or leave it running and let the user notice? Auto-pause matches the
   principle that archived projects shouldn't accrue new activity.
3. Should the daily due-check also run while the app is open and midnight
   passes (long-running session), not just at launch — likely yes, reusing
   whatever day-boundary tick (if any) other features end up needing (e.g.
   [[budget-alerts]]'s weekly-period reset also needs a "did we cross a day
   boundary while running" check — worth building one shared low-frequency
   scheduler both features hook into rather than each polling
   independently).
