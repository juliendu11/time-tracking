import { describe, expect, it } from 'vitest'
import {
  formatDurationClock,
  formatDurationCompact,
  formatDurationSpaced,
  parseDurationInput
} from '@shared/utils/duration'

describe('parseDurationInput', () => {
  it.each([
    ['2', 2 * 3600],
    ['2.5', 2.5 * 3600],
    ['2h', 2 * 3600],
    ['2h30', 2 * 3600 + 30 * 60],
    ['1:30', 1 * 3600 + 30 * 60],
    ['90m', 90 * 60],
    ['0:45', 45 * 60]
  ])('parses "%s" as %d seconds', (input, expected) => {
    expect(parseDurationInput(input)).toBe(expected)
  })

  it('rejects garbage input', () => {
    expect(parseDurationInput('not a duration')).toBeNull()
    expect(parseDurationInput('')).toBeNull()
    expect(parseDurationInput('2h99')).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('formats compact durations', () => {
    expect(formatDurationCompact(96 * 60)).toBe('1h36')
    expect(formatDurationCompact(45 * 60)).toBe('45m')
    expect(formatDurationCompact(3600)).toBe('1h')
  })

  it('formats spaced durations', () => {
    expect(formatDurationSpaced(4 * 3600 + 32 * 60)).toBe('4h 32m')
    expect(formatDurationSpaced(45 * 60)).toBe('45m')
  })

  it('formats clock durations', () => {
    expect(formatDurationClock(3738)).toBe('01:02:18')
  })
})
