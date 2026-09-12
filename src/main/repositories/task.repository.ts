import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { tasks } from '@main/db/schema'
import { NotFoundError } from '@main/errors'
import { nowIso } from '@shared/utils/time'
import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskUpdate
} from '@shared/types/domain'

type TaskRow = typeof tasks.$inferSelect

function toDomain(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    estimatedMinutes: row.estimatedMinutes,
    isFavorite: row.isFavorite,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
    archivedAt: row.archivedAt
  }
}

export class TaskRepository {
  constructor(private readonly db: AppDatabase) {}

  listByProject(projectId: string, options: { includeArchived?: boolean } = {}): Task[] {
    const rows = this.db.select().from(tasks).where(eq(tasks.projectId, projectId)).all()
    const filtered = options.includeArchived ? rows : rows.filter((r) => r.status !== 'archived')
    return filtered.map(toDomain)
  }

  findById(id: string): Task | null {
    const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get()
    return row ? toDomain(row) : null
  }

  getOrThrow(id: string): Task {
    const task = this.findById(id)
    if (!task) throw new NotFoundError('Task', id)
    return task
  }

  create(input: TaskInput): Task {
    const now = nowIso()
    const row = {
      id: nanoid(),
      projectId: input.projectId,
      name: input.name.trim(),
      description: input.description ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'normal',
      estimatedMinutes: input.estimatedMinutes ?? null,
      isFavorite: input.isFavorite ?? false,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      archivedAt: null
    }
    this.db.insert(tasks).values(row).run()
    return toDomain(row)
  }

  update(id: string, update: TaskUpdate): Task {
    this.getOrThrow(id)
    const patch: Partial<TaskRow> & { updatedAt: string } = { ...update, updatedAt: nowIso() }
    if (update.status === 'done') patch.completedAt = nowIso()
    if (update.status === 'archived') patch.archivedAt = nowIso()
    this.db.update(tasks).set(patch).where(eq(tasks.id, id)).run()
    return this.getOrThrow(id)
  }

  archive(id: string): Task {
    return this.update(id, { status: 'archived' })
  }

  delete(id: string): void {
    this.getOrThrow(id)
    this.db.delete(tasks).where(eq(tasks.id, id)).run()
  }

  countActiveByProject(projectId: string): number {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, 'todo')))
      .all().length
  }
}
