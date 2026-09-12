import type { ProjectRepository } from '@main/repositories/project.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { getLocalDayRange, getLocalWeekRange, splitDurationByLocalDay, toLocalDateKey } from '@shared/utils/time'
import { addDays, addMonths, differenceInCalendarDays, subDays } from 'date-fns'
import type {
  AdditionalMetrics,
  DailyBucket,
  DashboardSummary,
  FocusScoreBreakdown,
  HeatmapDay,
  ProjectDistributionSlice,
  ProjectStats,
  ReportFilter,
  ReportGroupBy,
  ReportGroupRow,
  ReportResult,
  TimeEntry,
  TimesheetWeek,
  TopTaskEntry,
  WeekStartsOn
} from '@shared/types/domain'

interface EffectiveEntry {
  entry: TimeEntry
  effectiveSeconds: number
  effectiveEndedAt: string
}

/** Clips a stored entry to the query window and returns the seconds inside it. */
function effectiveSecondsInRange(entry: TimeEntry, rangeStart: Date, rangeEnd: Date): number {
  if (!entry.endedAt) return 0
  const start = Math.max(new Date(entry.startedAt).getTime(), rangeStart.getTime())
  const end = Math.min(new Date(entry.endedAt).getTime(), rangeEnd.getTime())
  return Math.max(0, Math.round((end - start) / 1000))
}

