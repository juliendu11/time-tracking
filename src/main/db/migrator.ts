import type Database from 'better-sqlite3'
import migration0001 from './migrations/0001_init.sql?raw'

interface Migration {
  name: string
  sql: string
}

/**
 * Ordered, versioned migrations. Each one runs at most once, tracked in the
 * `_migrations` table, inside its own transaction. New migrations must be
 * appended here — never edit an already-shipped migration's SQL.
 */
const MIGRATIONS: Migration[] = [{ name: '0001_init', sql: migration0001 }]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    db
      .prepare<[], { name: string }>('SELECT name FROM _migrations')
      .all()
      .map((row) => row.name)
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue

    const applyMigration = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString()
      )
    })

    applyMigration()
  }
}
