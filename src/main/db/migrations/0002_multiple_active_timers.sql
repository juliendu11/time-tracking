CREATE TABLE active_timer_next (
  timer_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  description TEXT,
  started_at TEXT NOT NULL,
  accumulated_pause_seconds INTEGER NOT NULL DEFAULT 0,
  paused_at TEXT,
  suspended_at TEXT
);

INSERT INTO active_timer_next (
  timer_id,
  project_id,
  task_id,
  description,
  started_at,
  accumulated_pause_seconds,
  paused_at,
  suspended_at
)
SELECT
  timer_id,
  project_id,
  task_id,
  description,
  started_at,
  accumulated_pause_seconds,
  paused_at,
  suspended_at
FROM active_timer;

DROP TABLE active_timer;
ALTER TABLE active_timer_next RENAME TO active_timer;

CREATE INDEX active_timer_project_id_idx ON active_timer(project_id);
CREATE INDEX active_timer_task_id_idx ON active_timer(task_id);