export class ReportService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository,
    private readonly weekStartsOn: () => WeekStartsOn
  ) {}

  private entriesBetween(start: Date, end: Date): TimeEntry[] {
    return this.timeEntries.listInRange({
      startDate: start.toISOString(),
      endDate: end.toISOString()
    })
  }

  private totalSecondsBetween(start: Date, end: Date, projectId?: string): number {
    return this.entriesBetween(start, end)
      .filter((e) => !projectId || e.projectId === projectId)
      .reduce((sum, e) => sum + effectiveSecondsInRange(e, start, end), 0)
  }

  getDashboardSummary(reference: Date, weeklyGoalMinutes: number | null): DashboardSummary {
    const today = getLocalDayRange(reference)
    const week = getLocalWeekRange(reference, this.weekStartsOn())
    const previousWeekStart = subDays(week.start, 7)
    const previousWeekEnd = subDays(week.end, 7)

    const todaySeconds = this.totalSecondsBetween(today.start, today.end)
    const weekSeconds = this.totalSecondsBetween(week.start, week.end)
    const previousWeekSeconds = this.totalSecondsBetween(previousWeekStart, previousWeekEnd)

    const changeVsLastWeekPercent =
      previousWeekSeconds > 0
        ? ((weekSeconds - previousWeekSeconds) / previousWeekSeconds) * 100
        : null

    return {
      todaySeconds,
      weekSeconds,
      weeklyGoalMinutes,
      previousWeekSeconds,
      changeVsLastWeekPercent
    }
  }

  getProjectStats(projectId: string, reference: Date): ProjectStats {
    const project = this.projects.getOrThrow(projectId)
    const today = getLocalDayRange(reference)
    const week = getLocalWeekRange(reference, this.weekStartsOn())
    const monthStart = addMonths(reference, 0)
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = addMonths(monthStart, 1)

    const allEntries = this.timeEntries.listInRange({
      startDate: '1970-01-01T00:00:00.000Z',
      endDate: new Date(reference.getTime() + 24 * 3600 * 1000).toISOString(),
      projectIds: [projectId]
    })

    const sessionsIn = (start: Date, end: Date): number =>
      allEntries.filter((e) => new Date(e.startedAt) >= start && new Date(e.startedAt) < end).length

    const todaySeconds = this.totalSecondsBetween(today.start, today.end, projectId)
    const weekSeconds = this.totalSecondsBetween(week.start, week.end, projectId)
    const monthSeconds = this.totalSecondsBetween(monthStart, monthEnd, projectId)
    const allTimeSeconds = allEntries.reduce((sum, e) => sum + e.durationSeconds, 0)

    const goalPercentage = project.weeklyTargetMinutes
      ? Math.round((weekSeconds / 60 / project.weeklyTargetMinutes) * 100)
      : null

    const budgetPercentage = project.budgetMinutes
      ? Math.round((allTimeSeconds / 60 / project.budgetMinutes) * 100)
      : null

    return {
      today: { durationSeconds: todaySeconds, sessions: sessionsIn(today.start, today.end) },
      week: {
        durationSeconds: weekSeconds,
        sessions: sessionsIn(week.start, week.end),
        goalPercentage
      },
      month: { durationSeconds: monthSeconds, sessions: sessionsIn(monthStart, monthEnd) },
      allTime: { durationSeconds: allTimeSeconds, sessions: allEntries.length },
      budgetPercentage
    }
  }

  getLastNDaysBuckets(reference: Date, days: number): DailyBucket[] {
    const start = subDays(getLocalDayRange(reference).start, days - 1)
    const end = getLocalDayRange(reference).end
    const entries = this.entriesBetween(start, end)

    const byDay = new Map<string, number>()
    let cursor = start
    while (cursor < end) {
      byDay.set(toLocalDateKey(cursor), 0)
      cursor = addDays(cursor, 1)
    }

    for (const entry of entries) {
      if (!entry.endedAt) continue
      for (const seg of splitDurationByLocalDay(entry.startedAt, entry.endedAt)) {
        if (byDay.has(seg.date)) byDay.set(seg.date, (byDay.get(seg.date) ?? 0) + seg.seconds)
      }
    }

    return Array.from(byDay.entries()).map(([date, durationSeconds]) => ({ date, durationSeconds }))
  }

  getHeatmap(reference: Date, months: number, projectId?: string): HeatmapDay[] {
    const end = getLocalDayRange(reference).end
    const start = addMonths(end, -months)
    const filter = projectId ? { projectIds: [projectId] } : {}
    const entries = this.timeEntries.listInRange({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      ...filter
    })

    const byDay = new Map<string, { seconds: number; sessions: Set<string>; projects: Set<string> }>()

    for (const entry of entries) {
      if (!entry.endedAt) continue
      for (const seg of splitDurationByLocalDay(entry.startedAt, entry.endedAt)) {
        const bucket = byDay.get(seg.date) ?? {
          seconds: 0,
          sessions: new Set<string>(),
          projects: new Set<string>()
        }
        bucket.seconds += seg.seconds
        bucket.sessions.add(entry.id)
        bucket.projects.add(entry.projectId)
        byDay.set(seg.date, bucket)
      }
    }

    const result: HeatmapDay[] = []
    let cursor = start
    while (cursor < end) {
      const key = toLocalDateKey(cursor)
      const bucket = byDay.get(key)
      result.push({
        date: key,
        durationSeconds: bucket?.seconds ?? 0,
        sessions: bucket?.sessions.size ?? 0,
        projectCount: bucket?.projects.size ?? 0
      })
      cursor = addDays(cursor, 1)
    }
    return result
  }

  getProjectDistribution(start: Date, end: Date): ProjectDistributionSlice[] {
    const entries = this.entriesBetween(start, end)
    const byProject = new Map<string, number>()
    for (const entry of entries) {
      const seconds = effectiveSecondsInRange(entry, start, end)
      byProject.set(entry.projectId, (byProject.get(entry.projectId) ?? 0) + seconds)
    }
    const total = Array.from(byProject.values()).reduce((a, b) => a + b, 0)
    const slices: ProjectDistributionSlice[] = []
    for (const [projectId, durationSeconds] of byProject.entries()) {
      const project = this.projects.findById(projectId)
      if (!project) continue
      slices.push({
        projectId,
        projectName: project.name,
        color: project.color,
        durationSeconds,
        percentage: total > 0 ? Math.round((durationSeconds / total) * 1000) / 10 : 0
      })
    }
    return slices.sort((a, b) => b.durationSeconds - a.durationSeconds)
  }

  getTopTasks(start: Date, end: Date, limit: number): TopTaskEntry[] {
    const entries = this.entriesBetween(start, end).filter((e) => e.taskId)
    const byTask = new Map<string, number>()
    for (const entry of entries) {
      const seconds = effectiveSecondsInRange(entry, start, end)
      byTask.set(entry.taskId as string, (byTask.get(entry.taskId as string) ?? 0) + seconds)
    }
    const rows: TopTaskEntry[] = []
    for (const [taskId, durationSeconds] of byTask.entries()) {
      const task = this.tasks.findById(taskId)
      if (!task) continue
      const project = this.projects.findById(task.projectId)
      if (!project) continue
      rows.push({
        taskId,
        taskName: task.name,
        projectId: project.id,
        projectName: project.name,
        durationSeconds
      })
    }
    return rows.sort((a, b) => b.durationSeconds - a.durationSeconds).slice(0, limit)
  }

  getAdditionalMetrics(reference: Date, streakThresholdMinutes: number): AdditionalMetrics {
    const week = getLocalWeekRange(reference, this.weekStartsOn())
    const today = getLocalDayRange(reference)
    const weekEntries = this.entriesBetween(week.start, week.end).filter((e) => e.endedAt)

    const byDay = new Map<string, number>()
    for (const entry of weekEntries) {
      for (const seg of splitDurationByLocalDay(entry.startedAt, entry.endedAt as string)) {
        byDay.set(seg.date, (byDay.get(seg.date) ?? 0) + seg.seconds)
      }
    }
    const workedDays = Array.from(byDay.values()).filter((s) => s > 0)
    const dailyAverageSeconds =
      workedDays.length > 0 ? Math.round(workedDays.reduce((a, b) => a + b, 0) / workedDays.length) : 0

    const longestSessionSeconds = weekEntries.reduce(
      (max, e) => Math.max(max, e.durationSeconds),
      0
    )

    const sessionsToday = this.entriesBetween(today.start, today.end).length
    const sessionsWeek = weekEntries.length
    const activeDaysWeek = workedDays.length

    const currentStreakDays = this.computeStreak(reference, streakThresholdMinutes)

    const byWeekday = new Map<number, number>()
    const last8Weeks = this.entriesBetween(subDays(week.start, 56), week.end).filter((e) => e.endedAt)
    for (const entry of last8Weeks) {
      for (const seg of splitDurationByLocalDay(entry.startedAt, entry.endedAt as string)) {
        const weekday = new Date(`${seg.date}T00:00:00`).getDay()
        byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + seg.seconds)
      }
    }
    let mostProductiveWeekday: number | null = null
    let bestWeekdaySeconds = 0
    for (const [weekday, seconds] of byWeekday.entries()) {
      if (seconds > bestWeekdaySeconds) {
        bestWeekdaySeconds = seconds
        mostProductiveWeekday = weekday
      }
    }

    const byHour = new Map<number, number>()
    for (const entry of last8Weeks) {
      const hour = new Date(entry.startedAt).getHours()
      byHour.set(hour, (byHour.get(hour) ?? 0) + entry.durationSeconds)
    }
    let mostProductiveHourRange: { startHour: number; endHour: number } | null = null
    let bestHourSeconds = 0
    for (const [hour, seconds] of byHour.entries()) {
      if (seconds > bestHourSeconds) {
        bestHourSeconds = seconds
        mostProductiveHourRange = { startHour: hour, endHour: (hour + 3) % 24 }
      }
    }

    // Consistency: how evenly time is spread across the week's active days,
    // expressed as 100% minus the coefficient of variation (clamped to 0-100).
    let weeklyConsistencyPercent: number | null = null
    if (workedDays.length >= 2) {
      const mean = dailyAverageSeconds
      const variance =
        workedDays.reduce((sum, s) => sum + (s - mean) ** 2, 0) / workedDays.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = mean > 0 ? stdDev / mean : 1
      weeklyConsistencyPercent = Math.max(0, Math.round((1 - coefficientOfVariation) * 100))
    }

    return {
      dailyAverageSeconds,
      longestSessionSeconds,
      sessionsToday,
      sessionsWeek,
      activeDaysWeek,
      currentStreakDays,
      mostProductiveWeekday,
      mostProductiveHourRange,
      weeklyConsistencyPercent
    }
  }

  private computeStreak(reference: Date, thresholdMinutes: number): number {
    let streak = 0
    let cursor = getLocalDayRange(reference)
    for (let i = 0; i < 365; i += 1) {
      const seconds = this.totalSecondsBetween(cursor.start, cursor.end)
      if (seconds >= thresholdMinutes * 60) {
        streak += 1
        const prevStart = subDays(cursor.start, 1)
        cursor = { start: prevStart, end: cursor.start }
      } else {
        break
      }
    }
    return streak
  }

  getFocusScore(reference: Date, dailyGoalMinutes: number | null): FocusScoreBreakdown {
    const today = getLocalDayRange(reference)
    const entries = this.entriesBetween(today.start, today.end).filter((e) => e.endedAt)

    if (entries.length === 0) {
      return {
        score: 0,
        averageSessionMinutes: 0,
        interruptionCount: 0,
        dailyGoalReached: false,
        fragmentationPenalty: 0
      }
    }

    const totalSeconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0)
    const averageSessionMinutes = Math.round(totalSeconds / entries.length / 60)
    const interruptionCount = Math.max(0, entries.length - 1)
    const dailyGoalReached = dailyGoalMinutes ? totalSeconds / 60 >= dailyGoalMinutes : false

    // Fragmentation: more, shorter sessions reduce the score.
    const fragmentationPenalty = Math.min(40, interruptionCount * 4)
    const sessionLengthScore = Math.min(40, Math.round((averageSessionMinutes / 50) * 40))
    const goalScore = dailyGoalReached ? 30 : Math.round((totalSeconds / 60 / (dailyGoalMinutes ?? 480)) * 30)
    const score = Math.max(
      0,
      Math.min(100, sessionLengthScore + Math.min(30, goalScore) + 30 - fragmentationPenalty)
    )

    return { score, averageSessionMinutes, interruptionCount, dailyGoalReached, fragmentationPenalty }
  }

  runReport(filter: ReportFilter, groupBy: ReportGroupBy): ReportResult {
    const start = new Date(filter.startDate)
    const end = new Date(filter.endDate)
    const entries = this.timeEntries.listInRange(filter).filter((e) => e.endedAt)

    const effective: EffectiveEntry[] = entries.map((entry) => ({
      entry,
      effectiveSeconds: effectiveSecondsInRange(entry, start, end),
      effectiveEndedAt: entry.endedAt as string
    }))

    const totalSeconds = effective.reduce((sum, e) => sum + e.effectiveSeconds, 0)
    const totalSessions = effective.length
    const averageSessionSeconds = totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0

    const groups = this.groupEntries(effective, groupBy)

    const byProject = new Map<string, number>()
    const byTask = new Map<string, number>()
    for (const { entry, effectiveSeconds } of effective) {
      byProject.set(entry.projectId, (byProject.get(entry.projectId) ?? 0) + effectiveSeconds)
      if (entry.taskId) byTask.set(entry.taskId, (byTask.get(entry.taskId) ?? 0) + effectiveSeconds)
    }

    const topProjectEntry = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0]
    const topTaskEntry = [...byTask.entries()].sort((a, b) => b[1] - a[1])[0]

    const topProject = topProjectEntry
      ? {
          id: topProjectEntry[0],
          name: this.projects.findById(topProjectEntry[0])?.name ?? 'Unknown',
          durationSeconds: topProjectEntry[1]
        }
      : null
    const topTask = topTaskEntry
      ? {
          id: topTaskEntry[0],
          name: this.tasks.findById(topTaskEntry[0])?.name ?? 'Unknown',
          durationSeconds: topTaskEntry[1]
        }
      : null

    return { totalSeconds, totalSessions, averageSessionSeconds, topProject, topTask, groups }
  }

  private groupEntries(effective: EffectiveEntry[], groupBy: ReportGroupBy): ReportGroupRow[] {
    const groups = new Map<string, { label: string; seconds: number; sessions: number }>()

    for (const { entry, effectiveSeconds } of effective) {
      const keys = this.groupKeysFor(entry, groupBy)
      for (const { key, label } of keys) {
        const g = groups.get(key) ?? { label, seconds: 0, sessions: 0 }
        g.seconds += effectiveSeconds
        g.sessions += 1
        groups.set(key, g)
      }
    }

    return Array.from(groups.entries())
      .map(([key, g]) => ({
        key,
        label: g.label,
        durationSeconds: g.seconds,
        sessions: g.sessions,
        averageSessionSeconds: g.sessions > 0 ? Math.round(g.seconds / g.sessions) : 0
      }))
      .sort((a, b) => b.durationSeconds - a.durationSeconds)
  }

  private groupKeysFor(
    entry: TimeEntry,
    groupBy: ReportGroupBy
  ): Array<{ key: string; label: string }> {
    switch (groupBy) {
      case 'project': {
        const project = this.projects.findById(entry.projectId)
        return [{ key: entry.projectId, label: project?.name ?? 'Unknown project' }]
      }
      case 'task': {
        if (!entry.taskId) return [{ key: 'no-task', label: 'No task' }]
        const task = this.tasks.findById(entry.taskId)
        return [{ key: entry.taskId, label: task?.name ?? 'Unknown task' }]
      }
      case 'day': {
        const key = toLocalDateKey(new Date(entry.startedAt))
        return [{ key, label: key }]
      }
      case 'week': {
        const weekStart = getLocalWeekRange(new Date(entry.startedAt), 1).start
        const key = toLocalDateKey(weekStart)
        return [{ key, label: `Week of ${key}` }]
      }
      case 'month': {
        const d = new Date(entry.startedAt)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return [{ key, label: key }]
      }
      case 'tag': {
        if (entry.tagIds.length === 0) return [{ key: 'no-tag', label: 'No tag' }]
        return entry.tagIds.map((tagId) => ({ key: tagId, label: tagId }))
      }
      default:
        return [{ key: 'all', label: 'All' }]
    }
  }

  getTimesheetWeek(weekStart: Date, weekStartsOn: WeekStartsOn): TimesheetWeek {
    const start = getLocalWeekRange(weekStart, weekStartsOn).start
    const end = getLocalWeekRange(weekStart, weekStartsOn).end
    const entries = this.entriesBetween(start, end).filter((e) => e.endedAt)

    const dayKeys: string[] = []
    let cursor = start
    while (cursor < end) {
      dayKeys.push(toLocalDateKey(cursor))
      cursor = addDays(cursor, 1)
    }

    const rowMap = new Map<
      string,
      { projectId: string; taskId: string | null; cells: Record<string, number> }
    >()

    for (const entry of entries) {
      const rowKey = `${entry.projectId}::${entry.taskId ?? 'none'}`
      const row = rowMap.get(rowKey) ?? {
        projectId: entry.projectId,
        taskId: entry.taskId,
        cells: Object.fromEntries(dayKeys.map((d) => [d, 0]))
      }
      for (const seg of splitDurationByLocalDay(entry.startedAt, entry.endedAt as string)) {
        if (seg.date in row.cells) row.cells[seg.date] = (row.cells[seg.date] ?? 0) + seg.seconds
      }
      rowMap.set(rowKey, row)
    }

    const rows = Array.from(rowMap.values()).map((row) => {
      const project = this.projects.findById(row.projectId)
      const task = row.taskId ? this.tasks.findById(row.taskId) : null
      const totalSeconds = Object.values(row.cells).reduce((a, b) => a + b, 0)
      return {
        projectId: row.projectId,
        projectName: project?.name ?? 'Unknown',
        projectColor: project?.color ?? '#888888',
        taskId: row.taskId,
        taskName: task?.name ?? null,
        cells: row.cells,
        totalSeconds
      }
    })

    const dailyTotals: Record<string, number> = Object.fromEntries(dayKeys.map((d) => [d, 0]))
    for (const row of rows) {
      for (const [day, seconds] of Object.entries(row.cells)) {
        dailyTotals[day] = (dailyTotals[day] ?? 0) + seconds
      }
    }

    return {
      weekStart: toLocalDateKey(start),
      weekEnd: toLocalDateKey(subDays(end, 1)),
      rows: rows.sort((a, b) => b.totalSeconds - a.totalSeconds),
      dailyTotals,
      weekTotalSeconds: Object.values(dailyTotals).reduce((a, b) => a + b, 0)
    }
  }
}

export function calendarDaysBetween(a: Date, b: Date): number {
  return differenceInCalendarDays(b, a)
}
