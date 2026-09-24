import { describe, expect, it } from 'vitest'
import { layoutScheduleDays } from '@shared/utils/schedule'
import { toLocalDateKey } from '@shared/utils/time'

// Local Date construction keeps every test independent of the machine's
// timezone: the schedule grid is laid out in local wall-clock time.
function entry(id: string, start: Date, end: Date | null): { id: string; startedAt: string; endedAt: string | null } {
  return { id, startedAt: start.toISOString(), endedAt: end ? end.toISOString() : null }
}

const monday = new Date(2026, 2, 9)
const tuesday = new Date(2026, 2, 10)
const wednesday = new Date(2026, 2, 11)

describe('layoutScheduleDays', () => {
  it('returns an empty column for every requested day', () => {
    const columns = layoutScheduleDays([], [monday, tuesday])
    expect([...columns.keys()]).toEqual([toLocalDateKey(monday), toLocalDateKey(tuesday)])
    expect(columns.get(toLocalDateKey(monday))).toEqual([])
  })

  it('places a same-day entry at its wall-clock minutes', () => {
    const e = entry('a', new Date(2026, 2, 10, 9, 15), new Date(2026, 2, 10, 10, 45))
    const blocks = layoutScheduleDays([e], [monday, tuesday]).get(toLocalDateKey(tuesday))
    expect(blocks).toHaveLength(1)
    expect(blocks?.[0]).toMatchObject({
      startMinute: 9 * 60 + 15,
      endMinute: 10 * 60 + 45,
      continuesBefore: false,
      continuesAfter: false,
      lane: 0,
      laneCount: 1
    })
    expect(layoutScheduleDays([e], [monday]).get(toLocalDateKey(monday))).toEqual([])
  })

  it('splits an entry crossing local midnight across both day columns', () => {
    const e = entry('a', new Date(2026, 2, 10, 23, 30), new Date(2026, 2, 11, 1, 30))
    const columns = layoutScheduleDays([e], [tuesday, wednesday])

    expect(columns.get(toLocalDateKey(tuesday))?.[0]).toMatchObject({
      startMinute: 23 * 60 + 30,
      endMinute: 24 * 60,
      continuesBefore: false,
      continuesAfter: true
    })
    expect(columns.get(toLocalDateKey(wednesday))?.[0]).toMatchObject({
      startMinute: 0,
      endMinute: 90,
      continuesBefore: true,
      continuesAfter: false
    })
  })

  it('ends a block at 24:00 when the entry stops exactly at midnight', () => {
    const e = entry('a', new Date(2026, 2, 10, 22, 0), new Date(2026, 2, 11, 0, 0))
    const columns = layoutScheduleDays([e], [tuesday, wednesday])
    expect(columns.get(toLocalDateKey(tuesday))?.[0]).toMatchObject({ endMinute: 24 * 60, continuesAfter: false })
    expect(columns.get(toLocalDateKey(wednesday))).toEqual([])
  })

  it('skips unfinished and invalid entries', () => {
    const running = entry('a', new Date(2026, 2, 10, 9, 0), null)
    const inverted = entry('b', new Date(2026, 2, 10, 11, 0), new Date(2026, 2, 10, 10, 0))
    expect(layoutScheduleDays([running, inverted], [tuesday]).get(toLocalDateKey(tuesday))).toEqual([])
  })

  it('puts overlapping entries in side-by-side lanes', () => {
    const a = entry('a', new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 11, 0))
    const b = entry('b', new Date(2026, 2, 10, 10, 0), new Date(2026, 2, 10, 12, 0))
    const c = entry('c', new Date(2026, 2, 10, 11, 0), new Date(2026, 2, 10, 11, 30))
    const d = entry('d', new Date(2026, 2, 10, 14, 0), new Date(2026, 2, 10, 15, 0))

    const blocks = layoutScheduleDays([d, c, b, a], [tuesday]).get(toLocalDateKey(tuesday)) ?? []
    const byId = Object.fromEntries(blocks.map((block) => [block.item.id, block]))

    expect(byId.a).toMatchObject({ lane: 0, laneCount: 2 })
    expect(byId.b).toMatchObject({ lane: 1, laneCount: 2 })
    // c starts when a ends, so it reuses a's lane inside the same cluster.
    expect(byId.c).toMatchObject({ lane: 0, laneCount: 2 })
    // d does not overlap anything and gets the full column width.
    expect(byId.d).toMatchObject({ lane: 0, laneCount: 1 })
  })

  it('does not treat back-to-back entries as overlapping', () => {
    const a = entry('a', new Date(2026, 2, 10, 9, 0), new Date(2026, 2, 10, 10, 0))
    const b = entry('b', new Date(2026, 2, 10, 10, 0), new Date(2026, 2, 10, 11, 0))
    const blocks = layoutScheduleDays([a, b], [tuesday]).get(toLocalDateKey(tuesday)) ?? []
    expect(blocks.every((block) => block.laneCount === 1 && block.lane === 0)).toBe(true)
  })
})
