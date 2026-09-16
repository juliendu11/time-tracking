CREATE TABLE IF NOT EXISTS task_folders (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_folders_project_id ON task_folders(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_folders_project_name
  ON task_folders(project_id, name COLLATE NOCASE);

ALTER TABLE tasks
  ADD COLUMN folder_id TEXT REFERENCES task_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_folder_id ON tasks(folder_id);
