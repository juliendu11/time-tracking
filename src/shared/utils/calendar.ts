/**
 * Month calendar helpers shared by the renderer's Calendar page.
 *
 * Like the rest of `time.ts`, day boundaries use the runtime's local
 * timezone, and date-fns handles calendar arithmetic (DST, month length).
 */
import { addDays, addMonths, startOfMonth, startOfWeek } from 'date-fns'
import type { TimeEntry } from '@shared/types/domain'
import { splitDurationByLocalDay, toLocalDateKey } from './time'

export interface CalendarDay {
  /** Local calendar date, formatted yyyy-MM-dd. */
  date: string
  dayOfMonth: number
  inMonth: boolean
  /** Completed entries that overlap this day, ordered by start. */
  entries: TimeEntry[]
  /** Seconds tracked on this day only (multi-day entries are split). */
  totalSeconds: number
}

/**
 * Visible range for a month grid: always 6 full weeks starting on the
 * configured week start, so the layout never jumps between months.
 */
export function getMonthGridRange(
  reference: Date,
  weekStartsOn: 0 | 1
): { start: Date; end: Date } {
  const start = startOfWeek(startOfMonth(reference), { weekStartsOn })
  return { start, end: addDays(start, 42) }
}

export function buildMonthGrid(
  reference: Date,
  weekStartsOn: 0 | 1,
  entries: TimeEntry[]
): CalendarDay[] {
  const { start } = getMonthGridRange(reference, weekStartsOn)
  const month = startOfMonth(reference).getMonth()

  const days: CalendarDay[] = []
  const byKey = new Map<string, CalendarDay>()
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(start, i)
    const day: CalendarDay = {
      date: toLocalDateKey(date),
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === month,
      entries: [],
      totalSeconds: 0
    }
    days.push(day)
    byKey.set(day.date, day)
  }

  const sorted = [...entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  for (const entry of sorted) {
    if (!entry.endedAt) continue
    for (const segment of splitDurationByLocalDay(entry.startedAt, entry.endedAt)) {
      const day = byKey.get(segment.date)
      if (!day) continue
      day.entries.push(entry)
      day.totalSeconds += segment.seconds
    }
  }

  return days
}

export function shiftMonth(reference: Date, delta: number): Date {
  return addMonths(startOfMonth(reference), delta)
}
