CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  hourly_rate REAL,
  currency TEXT,
  weekly_target_minutes INTEGER,
  budget_minutes INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'normal',
  estimated_minutes INTEGER,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  description TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_ended_at ON time_entries(ended_at);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS time_entry_tags (
  time_entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (time_entry_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_time_entry_tags_tag_id ON time_entry_tags(tag_id);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  theme TEXT NOT NULL DEFAULT 'system',
  language TEXT NOT NULL DEFAULT 'en',
  week_starts_on INTEGER NOT NULL DEFAULT 1,
  time_format TEXT NOT NULL DEFAULT '24h',
  date_format TEXT NOT NULL DEFAULT 'iso',
  default_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  current_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  idle_detection_enabled INTEGER NOT NULL DEFAULT 1,
  idle_threshold_minutes INTEGER NOT NULL DEFAULT 5,
  launch_at_startup INTEGER NOT NULL DEFAULT 0,
  minimize_to_tray INTEGER NOT NULL DEFAULT 1,
  confirm_before_deleting_entry INTEGER NOT NULL DEFAULT 1,
  daily_goal_minutes INTEGER,
  weekly_goal_minutes INTEGER,
  notifications_enabled INTEGER NOT NULL DEFAULT 1,
  quick_switch_behavior TEXT NOT NULL DEFAULT 'atomic_switch',
  streak_threshold_minutes INTEGER NOT NULL DEFAULT 30,
  auto_backup_enabled INTEGER NOT NULL DEFAULT 1,
  auto_backup_frequency TEXT NOT NULL DEFAULT 'daily',
  auto_backup_keep_count INTEGER NOT NULL DEFAULT 30,
  pomodoro_enabled INTEGER NOT NULL DEFAULT 0,
  pomodoro_focus_minutes INTEGER NOT NULL DEFAULT 25,
  pomodoro_break_minutes INTEGER NOT NULL DEFAULT 5,
  pomodoro_long_break_minutes INTEGER NOT NULL DEFAULT 15,
  global_shortcut_toggle_timer TEXT NOT NULL DEFAULT 'CommandOrControl+Shift+Space',
  show_mini_timer INTEGER NOT NULL DEFAULT 0,
  mini_timer_always_on_top INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS active_timer (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timer_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  description TEXT,
  started_at TEXT NOT NULL,
  accumulated_pause_seconds INTEGER NOT NULL DEFAULT 0,
  paused_at TEXT,
  suspended_at TEXT
);
