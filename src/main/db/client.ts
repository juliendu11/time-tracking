import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { getDatabasePath } from '@main/paths'
import { runMigrations } from './migrator'
import * as schema from './schema'
import { logger } from '@main/logger'

export type AppDatabase = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: AppDatabase | null = null

export function openDatabase(customPath?: string): { db: AppDatabase; sqlite: Database.Database } {
  const dbPath = customPath ?? getDatabasePath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const connection = new Database(dbPath)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.pragma('synchronous = NORMAL')

  runMigrations(connection)

  const drizzleDb = drizzle(connection, { schema })

  if (!customPath) {
    sqlite = connection
    db = drizzleDb
  }

  logger.info(`Database ready at ${dbPath}`)
  return { db: drizzleDb, sqlite: connection }
}

export function getDb(): AppDatabase {
  if (!db) throw new Error('Database has not been initialised yet')
  return db
}

export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database has not been initialised yet')
  return sqlite
}

export function closeDatabase(): void {
  sqlite?.close()
  sqlite = null
  db = null
}
