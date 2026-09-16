import { and, asc, eq, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { taskFolderAssignments, taskFolders, tasks } from '@main/db/schema'
import { NotFoundError, ValidationError } from '@main/errors'
import { nowIso } from '@shared/utils/time'
import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskStatus,
  TaskUpdate
} from '@shared/types/domain'

type TaskRow = typeof tasks.$inferSelect

function toDomain(row: TaskRow, folderIds: string[]): Task {
  return {
    id: row.id,
    projectId: row.projectId,
    folderIds,
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
    const foldersByTask = this.folderIdsByTask(filtered.map((task) => task.id))
    return filtered.map((task) => toDomain(task, foldersByTask.get(task.id) ?? []))
  }

  findById(id: string): Task | null {
    const row = this.db.select().from(tasks).where(eq(tasks.id, id)).get()
    return row ? toDomain(row, this.folderIdsByTask([id]).get(id) ?? []) : null
  }

  getOrThrow(id: string): Task {
    const task = this.findById(id)
    if (!task) throw new NotFoundError('Task', id)
    return task
  }

  create(input: TaskInput): Task {
    const folderIds = this.normalizeFolderIds(input.folderIds)
    this.assertFoldersBelongToProject(folderIds, input.projectId)
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
    this.db.transaction((tx) => {
      tx.insert(tasks).values(row).run()
      if (folderIds.length > 0) {
        tx.insert(taskFolderAssignments)
          .values(folderIds.map((folderId) => ({ taskId: row.id, folderId })))
          .run()
      }
    })
    return toDomain(row, folderIds)
  }

  update(id: string, update: TaskUpdate): Task {
    const current = this.getOrThrow(id)
    const folderIds = this.normalizeFolderIds(update.folderIds ?? current.folderIds)
    const projectId = update.projectId ?? current.projectId
    this.assertFoldersBelongToProject(folderIds, projectId)

    const patch: Partial<TaskRow> & { updatedAt: string } = { updatedAt: nowIso() }
    if (update.projectId !== undefined) patch.projectId = update.projectId
    if (update.name !== undefined) patch.name = update.name
    if (update.description !== undefined) patch.description = update.description
    if (update.status !== undefined) patch.status = update.status
    if (update.priority !== undefined) patch.priority = update.priority
    if (update.estimatedMinutes !== undefined) patch.estimatedMinutes = update.estimatedMinutes
    if (update.isFavorite !== undefined) patch.isFavorite = update.isFavorite
    if (update.status === 'done') patch.completedAt = nowIso()
    if (update.status === 'archived') patch.archivedAt = nowIso()
    this.db.transaction((tx) => {
      tx.update(tasks).set(patch).where(eq(tasks.id, id)).run()
      if (update.folderIds !== undefined) {
        tx.delete(taskFolderAssignments).where(eq(taskFolderAssignments.taskId, id)).run()
        if (folderIds.length > 0) {
          tx.insert(taskFolderAssignments)
            .values(folderIds.map((folderId) => ({ taskId: id, folderId })))
            .run()
        }
      }
    })
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

  private normalizeFolderIds(folderIds: string[] | undefined): string[] {
    return [...new Set(folderIds ?? [])]
  }

  private assertFoldersBelongToProject(folderIds: string[], projectId: string): void {
    if (folderIds.length === 0) return
    const matchingFolders = this.db
      .select({ id: taskFolders.id })
      .from(taskFolders)
      .where(and(eq(taskFolders.projectId, projectId), inArray(taskFolders.id, folderIds)))
      .all()
    if (matchingFolders.length !== folderIds.length) {
      throw new ValidationError('One or more selected folders do not belong to this project.')
    }
  }

  private folderIdsByTask(taskIds: string[]): Map<string, string[]> {
    const result = new Map<string, string[]>()
    if (taskIds.length === 0) return result
    const assignments = this.db
      .select({
        taskId: taskFolderAssignments.taskId,
        folderId: taskFolderAssignments.folderId
      })
      .from(taskFolderAssignments)
      .innerJoin(taskFolders, eq(taskFolderAssignments.folderId, taskFolders.id))
      .where(inArray(taskFolderAssignments.taskId, taskIds))
      .orderBy(asc(taskFolders.position), asc(taskFolders.createdAt))
      .all()
    for (const assignment of assignments) {
      const folderIds = result.get(assignment.taskId) ?? []
      folderIds.push(assignment.folderId)
      result.set(assignment.taskId, folderIds)
    }
    return result
  }
}
