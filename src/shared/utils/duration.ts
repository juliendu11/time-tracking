/** Parses flexible human duration input into seconds. Returns null when unparseable. */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  // hh:mm
  let m = s.match(/^(\d+):([0-5]\d)$/)
  if (m) return (Number(m[1]) * 60 + Number(m[2])) * 60

  // 2h, 2h30, 2h30m, 2.5h
  m = s.match(/^(\d+(?:\.\d+)?)h(\d{1,2})?m?$/)
  if (m) {
    const hours = Number(m[1])
    const minutes = m[2] ? Number(m[2]) : 0
    if (minutes > 59) return null
    return Math.round(hours * 3600 + minutes * 60)
  }

  // 90m
  m = s.match(/^(\d+)m$/)
  if (m) return Number(m[1]) * 60

  // plain number of hours: 2 or 2.5
  m = s.match(/^\d+(\.\d+)?$/)
  if (m) return Math.round(Number(s) * 3600)

  return null
}

/** "1h36", "45m", "6h01" style compact formatting used across widgets. */
export function formatDurationCompact(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h${String(minutes).padStart(2, '0')}`
}

/** "4h 32m" style formatting used in headers. */
export function formatDurationSpaced(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** "01:42:18" stopwatch style, used for active timer displays. */
export function formatDurationClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** "1:30" HH:MM format used in the timesheet grid cells. */
export function formatDurationHm(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}
