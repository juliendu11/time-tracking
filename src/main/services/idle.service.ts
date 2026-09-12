import { powerMonitor } from 'electron'
import { logger } from '@main/logger'
import type { SettingsRepository } from '@main/repositories/settings.repository'
import type { TimerService } from './timer.service'

const POLL_INTERVAL_MS = 15_000

/**
 * Polls the OS idle time and watches sleep/resume events, delegating the
 * actual decision-making (what to do with the idle gap) to TimerService.
 * This class only detects; TimerService owns the state.
 */
export class IdleService {
  private pollHandle: NodeJS.Timeout | null = null
  private trackedIdleStartMs: number | null = null

  constructor(
    private readonly timer: TimerService,
    private readonly settings: SettingsRepository
  ) {}

  start(): void {
    powerMonitor.on('suspend', () => this.timer.handleSuspend())
    powerMonitor.on('resume', () => this.timer.handleResume())
    powerMonitor.on('lock-screen', () => this.timer.handleSuspend())
    powerMonitor.on('unlock-screen', () => this.timer.handleResume())
    this.pollHandle = setInterval(() => this.poll(), POLL_INTERVAL_MS)
    logger.info('Idle detection started')
  }

  stop(): void {
    if (this.pollHandle) clearInterval(this.pollHandle)
    this.pollHandle = null
  }

  private poll(): void {
    const settings = this.settings.get()
    const snapshot = this.timer.getSnapshot()

    if (!settings.idleDetectionEnabled || !snapshot || snapshot.isPaused) {
      this.trackedIdleStartMs = null
      return
    }
    if (this.timer.getPendingIdlePrompt()) return

    const idleSeconds = powerMonitor.getSystemIdleTime()
    const thresholdSeconds = settings.idleThresholdMinutes * 60

    if (idleSeconds >= thresholdSeconds) {
      if (this.trackedIdleStartMs === null) {
        this.trackedIdleStartMs = Date.now() - idleSeconds * 1000
      }
      return
    }

    if (this.trackedIdleStartMs !== null) {
      const idleStartedAt = new Date(this.trackedIdleStartMs).toISOString()
      const idleDurationSeconds = Math.round((Date.now() - this.trackedIdleStartMs) / 1000)
      this.trackedIdleStartMs = null
      this.timer.notifyIdleDetected(idleStartedAt, idleDurationSeconds)
    }
  }
}
