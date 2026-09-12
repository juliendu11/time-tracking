import { and, asc, desc, eq, gt, inArray, isNull, like, lt, ne, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { timeEntries, timeEntryTags } from '@main/db/schema'
import { NotFoundError, ValidationError } from '@main/errors'
import { isValidRange, nowIso } from '@shared/utils/time'
import type {
  TimeEntry,
  TimeEntryInput,
  TimeEntrySource,
  TimeEntryUpdate
} from '@shared/types/domain'

type TimeEntryRow = typeof timeEntries.$inferSelect

export interface TimeEntryRangeFilter {
  startDate: string
  endDate: string
  projectIds?: string[]
  taskIds?: string[]
  tagIds?: string[]
  onlyWithoutTask?: boolean
}

function toDomain(row: TimeEntryRow, tagIds: string[]): TimeEntry {
  return {
    id: row.id,
    projectId: row.projectId,
    taskId: row.taskId,
    description: row.description,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
    source: row.source as TimeEntrySource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tagIds
  }
}

export class TimeEntryRepository {
  constructor(private readonly db: AppDatabase) {}

  private tagIdsFor(timeEntryId: string): string[] {
    return this.db
      .select({ tagId: timeEntryTags.tagId })
      .from(timeEntryTags)
      .where(eq(timeEntryTags.timeEntryId, timeEntryId))
      .all()
      .map((r) => r.tagId)
  }

  private tagIdsForMany(timeEntryIds: string[]): Map<string, string[]> {
    if (timeEntryIds.length === 0) return new Map()
    const rows = this.db
      .select()
      .from(timeEntryTags)
      .where(inArray(timeEntryTags.timeEntryId, timeEntryIds))
      .all()
    const map = new Map<string, string[]>()
    for (const row of rows) {
      const list = map.get(row.timeEntryId) ?? []
      list.push(row.tagId)
      map.set(row.timeEntryId, list)
    }
    return map
  }

  findById(id: string): TimeEntry | null {
    const row = this.db.select().from(timeEntries).where(eq(timeEntries.id, id)).get()
    return row ? toDomain(row, this.tagIdsFor(id)) : null
  }

  getOrThrow(id: string): TimeEntry {
    const entry = this.findById(id)
    if (!entry) throw new NotFoundError('TimeEntry', id)
    return entry
  }

  /** Half-open range [startDate, endDate) query, with optional filters, indexed on started_at. */
  listInRange(filter: TimeEntryRangeFilter): TimeEntry[] {
    const conditions = [
      lt(timeEntries.startedAt, filter.endDate),
      or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, filter.startDate))
    ]
    if (filter.projectIds && filter.projectIds.length > 0) {
      conditions.push(inArray(timeEntries.projectId, filter.projectIds))
    }
    if (filter.taskIds && filter.taskIds.length > 0) {
      conditions.push(inArray(timeEntries.taskId, filter.taskIds))
    }
    if (filter.onlyWithoutTask) {
      conditions.push(isNull(timeEntries.taskId))
    }

    const rows = this.db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .orderBy(asc(timeEntries.startedAt))
      .all()

    const tagMap = this.tagIdsForMany(rows.map((r) => r.id))
    let entries = rows.map((row) => toDomain(row, tagMap.get(row.id) ?? []))

    if (filter.tagIds && filter.tagIds.length > 0) {
      const wanted = new Set(filter.tagIds)
      entries = entries.filter((e) => e.tagIds.some((t) => wanted.has(t)))
    }

    return entries
  }

  listRecent(limit: number): TimeEntry[] {
    const rows = this.db
      .select()
      .from(timeEntries)
      .orderBy(desc(timeEntries.startedAt))
      .limit(limit)
      .all()
    const tagMap = this.tagIdsForMany(rows.map((r) => r.id))
    return rows.map((row) => toDomain(row, tagMap.get(row.id) ?? []))
  }

  /** Indexed-enough substring search over descriptions, newest first. */
  searchByDescription(query: string, limit: number): TimeEntry[] {
    const escaped = query.replace(/[%_]/g, (c) => `\\${c}`)
    const rows = this.db
      .select()
      .from(timeEntries)
      .where(like(timeEntries.description, `%${escaped}%`))
      .orderBy(desc(timeEntries.startedAt))
      .limit(limit)
      .all()
    const tagMap = this.tagIdsForMany(rows.map((r) => r.id))
    return rows.map((row) => toDomain(row, tagMap.get(row.id) ?? []))
  }

  listByTask(taskId: string): TimeEntry[] {
    const rows = this.db
      .select()
      .from(timeEntries)
      .where(eq(timeEntries.taskId, taskId))
      .orderBy(desc(timeEntries.startedAt))
      .all()
    const tagMap = this.tagIdsForMany(rows.map((r) => r.id))
    return rows.map((row) => toDomain(row, tagMap.get(row.id) ?? []))
  }

  /** Entries that overlap [startedAt, endedAt), excluding a given entry id (for edits). */
  findOverlapping(startedAt: string, endedAt: string, excludeId?: string): TimeEntry[] {
    const conditions = [
      lt(timeEntries.startedAt, endedAt),
      or(isNull(timeEntries.endedAt), gt(timeEntries.endedAt, startedAt))
    ]
    if (excludeId) conditions.push(ne(timeEntries.id, excludeId))

    const rows = this.db
      .select()
      .from(timeEntries)
      .where(and(...conditions))
      .all()
    const tagMap = this.tagIdsForMany(rows.map((r) => r.id))
    return rows.map((row) => toDomain(row, tagMap.get(row.id) ?? []))
  }

  create(input: TimeEntryInput): TimeEntry {
    if (input.endedAt && !isValidRange(input.startedAt, input.endedAt)) {
      throw new ValidationError('End time must be after start time.')
    }
    const now = nowIso()
    const durationSeconds =
      input.durationSeconds ??
      (input.endedAt
        ? Math.round((new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 1000)
        : 0)

    const row: TimeEntryRow = {
      id: nanoid(),
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      description: input.description ?? null,
      startedAt: input.startedAt,
      endedAt: input.endedAt ?? null,
      durationSeconds,
      source: input.source ?? 'manual',
      createdAt: now,
      updatedAt: now
    }
    this.db.insert(timeEntries).values(row).run()
    if (input.tagIds && input.tagIds.length > 0) {
      this.db
        .insert(timeEntryTags)
        .values(input.tagIds.map((tagId) => ({ timeEntryId: row.id, tagId })))
        .run()
    }
    return toDomain(row, input.tagIds ?? [])
  }

  update(id: string, update: TimeEntryUpdate): TimeEntry {
    const existing = this.getOrThrow(id)
    const startedAt = update.startedAt ?? existing.startedAt
    const endedAt = update.endedAt !== undefined ? update.endedAt : existing.endedAt
    if (endedAt && !isValidRange(startedAt, endedAt)) {
      throw new ValidationError('End time must be after start time.')
    }

    const durationSeconds =
      update.durationSeconds ??
      (endedAt ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000) : existing.durationSeconds)

    const patch: Partial<TimeEntryRow> = {
      updatedAt: nowIso(),
      durationSeconds
    }
    if (update.projectId !== undefined) patch.projectId = update.projectId
    if (update.taskId !== undefined) patch.taskId = update.taskId
    if (update.description !== undefined) patch.description = update.description
    if (update.startedAt !== undefined) patch.startedAt = update.startedAt
    if (update.endedAt !== undefined) patch.endedAt = update.endedAt
    if (update.source !== undefined) patch.source = update.source

    this.db.update(timeEntries).set(patch).where(eq(timeEntries.id, id)).run()

    if (update.tagIds !== undefined) {
      this.db.delete(timeEntryTags).where(eq(timeEntryTags.timeEntryId, id)).run()
      if (update.tagIds.length > 0) {
        this.db
          .insert(timeEntryTags)
          .values(update.tagIds.map((tagId) => ({ timeEntryId: id, tagId })))
          .run()
      }
    }

    return this.getOrThrow(id)
  }

  delete(id: string): void {
    this.getOrThrow(id)
    this.db.delete(timeEntries).where(eq(timeEntries.id, id)).run()
  }

  /** Used to restore an undo-deleted entry with its original id preserved. */
  restore(entry: TimeEntry): TimeEntry {
    const row: TimeEntryRow = {
      id: entry.id,
      projectId: entry.projectId,
      taskId: entry.taskId,
      description: entry.description,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      durationSeconds: entry.durationSeconds,
      source: entry.source,
      createdAt: entry.createdAt,
      updatedAt: nowIso()
    }
    this.db.insert(timeEntries).values(row).run()
    if (entry.tagIds.length > 0) {
      this.db
        .insert(timeEntryTags)
        .values(entry.tagIds.map((tagId) => ({ timeEntryId: row.id, tagId })))
        .run()
    }
    return toDomain(row, entry.tagIds)
  }
}
