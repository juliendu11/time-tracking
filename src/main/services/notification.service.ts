import { Notification } from 'electron'
import { formatDurationSpaced } from '@shared/utils/duration'
import type { AppContext } from '@main/context'
import { mainMessages } from '@main/i18n'

const POLL_INTERVAL_MS = 5 * 60_000
const LONG_SESSION_THRESHOLD_SECONDS = 3 * 3600

/**
 * Best-effort, non-intrusive desktop notifications. Never blocks or alters
 * tracked data; purely informational, and every kind can be disabled via
 * settings.notificationsEnabled.
 */
export class NotificationService {
  private pollHandle: NodeJS.Timeout | null = null
  private dailyGoalNotifiedForDate: string | null = null
  private readonly longSessionNotifiedTimerIds = new Set<string>()

  constructor(private readonly context: AppContext) {}

  start(): void {
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle)
  }

  private notify(title: string, body: string): void {
    if (!Notification.isSupported()) return
    new Notification({ title, body, silent: true }).show()
  }

  /** Sends a one-off notification on demand, bypassing notificationsEnabled. */
  sendTest(): boolean {
    if (!Notification.isSupported()) return false
    const m = mainMessages(this.context.settings.get().language)
    this.notify(m.notifyTestTitle, m.notifyTestBody)
    return true
  }

  private poll(): void {
    const settings = this.context.settings.get()
    if (!settings.notificationsEnabled) return
    const m = mainMessages(settings.language)

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)

    if (settings.dailyGoalMinutes && this.dailyGoalNotifiedForDate !== todayKey) {
      const summary = this.context.reports.getDashboardSummary(now, settings.weeklyGoalMinutes)
      if (summary.todaySeconds / 60 >= settings.dailyGoalMinutes) {
        this.dailyGoalNotifiedForDate = todayKey
        this.notify(m.notifyDailyGoalTitle, m.notifyDailyGoalBody(formatDurationSpaced(summary.todaySeconds)))
      }
    }

    const snapshots = this.context.timer.getSnapshots()
    const activeIds = new Set(snapshots.map((snapshot) => snapshot.timer.id))
    for (const notifiedId of this.longSessionNotifiedTimerIds) {
      if (!activeIds.has(notifiedId)) this.longSessionNotifiedTimerIds.delete(notifiedId)
    }
    for (const snapshot of snapshots) {
      if (
        !snapshot.isPaused &&
        snapshot.elapsedSeconds >= LONG_SESSION_THRESHOLD_SECONDS &&
        !this.longSessionNotifiedTimerIds.has(snapshot.timer.id)
      ) {
        this.longSessionNotifiedTimerIds.add(snapshot.timer.id)
        this.notify(
          m.notifyLongSessionTitle,
          m.notifyLongSessionBody(snapshot.project.name, formatDurationSpaced(snapshot.elapsedSeconds))
        )
      }
    }
  }
}
