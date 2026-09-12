import { describe, expect, it } from 'vitest'
import {
  computeElapsedSeconds,
  rangesOverlap,
  splitDurationByLocalDay,
  toLocalDateKey
} from '@shared/utils/time'

describe('splitDurationByLocalDay', () => {
  it('keeps a same-day session on a single day', () => {
    const segments = splitDurationByLocalDay(
      '2026-03-10T09:00:00.000Z',
      '2026-03-10T10:30:00.000Z'
    )
    expect(segments).toHaveLength(1)
    expect(segments[0]?.seconds).toBe(90 * 60)
  })

  it('splits a session crossing local midnight across two days', () => {
    // Use explicit local Date construction so the test is independent of
    // the machine's timezone: 23:30 local -> 01:30 local next day.
    const start = new Date(2026, 2, 10, 23, 30, 0)
    const end = new Date(2026, 2, 11, 1, 30, 0)

    const segments = splitDurationByLocalDay(start, end)

    expect(segments).toHaveLength(2)
    expect(segments[0]?.date).toBe(toLocalDateKey(start))
    expect(segments[0]?.seconds).toBe(30 * 60)
    expect(segments[1]?.date).toBe(toLocalDateKey(end))
    expect(segments[1]?.seconds).toBe(90 * 60)
  })

  it('splits a multi-day session across every day it touches', () => {
    const start = new Date(2026, 5, 1, 22, 0, 0)
    const end = new Date(2026, 5, 4, 2, 0, 0)

    const segments = splitDurationByLocalDay(start, end)

    expect(segments).toHaveLength(4)
    const total = segments.reduce((sum, s) => sum + s.seconds, 0)
    expect(total).toBe((end.getTime() - start.getTime()) / 1000)
  })

  it('returns no segments for a zero or negative duration', () => {
    expect(
      splitDurationByLocalDay('2026-01-01T10:00:00Z', '2026-01-01T10:00:00Z')
    ).toHaveLength(0)
    expect(
      splitDurationByLocalDay('2026-01-01T10:00:00Z', '2026-01-01T09:00:00Z')
    ).toHaveLength(0)
  })
})

describe('computeElapsedSeconds', () => {
  it('derives elapsed time from timestamps, not from a counter', () => {
    const startedAt = new Date(Date.now() - 65_000).toISOString()
    const elapsed = computeElapsedSeconds({
      startedAt,
      accumulatedPauseSeconds: 0,
      pausedAt: null
    })
    expect(elapsed).toBeGreaterThanOrEqual(64)
    expect(elapsed).toBeLessThanOrEqual(66)
  })

  it('subtracts accumulated pause time', () => {
    const startedAt = new Date(Date.now() - 120_000).toISOString()
    const elapsed = computeElapsedSeconds({
      startedAt,
      accumulatedPauseSeconds: 60,
      pausedAt: null
    })
    expect(elapsed).toBeGreaterThanOrEqual(58)
    expect(elapsed).toBeLessThanOrEqual(61)
  })

  it('freezes elapsed time while paused', () => {
    const startedAt = new Date(Date.now() - 300_000).toISOString()
    const pausedAt = new Date(Date.now() - 100_000).toISOString()
    const elapsed = computeElapsedSeconds({
      startedAt,
      accumulatedPauseSeconds: 0,
      pausedAt
    })
    expect(elapsed).toBe(200)
  })
})

describe('rangesOverlap', () => {
  it('detects overlapping ranges', () => {
    expect(
      rangesOverlap(
        '2026-01-01T10:00:00Z',
        '2026-01-01T11:00:00Z',
        '2026-01-01T10:30:00Z',
        '2026-01-01T12:00:00Z'
      )
    ).toBe(true)
  })

  it('treats back-to-back ranges as non-overlapping', () => {
    expect(
      rangesOverlap(
        '2026-01-01T10:00:00Z',
        '2026-01-01T11:00:00Z',
        '2026-01-01T11:00:00Z',
        '2026-01-01T12:00:00Z'
      )
    ).toBe(false)
  })

  it('detects disjoint ranges', () => {
    expect(
      rangesOverlap(
        '2026-01-01T10:00:00Z',
        '2026-01-01T11:00:00Z',
        '2026-01-01T12:00:00Z',
        '2026-01-01T13:00:00Z'
      )
    ).toBe(false)
  })
})
