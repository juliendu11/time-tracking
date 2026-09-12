import type { ProjectRepository } from '@main/repositories/project.repository'
import type { TagRepository } from '@main/repositories/tag.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import type { SearchResultItem } from '@shared/types/domain'

export class SearchService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository,
    private readonly tags: TagRepository
  ) {}

  search(query: string, limit = 30): SearchResultItem[] {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return []

    const results: SearchResultItem[] = []
    const allProjects = this.projects.list({ includeArchived: true })
    const projectById = new Map(allProjects.map((p) => [p.id, p]))

    for (const project of allProjects) {
      if (project.name.toLowerCase().includes(q)) {
        results.push({ kind: 'project', id: project.id, title: project.name, subtitle: null })
      }
    }

    for (const project of allProjects) {
      for (const task of this.tasks.listByProject(project.id, { includeArchived: true })) {
        if (task.name.toLowerCase().includes(q)) {
          results.push({ kind: 'task', id: task.id, title: task.name, subtitle: project.name })
        }
      }
    }

    for (const tag of this.tags.list()) {
      if (tag.name.toLowerCase().includes(q)) {
        results.push({ kind: 'tag', id: tag.id, title: tag.name, subtitle: null })
      }
    }

    for (const entry of this.timeEntries.searchByDescription(q, 50)) {
      if (!entry.description) continue
      const project = projectById.get(entry.projectId)
      results.push({
        kind: 'timeEntry',
        id: entry.id,
        title: entry.description,
        subtitle: project?.name ?? null
      })
    }

    return results.slice(0, limit)
  }
}
