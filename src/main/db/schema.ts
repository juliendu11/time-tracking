import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text
} from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  status: text('status').notNull().default('active'),
  isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  hourlyRate: real('hourly_rate'),
  currency: text('currency'),
  weeklyTargetMinutes: integer('weekly_target_minutes'),
  budgetMinutes: integer('budget_minutes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at')
})

export const taskFolders = sqliteTable(
  'task_folders',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [index('idx_task_folders_project_id').on(table.projectId)]
)

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('todo'),
    priority: text('priority').notNull().default('normal'),
    estimatedMinutes: integer('estimated_minutes'),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    completedAt: text('completed_at'),
    archivedAt: text('archived_at'),
    parentTaskId: text('parent_task_id').references((): AnySQLiteColumn => tasks.id, {
      onDelete: 'set null'
    })
  },
  (table) => [
    index('idx_tasks_project_id').on(table.projectId),
    index('idx_tasks_parent_task_id').on(table.parentTaskId)
  ]
)

export const taskFolderAssignments = sqliteTable(
  'task_folder_assignments',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    folderId: text('folder_id')
      .notNull()
      .references(() => taskFolders.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.folderId] }),
    index('idx_task_folder_assignments_folder_id').on(table.folderId)
  ]
)

export const timeEntries = sqliteTable(
  'time_entries',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    description: text('description'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    source: text('source').notNull().default('manual'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull()
  },
  (table) => [
    index('idx_time_entries_project_id').on(table.projectId),
    index('idx_time_entries_task_id').on(table.taskId),
    index('idx_time_entries_started_at').on(table.startedAt),
    index('idx_time_entries_ended_at').on(table.endedAt)
  ]
)

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull()
})

export const timeEntryTags = sqliteTable(
  'time_entry_tags',
  {
    timeEntryId: text('time_entry_id')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => [
    primaryKey({ columns: [table.timeEntryId, table.tagId] }),
    index('idx_time_entry_tags_tag_id').on(table.tagId)
  ]
)

/** Single-row table (id is always 1). */
export const appSettings = sqliteTable('app_settings', {
  id: integer('id').primaryKey(),
  theme: text('theme').notNull().default('system'),
  language: text('language').notNull().default('en'),
  weekStartsOn: integer('week_starts_on').notNull().default(1),
  timeFormat: text('time_format').notNull().default('24h'),
  dateFormat: text('date_format').notNull().default('iso'),
  defaultProjectId: text('default_project_id').references(() => projects.id, {
    onDelete: 'set null'
  }),
  currentProjectId: text('current_project_id').references(() => projects.id, {
    onDelete: 'set null'
  }),
  idleDetectionEnabled: integer('idle_detection_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  idleThresholdMinutes: integer('idle_threshold_minutes').notNull().default(5),
  launchAtStartup: integer('launch_at_startup', { mode: 'boolean' })
    .notNull()
    .default(false),
  minimizeToTray: integer('minimize_to_tray', { mode: 'boolean' })
    .notNull()
    .default(true),
  confirmBeforeDeletingEntry: integer('confirm_before_deleting_entry', {
    mode: 'boolean'
  })
    .notNull()
    .default(true),
  dailyGoalMinutes: integer('daily_goal_minutes'),
  weeklyGoalMinutes: integer('weekly_goal_minutes'),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  quickSwitchBehavior: text('quick_switch_behavior').notNull().default('atomic_switch'),
  streakThresholdMinutes: integer('streak_threshold_minutes').notNull().default(30),
  autoBackupEnabled: integer('auto_backup_enabled', { mode: 'boolean' })
    .notNull()
    .default(true),
  autoBackupFrequency: text('auto_backup_frequency').notNull().default('daily'),
  autoBackupKeepCount: integer('auto_backup_keep_count').notNull().default(30),
  pomodoroEnabled: integer('pomodoro_enabled', { mode: 'boolean' }).notNull().default(false),
  pomodoroFocusMinutes: integer('pomodoro_focus_minutes').notNull().default(25),
  pomodoroBreakMinutes: integer('pomodoro_break_minutes').notNull().default(5),
  pomodoroLongBreakMinutes: integer('pomodoro_long_break_minutes').notNull().default(15),
  globalShortcutToggleTimer: text('global_shortcut_toggle_timer')
    .notNull()
    .default('CommandOrControl+Shift+Space'),
  showMiniTimer: integer('show_mini_timer', { mode: 'boolean' }).notNull().default(false),
  miniTimerAlwaysOnTop: integer('mini_timer_always_on_top', { mode: 'boolean' })
    .notNull()
    .default(true)
})

/** All timers currently active in the app. */
export const activeTimer = sqliteTable('active_timer', {
  timerId: text('timer_id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  description: text('description'),
  startedAt: text('started_at').notNull(),
  accumulatedPauseSeconds: integer('accumulated_pause_seconds').notNull().default(0),
  pausedAt: text('paused_at'),
  suspendedAt: text('suspended_at')
})

export const migrationsTable = sqliteTable('_migrations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  appliedAt: text('applied_at').notNull()
})
