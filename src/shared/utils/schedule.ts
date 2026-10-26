/**
 * Layout helpers for the Timeline schedule grid (daily and weekly views).
 *
 * Entries are cut at local midnight so a session spanning 23:30 -> 01:30
 * shows up in both day columns, and overlapping entries within a day are
 * assigned side-by-side lanes instead of being drawn on top of each other.
 */
import { addDays, startOfDay } from 'date-fns'
import { toLocalDateKey } from './time'

export const MINUTES_PER_DAY = 24 * 60

export interface ScheduleItem {
  startedAt: string
  endedAt: string | null
}

export interface ScheduleBlock<T extends ScheduleItem> {
  item: T
  /** Local calendar date of the column, formatted yyyy-MM-dd. */
  date: string
  /** Wall-clock minutes since local midnight, in [0, 1440). */
  startMinute: number
  /** Wall-clock minutes since local midnight, in (0, 1440]. */
  endMinute: number
  /** The entry started on an earlier day. */
  continuesBefore: boolean
  /** The entry ends on a later day. */
  continuesAfter: boolean
  /** Zero-based lane among the overlapping blocks of its cluster. */
  lane: number
  /** Number of lanes in the overlapping cluster the block belongs to. */
  laneCount: number
}

function wallClockMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
}

/** Assigns lanes in place; blocks must belong to the same day. */
function assignLanes<T extends ScheduleItem>(blocks: ScheduleBlock<T>[]): void {
  blocks.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute)

  let cluster: ScheduleBlock<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const closeCluster = (): void => {
    for (const block of cluster) block.laneCount = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const block of blocks) {
    if (block.startMinute >= clusterEnd) closeCluster()
    let lane = laneEnds.findIndex((end) => end <= block.startMinute)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(block.endMinute)
    } else {
      laneEnds[lane] = block.endMinute
    }
    block.lane = lane
    cluster.push(block)
    clusterEnd = Math.max(clusterEnd, block.endMinute)
  }
  closeCluster()
}

/**
 * Lays out finished entries into one column per requested day. Entries
 * without an end, with an invalid range, or outside every day are skipped.
 * Returns a map keyed by yyyy-MM-dd with an entry (possibly empty) per day.
 */
export function layoutScheduleDays<T extends ScheduleItem>(
  items: T[],
  days: Date[]
): Map<string, ScheduleBlock<T>[]> {
  const columns = new Map<string, ScheduleBlock<T>[]>()
  for (const day of days) columns.set(toLocalDateKey(day), [])

  for (const item of items) {
    if (!item.endedAt) continue
    const start = new Date(item.startedAt)
    const end = new Date(item.endedAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
    if (end.getTime() <= start.getTime()) continue

    for (const day of days) {
      const dayStart = startOfDay(day)
      const nextDayStart = addDays(dayStart, 1)
      if (end.getTime() <= dayStart.getTime() || start.getTime() >= nextDayStart.getTime()) continue

      const continuesBefore = start.getTime() < dayStart.getTime()
      const continuesAfter = end.getTime() > nextDayStart.getTime()
      const startMinute = continuesBefore ? 0 : wallClockMinutes(start)
      const endMinute =
        end.getTime() >= nextDayStart.getTime() ? MINUTES_PER_DAY : wallClockMinutes(end)
      if (endMinute <= startMinute) continue

      columns.get(toLocalDateKey(dayStart))?.push({
        item,
        date: toLocalDateKey(dayStart),
        startMinute,
        endMinute,
        continuesBefore,
        continuesAfter,
        lane: 0,
        laneCount: 1
      })
    }
  }

  for (const blocks of columns.values()) assignLanes(blocks)
  return columns
}
