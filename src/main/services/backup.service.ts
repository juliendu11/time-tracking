import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { AppError, ValidationError } from '@main/errors'
import { logger } from '@main/logger'
import { getBackupsDir, getDatabasePath, getExportsDir } from '@main/paths'
import type { ProjectRepository } from '@main/repositories/project.repository'
import type { SettingsRepository } from '@main/repositories/settings.repository'
import type { TagRepository } from '@main/repositories/tag.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { nowIso } from '@shared/utils/time'
import type { BackupFileInfo, ExportBundle } from '@shared/types/domain'

const EXPORT_VERSION = 1

export class BackupService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository,
    private readonly tags: TagRepository,
    private readonly settings: SettingsRepository
  ) {}

  buildExportBundle(): ExportBundle {
    const projects = this.projects.list({ includeArchived: true })
    const timeEntries = projects.flatMap((p) =>
      this.timeEntries.listInRange({
        startDate: '1970-01-01T00:00:00.000Z',
        endDate: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        projectIds: [p.id]
      })
    )
    const tasks = projects.flatMap((p) => this.tasks.listByProject(p.id, { includeArchived: true }))

    return {
      exportedAt: nowIso(),
      version: EXPORT_VERSION,
      projects,
      tasks,
      timeEntries,
      tags: this.tags.list(),
      settings: this.settings.get()
    }
  }

  exportJson(destinationPath?: string): string {
    const dir = getExportsDir()
    mkdirSync(dir, { recursive: true })
    const path = destinationPath ?? join(dir, `export-${timestampSlug()}.json`)
    writeFileSync(path, JSON.stringify(this.buildExportBundle(), null, 2), 'utf-8')
    logger.info('Exported JSON bundle', { path })
    return path
  }

  exportCsv(destinationPath?: string): string {
    const dir = getExportsDir()
    mkdirSync(dir, { recursive: true })
    const path = destinationPath ?? join(dir, `time-entries-${timestampSlug()}.csv`)
    const bundle = this.buildExportBundle()

    const projectById = new Map(bundle.projects.map((p) => [p.id, p]))
    const taskById = new Map(bundle.tasks.map((t) => [t.id, t]))

    const header = [
      'id',
      'project',
      'task',
      'description',
      'started_at',
      'ended_at',
      'duration_seconds',
      'source'
    ]
    const lines = [header.join(',')]
    for (const entry of bundle.timeEntries) {
      const row = [
        entry.id,
        csvEscape(projectById.get(entry.projectId)?.name ?? ''),
        csvEscape(entry.taskId ? (taskById.get(entry.taskId)?.name ?? '') : ''),
        csvEscape(entry.description ?? ''),
        entry.startedAt,
        entry.endedAt ?? '',
        String(entry.durationSeconds),
        entry.source
      ]
      lines.push(row.join(','))
    }
    writeFileSync(path, lines.join('\n'), 'utf-8')
    logger.info('Exported CSV', { path })
    return path
  }

  createBackupNow(): BackupFileInfo {
    const dir = getBackupsDir()
    mkdirSync(dir, { recursive: true })
    const fileName = `backup-${timestampSlug()}.sqlite3`
    const filePath = join(dir, fileName)
    copyFileSync(getDatabasePath(), filePath)
    const { size } = statSync(filePath)
    logger.info('Backup created', { filePath })
    return { fileName, filePath, createdAt: nowIso(), sizeBytes: size }
  }

  listBackups(): BackupFileInfo[] {
    const dir = getBackupsDir()
    if (!existsSync(dir)) return []
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sqlite3'))
      .map((fileName) => {
        const filePath = join(dir, fileName)
        const stat = statSync(filePath)
        return {
          fileName,
          filePath,
          createdAt: stat.mtime.toISOString(),
          sizeBytes: stat.size
        }
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  pruneOldBackups(keepCount: number): void {
    const backups = this.listBackups()
    for (const backup of backups.slice(keepCount)) {
      unlinkSync(backup.filePath)
      logger.info('Pruned old backup', { fileName: backup.fileName })
    }
  }

  getBackupsDir(): string {
    return getBackupsDir()
  }

  /** Verifies a candidate backup file is a readable SQLite database before restoring it. */
  verifyBackupFile(filePath: string): void {
    if (!existsSync(filePath)) {
      throw new ValidationError('Backup file does not exist.')
    }
    let handle: Database.Database | null = null
    try {
      handle = new Database(filePath, { readonly: true })
      const row = handle
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")
        .get()
      if (!row) throw new ValidationError('This file does not look like a TimeTracker backup.')
    } catch (error) {
      if (error instanceof ValidationError) throw error
      throw new AppError('Unable to read backup file.', 'INVALID_BACKUP', error)
    } finally {
      handle?.close()
    }
  }

  /**
   * Restores a backup by replacing the live database file. The caller
   * (main process bootstrap) is responsible for closing the current DB
   * connection before calling this and re-opening it after, and for
   * restarting the app so every in-memory service re-reads fresh state.
   */
  restoreBackup(filePath: string): { safetyBackupPath: string } {
    this.verifyBackupFile(filePath)
    const safety = this.createBackupNow()
    copyFileSync(filePath, getDatabasePath())
    logger.info('Backup restored', { filePath, safetyBackupPath: safety.filePath })
    return { safetyBackupPath: safety.filePath }
  }
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}
