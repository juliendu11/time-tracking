import type { ProjectRepository } from '@main/repositories/project.repository'
import type { TagRepository } from '@main/repositories/tag.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { logger } from '@main/logger'

interface SeedProjectSpec {
  name: string
  color: string
  icon: string
  hourlyRate?: number
  weeklyTargetMinutes?: number
  tasks: string[]
}

const SEED_PROJECTS: SeedProjectSpec[] = [
  {
    name: 'Habits Hero',
    color: '#7C6CF6',
    icon: 'sparkles',
    weeklyTargetMinutes: 900,
    tasks: ['Onboarding redesign', 'Push notifications', 'Analytics dashboard', 'Bug fixing']
  },
  {
    name: 'Marketing',
    color: '#4CC9C0',
    icon: 'megaphone',
    tasks: ['Content calendar', 'Landing page', 'Newsletter']
  },
  {
    name: 'KDP',
    color: '#F5A25D',
    icon: 'book-open',
    tasks: ['Cover design', 'Manuscript editing', 'Keyword research']
  }
]

const DESCRIPTIONS = [
  'Deep work session',
  'Quick fix',
  'Pairing session',
  'Research',
  'Client call notes',
  null
]

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: T[]): T {
  const index = randomInt(0, items.length - 1)
  return items[index] as T
}

/**
 * Development-only demo data generator (roughly 6 months of realistic time
 * entries) so the dashboards/heatmap can be exercised visually. Never wired
 * into a production build.
 */
export class SeedService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository,
    private readonly tags: TagRepository
  ) {}

  run(): void {
    logger.warn('Seeding demo data (development only)')
    const tagNames = ['coding', 'meeting', 'research', 'design', 'admin', 'bug']
    const tagIds = tagNames.map((name) => this.tags.findOrCreate(name).id)

    for (const spec of SEED_PROJECTS) {
      const project = this.projects.create({
        name: spec.name,
        color: spec.color,
        icon: spec.icon,
        hourlyRate: spec.hourlyRate ?? null,
        weeklyTargetMinutes: spec.weeklyTargetMinutes ?? null
      })

      const taskIds = spec.tasks.map(
        (name) => this.tasks.create({ projectId: project.id, name }).id
      )

      this.generateHistory(project.id, taskIds, tagIds)
    }

    logger.warn('Demo data seeding complete')
  }

  private generateHistory(projectId: string, taskIds: string[], tagIds: string[]): void {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let dayOffset = 0; dayOffset < 182; dayOffset += 1) {
      const day = new Date(today.getTime() - dayOffset * 24 * 3600 * 1000)
      const weekday = day.getDay()
      const isWeekend = weekday === 0 || weekday === 6
      // Skip most weekends and a random chunk of weekdays for a realistic,
      // non-uniform heatmap instead of a suspiciously perfect grid.
      if (isWeekend && Math.random() > 0.2) continue
      if (!isWeekend && Math.random() > 0.85) continue

      const sessions = randomInt(1, 3)
      let cursorHour = randomInt(8, 11)

      for (let s = 0; s < sessions; s += 1) {
        const durationMinutes = randomInt(20, 150)
        const startedAt = new Date(day)
        startedAt.setHours(cursorHour, randomInt(0, 59), 0, 0)
        const endedAt = new Date(startedAt.getTime() + durationMinutes * 60_000)

        this.timeEntries.create({
          projectId,
          taskId: Math.random() > 0.15 ? pick(taskIds) : null,
          description: pick(DESCRIPTIONS),
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          source: 'import',
          tagIds: Math.random() > 0.5 ? [pick(tagIds)] : []
        })

        cursorHour += Math.ceil(durationMinutes / 60) + randomInt(1, 3)
        if (cursorHour > 20) break
      }
    }
  }
}
