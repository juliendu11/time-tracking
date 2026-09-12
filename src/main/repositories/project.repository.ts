import { desc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { projects } from '@main/db/schema'
import { NotFoundError } from '@main/errors'
import { nowIso } from '@shared/utils/time'
import type { Project, ProjectInput, ProjectStatus, ProjectUpdate } from '@shared/types/domain'

type ProjectRow = typeof projects.$inferSelect

function toDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    status: row.status as ProjectStatus,
    isFavorite: row.isFavorite,
    isArchived: row.isArchived,
    hourlyRate: row.hourlyRate,
    currency: row.currency,
    weeklyTargetMinutes: row.weeklyTargetMinutes,
    budgetMinutes: row.budgetMinutes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  }
}

const DEFAULT_COLORS = [
  '#7C6CF6',
  '#4CC9C0',
  '#F5A25D',
  '#EF6E8B',
  '#5AA9E6',
  '#9BD35A'
]

export class ProjectRepository {
  constructor(private readonly db: AppDatabase) {}

  list(options: { includeArchived?: boolean } = {}): Project[] {
    const rows = options.includeArchived
      ? this.db.select().from(projects).orderBy(desc(projects.isFavorite), projects.name).all()
      : this.db
          .select()
          .from(projects)
          .where(eq(projects.isArchived, false))
          .orderBy(desc(projects.isFavorite), projects.name)
          .all()
    return rows.map(toDomain)
  }

  findById(id: string): Project | null {
    const row = this.db.select().from(projects).where(eq(projects.id, id)).get()
    return row ? toDomain(row) : null
  }

  getOrThrow(id: string): Project {
    const project = this.findById(id)
    if (!project) throw new NotFoundError('Project', id)
    return project
  }

  create(input: ProjectInput): Project {
    const now = nowIso()
    const row = {
      id: nanoid(),
      name: input.name.trim(),
      description: input.description ?? null,
      color: input.color ?? pickColor(this.count()),
      icon: input.icon ?? 'folder',
      status: input.status ?? 'active',
      isFavorite: input.isFavorite ?? false,
      isArchived: false,
      hourlyRate: input.hourlyRate ?? null,
      currency: input.currency ?? null,
      weeklyTargetMinutes: input.weeklyTargetMinutes ?? null,
      budgetMinutes: input.budgetMinutes ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    }
    this.db.insert(projects).values(row).run()
    return toDomain(row)
  }

  update(id: string, update: ProjectUpdate): Project {
    this.getOrThrow(id)
    const patch: Partial<ProjectRow> = { ...update, updatedAt: nowIso() }
    this.db.update(projects).set(patch).where(eq(projects.id, id)).run()
    return this.getOrThrow(id)
  }

  setFavorite(id: string, isFavorite: boolean): Project {
    return this.update(id, { isFavorite })
  }

  archive(id: string): Project {
    this.getOrThrow(id)
    this.db
      .update(projects)
      .set({ isArchived: true, status: 'archived', archivedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(projects.id, id))
      .run()
    return this.getOrThrow(id)
  }

  restore(id: string): Project {
    this.getOrThrow(id)
    this.db
      .update(projects)
      .set({ isArchived: false, status: 'active', archivedAt: null, updatedAt: nowIso() })
      .where(eq(projects.id, id))
      .run()
    return this.getOrThrow(id)
  }

  /** Hard delete. Callers are responsible for confirming destructive intent. */
  delete(id: string): void {
    this.getOrThrow(id)
    this.db.delete(projects).where(eq(projects.id, id)).run()
  }

  count(): number {
    return this.db.select().from(projects).where(eq(projects.isArchived, false)).all().length
  }
}

function pickColor(index: number): string {
  return DEFAULT_COLORS[index % DEFAULT_COLORS.length] ?? '#7C6CF6'
}
