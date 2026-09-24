import { describe, expect, it } from 'vitest'
import type { TimeEntry } from '@shared/types/domain'
import { buildMonthGrid, getMonthGridRange, shiftMonth } from '@shared/utils/calendar'
import { toLocalDateKey } from '@shared/utils/time'

function entry(id: string, start: Date, end: Date | null): TimeEntry {
  return {
    id,
    projectId: 'p1',
    taskId: null,
    description: null,
    startedAt: start.toISOString(),
    endedAt: end ? end.toISOString() : null,
    durationSeconds: end ? Math.round((end.getTime() - start.getTime()) / 1000) : 0,
    source: 'manual',
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
    tagIds: []
  }
}

describe('getMonthGridRange', () => {
  it('starts on the configured week start and spans 6 weeks', () => {
    // March 2026 starts on a Sunday.
    const monday = getMonthGridRange(new Date(2026, 2, 15), 1)
    expect(toLocalDateKey(monday.start)).toBe('2026-02-23')
    expect(toLocalDateKey(monday.end)).toBe('2026-04-06')

    const sunday = getMonthGridRange(new Date(2026, 2, 15), 0)
    expect(toLocalDateKey(sunday.start)).toBe('2026-03-01')
  })
})

describe('buildMonthGrid', () => {
  it('produces 42 days flagging those in the reference month', () => {
    const days = buildMonthGrid(new Date(2026, 1, 10), 1, [])
    expect(days).toHaveLength(42)
    expect(days.filter((d) => d.inMonth)).toHaveLength(28)
    expect(days.find((d) => d.inMonth)?.date).toBe('2026-02-01')
  })

  it('splits entries crossing midnight across both days', () => {
    const e = entry('a', new Date(2026, 2, 10, 23, 30), new Date(2026, 2, 11, 1, 30))
    const days = buildMonthGrid(new Date(2026, 2, 1), 1, [e])
    const d10 = days.find((d) => d.date === '2026-03-10')
    const d11 = days.find((d) => d.date === '2026-03-11')
    expect(d10?.totalSeconds).toBe(30 * 60)
    expect(d11?.totalSeconds).toBe(90 * 60)
    expect(d10?.entries.map((x) => x.id)).toEqual(['a'])
    expect(d11?.entries.map((x) => x.id)).toEqual(['a'])
  })

  it('sorts entries by start and ignores running entries', () => {
    const late = entry('late', new Date(2026, 2, 5, 14), new Date(2026, 2, 5, 15))
    const early = entry('early', new Date(2026, 2, 5, 9), new Date(2026, 2, 5, 10))
    const running = entry('running', new Date(2026, 2, 5, 16), null)
    const day = buildMonthGrid(new Date(2026, 2, 1), 1, [late, running, early]).find(
      (d) => d.date === '2026-03-05'
    )
    expect(day?.entries.map((x) => x.id)).toEqual(['early', 'late'])
    expect(day?.totalSeconds).toBe(2 * 3600)
  })
})

describe('shiftMonth', () => {
  it('moves to the first day of the target month without day overflow', () => {
    const next = shiftMonth(new Date(2026, 0, 31), 1)
    expect(toLocalDateKey(next)).toBe('2026-02-01')
  })
})
