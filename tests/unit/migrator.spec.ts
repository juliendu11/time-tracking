import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '@main/db/migrator'
import migration0001 from '@main/db/migrations/0001_init.sql?raw'

describe('database migrations', () => {
  it('preserves the existing timer while enabling multiple active timers', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(migration0001)
    db.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      );
      INSERT INTO _migrations (name, applied_at) VALUES ('0001_init', '2026-01-01T00:00:00.000Z');
      INSERT INTO projects (id, name, color, icon, created_at, updated_at)
      VALUES ('project-1', 'Project', '#123456', 'folder', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
      INSERT INTO active_timer (id, timer_id, project_id, started_at)
      VALUES (1, 'timer-1', 'project-1', '2026-01-01T00:00:00.000Z');
    `)

    runMigrations(db)

    const migrated = db
      .prepare<[], { timer_id: string }>('SELECT timer_id FROM active_timer ORDER BY timer_id')
      .all()
    expect(migrated).toEqual([{ timer_id: 'timer-1' }])

    db.prepare(
      'INSERT INTO active_timer (timer_id, project_id, started_at) VALUES (?, ?, ?)'
    ).run('timer-2', 'project-1', '2026-01-01T00:01:00.000Z')
    const count = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM active_timer').get()
    expect(count?.count).toBe(2)
    db.close()
  })
})
