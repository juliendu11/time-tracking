CREATE TABLE IF NOT EXISTS task_folder_assignments (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL REFERENCES task_folders(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, folder_id)
);

CREATE INDEX IF NOT EXISTS idx_task_folder_assignments_folder_id
  ON task_folder_assignments(folder_id);

INSERT OR IGNORE INTO task_folder_assignments (task_id, folder_id)
  SELECT id, folder_id FROM tasks WHERE folder_id IS NOT NULL;
