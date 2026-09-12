import type { AppDatabase } from '@main/db/client'
import { ProjectRepository } from '@main/repositories/project.repository'
import { SettingsRepository } from '@main/repositories/settings.repository'
import { TagRepository } from '@main/repositories/tag.repository'
import { TaskRepository } from '@main/repositories/task.repository'
import { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { BackupService } from '@main/services/backup.service'
import { IdleService } from '@main/services/idle.service'
import { ReportService } from '@main/services/report.service'
import { SearchService } from '@main/services/search.service'
import { SuggestionService } from '@main/services/suggestion.service'
import { TimerService } from '@main/services/timer.service'

export interface AppContext {
  db: AppDatabase
  projects: ProjectRepository
  tasks: TaskRepository
  timeEntries: TimeEntryRepository
  tags: TagRepository
  settings: SettingsRepository
  timer: TimerService
  idle: IdleService
  reports: ReportService
  suggestions: SuggestionService
  search: SearchService
  backup: BackupService
  requestRestart: () => void
}

export function buildAppContext(db: AppDatabase, requestRestart: () => void): AppContext {
  const projects = new ProjectRepository(db)
  const tasks = new TaskRepository(db)
  const timeEntries = new TimeEntryRepository(db)
  const tags = new TagRepository(db)
  const settings = new SettingsRepository(db)
  const timer = new TimerService(db, projects, tasks, timeEntries, settings)
  const idle = new IdleService(timer, settings)
  const reports = new ReportService(projects, tasks, timeEntries, () => settings.get().weekStartsOn)
  const suggestions = new SuggestionService(projects, tasks, timeEntries)
  const search = new SearchService(projects, tasks, timeEntries, tags)
  const backup = new BackupService(projects, tasks, timeEntries, tags, settings)

  return {
    db,
    projects,
    tasks,
    timeEntries,
    tags,
    settings,
    timer,
    idle,
    reports,
    suggestions,
    search,
    backup,
    requestRestart
  }
}
