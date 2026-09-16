import { openDatabase } from '@main/db/client'
import { ProjectRepository } from '@main/repositories/project.repository'
import { SettingsRepository } from '@main/repositories/settings.repository'
import { TagRepository } from '@main/repositories/tag.repository'
import { TaskRepository } from '@main/repositories/task.repository'
import { TaskFolderRepository } from '@main/repositories/taskFolder.repository'
import { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { ReportService } from '@main/services/report.service'
import { TimerService } from '@main/services/timer.service'

export function setupTestEnvironment() {
  const { db } = openDatabase(':memory:')
  const projects = new ProjectRepository(db)
  const tasks = new TaskRepository(db)
  const taskFolders = new TaskFolderRepository(db)
  const timeEntries = new TimeEntryRepository(db)
  const tags = new TagRepository(db)
  const settings = new SettingsRepository(db)
  const timer = new TimerService(db, projects, tasks, timeEntries, settings)
  const reports = new ReportService(projects, tasks, timeEntries, () => settings.get().weekStartsOn)

  return { db, projects, taskFolders, tasks, timeEntries, tags, settings, timer, reports }
}

export type TestEnvironment = ReturnType<typeof setupTestEnvironment>
