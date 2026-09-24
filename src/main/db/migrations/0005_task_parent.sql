ALTER TABLE tasks
  ADD COLUMN parent_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
