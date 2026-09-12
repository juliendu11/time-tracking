import { app } from 'electron'
import { join } from 'node:path'

/** Centralised filesystem locations. Never scattered across the codebase. */
export function getUserDataDir(): string {
  return app.getPath('userData')
}

export function getDatabasePath(): string {
  return join(getUserDataDir(), 'timetracker.sqlite3')
}

export function getBackupsDir(): string {
  return join(getUserDataDir(), 'backups')
}

export function getLogsDir(): string {
  return join(getUserDataDir(), 'logs')
}

export function getExportsDir(): string {
  return join(getUserDataDir(), 'exports')
}
