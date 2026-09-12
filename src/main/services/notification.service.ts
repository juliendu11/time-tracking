import { Notification } from 'electron'
import { formatDurationSpaced } from '@shared/utils/duration'
import type { AppContext } from '@main/context'

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
  private longSessionNotifiedForTimerId: string | null = null

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

  private poll(): void {
    const settings = this.context.settings.get()
    if (!settings.notificationsEnabled) return

    const now = new Date()
    const todayKey = now.toISOString().slice(0, 10)

    if (settings.dailyGoalMinutes && this.dailyGoalNotifiedForDate !== todayKey) {
      const summary = this.context.reports.getDashboardSummary(now, settings.weeklyGoalMinutes)
      if (summary.todaySeconds / 60 >= settings.dailyGoalMinutes) {
        this.dailyGoalNotifiedForDate = todayKey
        this.notify(
          'Daily goal reached 🎯',
          `You've tracked ${formatDurationSpaced(summary.todaySeconds)} today.`
        )
      }
    }

    const snapshot = this.context.timer.getSnapshot()
    if (
      snapshot &&
      !snapshot.isPaused &&
      snapshot.elapsedSeconds >= LONG_SESSION_THRESHOLD_SECONDS &&
      this.longSessionNotifiedForTimerId !== snapshot.timer.id
    ) {
      this.longSessionNotifiedForTimerId = snapshot.timer.id
      this.notify(
        'Still tracking',
        `${snapshot.project.name} has been running for ${formatDurationSpaced(snapshot.elapsedSeconds)}.`
      )
    }
    if (!snapshot) this.longSessionNotifiedForTimerId = null
  }
}
