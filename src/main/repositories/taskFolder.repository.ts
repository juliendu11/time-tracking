import { asc, eq, max } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { taskFolders } from '@main/db/schema'
import { ConflictError, NotFoundError } from '@main/errors'
import type { TaskFolder, TaskFolderInput, TaskFolderUpdate } from '@shared/types/domain'
import { nowIso } from '@shared/utils/time'

type TaskFolderRow = typeof taskFolders.$inferSelect

function toDomain(row: TaskFolderRow): TaskFolder {
  return { ...row }
}

export class TaskFolderRepository {
  constructor(private readonly db: AppDatabase) {}

  listByProject(projectId: string): TaskFolder[] {
    return this.db
      .select()
      .from(taskFolders)
      .where(eq(taskFolders.projectId, projectId))
      .orderBy(asc(taskFolders.position), asc(taskFolders.createdAt))
      .all()
      .map(toDomain)
  }

  findById(id: string): TaskFolder | null {
    const row = this.db.select().from(taskFolders).where(eq(taskFolders.id, id)).get()
    return row ? toDomain(row) : null
  }

  getOrThrow(id: string): TaskFolder {
    const folder = this.findById(id)
    if (!folder) throw new NotFoundError('Task folder', id)
    return folder
  }

  create(input: TaskFolderInput): TaskFolder {
    this.assertNameAvailable(input.projectId, input.name)
    const now = nowIso()
    const lastPosition = this.db
      .select({ value: max(taskFolders.position) })
      .from(taskFolders)
      .where(eq(taskFolders.projectId, input.projectId))
      .get()?.value
    const row: TaskFolderRow = {
      id: nanoid(),
      projectId: input.projectId,
      name: input.name.trim(),
      position: input.position ?? (lastPosition ?? -1) + 1,
      createdAt: now,
      updatedAt: now
    }
    this.db.insert(taskFolders).values(row).run()
    return toDomain(row)
  }

  update(id: string, update: TaskFolderUpdate): TaskFolder {
    const current = this.getOrThrow(id)
    if (update.name !== undefined) this.assertNameAvailable(current.projectId, update.name, id)
    this.db
      .update(taskFolders)
      .set({
        ...update,
        name: update.name?.trim(),
        updatedAt: nowIso()
      })
      .where(eq(taskFolders.id, id))
      .run()
    return this.getOrThrow(id)
  }

  delete(id: string): void {
    this.getOrThrow(id)
    this.db.delete(taskFolders).where(eq(taskFolders.id, id)).run()
  }

  private assertNameAvailable(projectId: string, name: string, excludeId?: string): void {
    const existing = this.db
      .select()
      .from(taskFolders)
      .where(eq(taskFolders.projectId, projectId))
      .all()
      .find((folder) => folder.id !== excludeId && folder.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase())
    if (existing) throw new ConflictError('A folder with this name already exists in the project.')
  }
}
