import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { tags, timeEntryTags } from '@main/db/schema'
import { NotFoundError } from '@main/errors'
import { nowIso } from '@shared/utils/time'
import type { Tag, TagInput } from '@shared/types/domain'

const DEFAULT_TAG_COLOR = '#8B8FA3'

export class TagRepository {
  constructor(private readonly db: AppDatabase) {}

  list(): Tag[] {
    return this.db.select().from(tags).orderBy(tags.name).all()
  }

  findById(id: string): Tag | null {
    return this.db.select().from(tags).where(eq(tags.id, id)).get() ?? null
  }

  findByName(name: string): Tag | null {
    return this.db.select().from(tags).where(eq(tags.name, name)).get() ?? null
  }

  create(input: TagInput): Tag {
    const row: Tag = {
      id: nanoid(),
      name: input.name.trim(),
      color: input.color ?? DEFAULT_TAG_COLOR,
      createdAt: nowIso()
    }
    this.db.insert(tags).values(row).run()
    return row
  }

  findOrCreate(name: string): Tag {
    const existing = this.findByName(name)
    if (existing) return existing
    return this.create({ name })
  }

  delete(id: string): void {
    if (!this.findById(id)) throw new NotFoundError('Tag', id)
    this.db.delete(tags).where(eq(tags.id, id)).run()
  }

  tagIdsForEntry(timeEntryId: string): string[] {
    return this.db
      .select({ tagId: timeEntryTags.tagId })
      .from(timeEntryTags)
      .where(eq(timeEntryTags.timeEntryId, timeEntryId))
      .all()
      .map((r) => r.tagId)
  }

  setEntryTags(timeEntryId: string, tagIds: string[]): void {
    this.db.delete(timeEntryTags).where(eq(timeEntryTags.timeEntryId, timeEntryId)).run()
    if (tagIds.length === 0) return
    this.db
      .insert(timeEntryTags)
      .values(tagIds.map((tagId) => ({ timeEntryId, tagId })))
      .run()
  }
}
