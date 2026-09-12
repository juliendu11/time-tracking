/**
 * Timezone-aware time helpers shared by main and renderer.
 *
 * Timestamps are stored as UTC ISO-8601 strings. All "day"/"week" boundary
 * logic below intentionally uses the JS runtime's local timezone (via native
 * Date getters), because that is what a human means by "today" or "this
 * week". date-fns is used for calendar-safe arithmetic (DST, month length).
 */
import { addDays, differenceInSeconds, startOfDay, startOfWeek } from 'date-fns'

export interface DaySegment {
  /** Local calendar date, formatted yyyy-MM-dd. */
  date: string
  seconds: number
}

/** yyyy-MM-dd in local time, without going through a formatting library. */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Splits a [start, end) interval into per-local-day segments. A session
 * spanning 23:30 -> 01:30 contributes 30 minutes to day 1 and 1h30 to day 2.
 */
export function splitDurationByLocalDay(
  startedAt: Date | string,
  endedAt: Date | string
): DaySegment[] {
  const start = new Date(startedAt)
  const end = new Date(endedAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  if (end.getTime() <= start.getTime()) return []

  const segments: DaySegment[] = []
  let cursor = start

  // Safety bound: never iterate more than ~10 years worth of days.
  let guard = 0
  while (cursor.getTime() < end.getTime() && guard < 3650) {
    guard += 1
    const dayStart = startOfDay(cursor)
    const nextDayStart = addDays(dayStart, 1)
    const segmentEnd =
      nextDayStart.getTime() < end.getTime() ? nextDayStart : end
    const seconds = differenceInSeconds(segmentEnd, cursor)
    if (seconds > 0) {
      segments.push({ date: toLocalDateKey(cursor), seconds })
    }
    cursor = segmentEnd
  }

  return segments
}

export function getLocalDayRange(reference: Date): { start: Date; end: Date } {
  const start = startOfDay(reference)
  return { start, end: addDays(start, 1) }
}

export function getLocalWeekRange(
  reference: Date,
  weekStartsOn: 0 | 1
): { start: Date; end: Date } {
  const start = startOfWeek(reference, { weekStartsOn })
  const end = addDays(start, 7)
  return { start, end }
}

/**
 * Elapsed seconds for a running/paused timer, derived purely from
 * timestamps (never from an incrementing counter) so it stays correct
 * across page changes, app restarts, and sleep.
 */
export function computeElapsedSeconds(params: {
  startedAt: string
  accumulatedPauseSeconds: number
  pausedAt: string | null
  now?: Date
}): number {
  const { startedAt, accumulatedPauseSeconds, pausedAt, now = new Date() } =
    params
  const start = new Date(startedAt).getTime()
  const end = pausedAt ? new Date(pausedAt).getTime() : now.getTime()
  const raw = Math.floor((end - start) / 1000)
  return Math.max(0, raw - accumulatedPauseSeconds)
}

export function clampIsoDate(value: string): string {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid ISO date: ${value}`)
  }
  return d.toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function isValidRange(startedAt: string, endedAt: string | null): boolean {
  if (endedAt === null) return true
  return new Date(endedAt).getTime() > new Date(startedAt).getTime()
}

/** Half-open interval overlap check: [aStart, aEnd) intersects [bStart, bEnd). */
export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const as = new Date(aStart).getTime()
  const ae = new Date(aEnd).getTime()
  const bs = new Date(bStart).getTime()
  const be = new Date(bEnd).getTime()
  return as < be && bs < ae
}
