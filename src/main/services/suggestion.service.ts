import type { ProjectRepository } from '@main/repositories/project.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import type { SmartSuggestion } from '@shared/types/domain'

const LOOKBACK_DAYS = 60
const HOUR_WINDOW = 1

/**
 * Ranks "probably interesting next task" locally, from recency + frequency +
 * current-project match + habitual hour-of-day. No external service, no ML —
 * every point in the score is explainable in the UI tooltip.
 */
export class SuggestionService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository
  ) {}

  getSuggestions(params: {
    currentProjectId: string | null
    limit?: number
    now?: Date
  }): SmartSuggestion[] {
    const now = params.now ?? new Date()
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000)
    const entries = this.timeEntries.listInRange({
      startDate: since.toISOString(),
      endDate: now.toISOString()
    })

    interface Aggregate {
      projectId: string
      taskId: string | null
      count: number
      lastUsedMs: number
      hourMatches: number
    }
    const byKey = new Map<string, Aggregate>()

    for (const entry of entries) {
      const key = `${entry.projectId}::${entry.taskId ?? 'none'}`
      const hour = new Date(entry.startedAt).getHours()
      const agg = byKey.get(key) ?? {
        projectId: entry.projectId,
        taskId: entry.taskId,
        count: 0,
        lastUsedMs: 0,
        hourMatches: 0
      }
      agg.count += 1
      agg.lastUsedMs = Math.max(agg.lastUsedMs, new Date(entry.startedAt).getTime())
      if (Math.abs(hour - now.getHours()) <= HOUR_WINDOW) agg.hourMatches += 1
      byKey.set(key, agg)
    }

    const suggestions: SmartSuggestion[] = []
    for (const agg of byKey.values()) {
      const project = this.projects.findById(agg.projectId)
      if (!project || project.isArchived) continue
      const task = agg.taskId ? this.tasks.findById(agg.taskId) : null
      if (agg.taskId && !task) continue

      const daysAgo = (now.getTime() - agg.lastUsedMs) / (24 * 3600 * 1000)
      const recencyScore = Math.max(0, 30 - daysAgo) // decays to 0 after 30 days
      const frequencyScore = Math.min(30, agg.count * 3)
      const currentProjectBonus = params.currentProjectId === agg.projectId ? 20 : 0
      const habitualHourBonus = Math.min(20, agg.hourMatches * 5)
      // Favorites are explicitly prioritised throughout the app (palette, tray, switcher).
      const favoriteBonus = (task?.isFavorite ?? project.isFavorite) ? 15 : 0

      suggestions.push({
        taskId: agg.taskId,
        taskName: task?.name ?? null,
        projectId: project.id,
        projectName: project.name,
        projectColor: project.color,
        score: Math.round(
          recencyScore + frequencyScore + currentProjectBonus + habitualHourBonus + favoriteBonus
        )
      })
    }

    return suggestions.sort((a, b) => b.score - a.score).slice(0, params.limit ?? 5)
  }
}
