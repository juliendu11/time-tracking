import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestEnvironment, type TestEnvironment } from '../helpers/setupDb'

let env: TestEnvironment

beforeEach(() => {
  env = setupTestEnvironment()
})

describe('ReportService', () => {
  it('computes today/week totals for the dashboard summary', () => {
    const project = env.projects.create({ name: 'Habits Hero' })
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 3600_000)
    env.timeEntries.create({
      projectId: project.id,
      startedAt: oneHourAgo.toISOString(),
      endedAt: now.toISOString(),
      source: 'manual'
    })

    const summary = env.reports.getDashboardSummary(now, null)
    expect(summary.todaySeconds).toBeGreaterThanOrEqual(3599)
    expect(summary.weekSeconds).toBeGreaterThanOrEqual(3599)
  })

  it('splits a midnight-crossing entry across two days in the heatmap', () => {
    const project = env.projects.create({ name: 'Habits Hero' })
    const start = new Date(2026, 2, 10, 23, 30, 0)
    const end = new Date(2026, 2, 11, 1, 30, 0)
    env.timeEntries.create({
      projectId: project.id,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      source: 'manual'
    })

    const heatmap = env.reports.getHeatmap(end, 1)
    const day1 = heatmap.find((d) => d.date === toKey(start))
    const day2 = heatmap.find((d) => d.date === toKey(end))
    expect(day1?.durationSeconds).toBe(30 * 60)
    expect(day2?.durationSeconds).toBe(90 * 60)
  })

  it('groups report rows by project', () => {
    const projectA = env.projects.create({ name: 'Habits Hero' })
    const projectB = env.projects.create({ name: 'Marketing' })
    const now = new Date()

    env.timeEntries.create({
      projectId: projectA.id,
      startedAt: new Date(now.getTime() - 2 * 3600_000).toISOString(),
      endedAt: new Date(now.getTime() - 1 * 3600_000).toISOString(),
      source: 'manual'
    })
    env.timeEntries.create({
      projectId: projectB.id,
      startedAt: new Date(now.getTime() - 1 * 3600_000).toISOString(),
      endedAt: now.toISOString(),
      source: 'manual'
    })

    const result = env.reports.runReport(
      {
        startDate: new Date(now.getTime() - 24 * 3600_000).toISOString(),
        endDate: new Date(now.getTime() + 3600_000).toISOString()
      },
      'project'
    )

    expect(result.totalSessions).toBe(2)
    expect(result.groups).toHaveLength(2)
    expect(result.groups.map((g) => g.label).sort()).toEqual(['Habits Hero', 'Marketing'])
  })

  it('builds a weekly timesheet grid split by day', () => {
    const project = env.projects.create({ name: 'Habits Hero' })
    const task = env.tasks.create({ projectId: project.id, name: 'Notifications' })
    const monday = nextMonday()
    const tuesday = new Date(monday.getTime() + 24 * 3600_000)

    env.timeEntries.create({
      projectId: project.id,
      taskId: task.id,
      startedAt: new Date(monday.getTime() + 9 * 3600_000).toISOString(),
      endedAt: new Date(monday.getTime() + 11 * 3600_000).toISOString(),
      source: 'manual'
    })
    env.timeEntries.create({
      projectId: project.id,
      taskId: task.id,
      startedAt: new Date(tuesday.getTime() + 9 * 3600_000).toISOString(),
      endedAt: new Date(tuesday.getTime() + 10 * 3600_000).toISOString(),
      source: 'manual'
    })

    const week = env.reports.getTimesheetWeek(monday, 1)
    expect(week.rows).toHaveLength(1)
    expect(week.rows[0]?.totalSeconds).toBe(3 * 3600)
    expect(week.weekTotalSeconds).toBe(3 * 3600)
  })
})

function toKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function nextMonday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (8 - day) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}
