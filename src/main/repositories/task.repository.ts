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
    parentTaskId: row.parentTaskId,
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

function isOpen(status: string): boolean {
  return status === 'todo' || status === 'in_progress'
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
    const parentTaskId = input.parentTaskId ?? null
    if (parentTaskId) this.assertValidParent(null, parentTaskId, input.projectId)
    const now = nowIso()
    const status = input.status ?? 'todo'
    const row = {
      id: nanoid(),
      projectId: input.projectId,
      parentTaskId,
      name: input.name.trim(),
      description: input.description ?? null,
      status,
      priority: input.priority ?? 'normal',
      estimatedMinutes: input.estimatedMinutes ?? null,
      isFavorite: input.isFavorite ?? false,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : null,
      archivedAt: status === 'archived' ? now : null
    }
    this.db.transaction((tx) => {
      tx.insert(tasks).values(row).run()
      if (folderIds.length > 0) {
        tx.insert(taskFolderAssignments)
          .values(folderIds.map((folderId) => ({ taskId: row.id, folderId })))
          .run()
      }
      if (parentTaskId && isOpen(status)) this.reopenAncestors(tx, parentTaskId)
    })
    return toDomain(row, folderIds)
  }

  update(id: string, update: TaskUpdate): Task {
    const current = this.getOrThrow(id)
    const folderIds = this.normalizeFolderIds(update.folderIds ?? current.folderIds)
    const projectId = update.projectId ?? current.projectId
    this.assertFoldersBelongToProject(folderIds, projectId)

    const projectChanged = projectId !== current.projectId
    if (projectChanged && this.childrenOf(id).length > 0) {
      throw new ValidationError('A task with subtasks cannot be moved to another project.')
    }
    let parentTaskId =
      update.parentTaskId !== undefined ? update.parentTaskId : current.parentTaskId
    // Moving to another project detaches the task from a parent left behind.
    if (projectChanged && update.parentTaskId === undefined) parentTaskId = null
    if (parentTaskId && parentTaskId !== current.parentTaskId) {
      this.assertValidParent(id, parentTaskId, projectId)
    }
    const status = update.status ?? current.status
    if (update.status === 'done' && current.status !== 'done') this.assertChildrenDone(id)

    const patch: Partial<TaskRow> & { updatedAt: string } = { updatedAt: nowIso() }
    if (update.projectId !== undefined) patch.projectId = update.projectId
    if (parentTaskId !== current.parentTaskId) patch.parentTaskId = parentTaskId
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
      if (parentTaskId && isOpen(status)) this.reopenAncestors(tx, parentTaskId)
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

  /**
   * A parent must live in the same project, and must not be the task itself
   * or one of its descendants (which would create a cycle).
   */
  private assertValidParent(taskId: string | null, parentTaskId: string, projectId: string): void {
    const parent = this.db
      .select({ id: tasks.id, projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, parentTaskId))
      .get()
    if (!parent) throw new NotFoundError('Task', parentTaskId)
    if (parent.projectId !== projectId) {
      throw new ValidationError('A parent task must belong to the same project.')
    }
    if (taskId === null) return
    if (parentTaskId === taskId || this.descendantIds(taskId).has(parentTaskId)) {
      throw new ValidationError('A task cannot be nested under itself or one of its subtasks.')
    }
  }

  /** Archived subtasks are out of scope and never block their parent. */
  private assertChildrenDone(taskId: string): void {
    const pending = this.childrenOf(taskId).filter((child) => isOpen(child.status))
    if (pending.length > 0) {
      throw new ValidationError(
        `Complete all subtasks first (${pending.length} remaining).`,
        { pendingTaskIds: pending.map((child) => child.id) }
      )
    }
  }

  /**
   * An open task under a done ancestor would break the invariant that done
   * parents only have done children, so every done ancestor is reopened.
   */
  private reopenAncestors(db: Pick<AppDatabase, 'select' | 'update'>, parentTaskId: string): void {
    const now = nowIso()
    const visited = new Set<string>()
    let currentId: string | null = parentTaskId
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const row: { status: string; parentTaskId: string | null } | undefined = db
        .select({ status: tasks.status, parentTaskId: tasks.parentTaskId })
        .from(tasks)
        .where(eq(tasks.id, currentId))
        .get()
      if (!row) return
      if (row.status === 'done') {
        db.update(tasks)
          .set({ status: 'todo', completedAt: null, updatedAt: now })
          .where(eq(tasks.id, currentId))
          .run()
      }
      currentId = row.parentTaskId
    }
  }

  private childrenOf(taskId: string): Array<{ id: string; status: string }> {
    return this.db
      .select({ id: tasks.id, status: tasks.status })
      .from(tasks)
      .where(eq(tasks.parentTaskId, taskId))
      .all()
  }

  private descendantIds(taskId: string): Set<string> {
    const result = new Set<string>()
    const queue = [taskId]
    while (queue.length > 0) {
      const ids = queue.splice(0)
      const children = this.db
        .select({ id: tasks.id })
        .from(tasks)
        .where(inArray(tasks.parentTaskId, ids))
        .all()
      for (const child of children) {
        if (result.has(child.id)) continue
        result.add(child.id)
        queue.push(child.id)
      }
    }
    return result
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
