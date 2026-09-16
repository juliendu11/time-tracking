import { EventEmitter } from 'node:events'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { AppDatabase } from '@main/db/client'
import { activeTimer } from '@main/db/schema'
import { AppError, ValidationError } from '@main/errors'
import { logger } from '@main/logger'
import type { ProjectRepository } from '@main/repositories/project.repository'
import type { SettingsRepository } from '@main/repositories/settings.repository'
import type { TaskRepository } from '@main/repositories/task.repository'
import type { TimeEntryRepository } from '@main/repositories/timeEntry.repository'
import { computeElapsedSeconds, nowIso } from '@shared/utils/time'
import type {
  ActiveTimerState,
  IdlePromptPayload,
  IdleResolution,
  RunningTimerSnapshot,
  TimeEntry
} from '@shared/types/domain'

export interface StartTimerParams {
  projectId: string
  taskId?: string | null
  description?: string | null
}

type ActiveTimerRow = typeof activeTimer.$inferSelect

function rowToState(row: ActiveTimerRow): ActiveTimerState {
  return {
    id: row.timerId,
    projectId: row.projectId,
    taskId: row.taskId,
    description: row.description,
    startedAt: row.startedAt,
    accumulatedPauseSeconds: row.accumulatedPauseSeconds,
    pausedAt: row.pausedAt,
    suspendedAt: row.suspendedAt
  }
}

/**
 * The source of truth for all active timers. Every mutation happens inside
 * SQLite before the complete list is emitted to renderer-side consumers.
 */
export class TimerService extends EventEmitter {
  /** Idle/suspend gap awaiting a user decision. Transient, not persisted. */
  private pendingIdlePrompt: IdlePromptPayload | null = null

  constructor(
    private readonly db: AppDatabase,
    private readonly projects: ProjectRepository,
    private readonly tasks: TaskRepository,
    private readonly timeEntries: TimeEntryRepository,
    private readonly settings: SettingsRepository
  ) {
    super()
  }

  private getRows(): ActiveTimerRow[] {
    return this.db.select().from(activeTimer).all()
  }

  private getRow(timerId: string): ActiveTimerRow | null {
    return this.db.select().from(activeTimer).where(eq(activeTimer.timerId, timerId)).get() ?? null
  }

  private rowToSnapshot(row: ActiveTimerRow): RunningTimerSnapshot | null {
    const project = this.projects.findById(row.projectId)
    if (!project) {
      // Referential integrity is enforced at the DB level; this should be
      // unreachable, but never show a dangling timer if it somehow happens.
      this.db.delete(activeTimer).where(eq(activeTimer.timerId, row.timerId)).run()
      return null
    }
    const task = row.taskId ? this.tasks.findById(row.taskId) : null
    const state = rowToState(row)
    return {
      timer: state,
      project,
      task,
      elapsedSeconds: computeElapsedSeconds({
        startedAt: state.startedAt,
        accumulatedPauseSeconds: state.accumulatedPauseSeconds,
        pausedAt: state.pausedAt
      }),
      isPaused: state.pausedAt !== null
    }
  }

  getSnapshots(): RunningTimerSnapshot[] {
    return this.getRows()
      .map((row) => this.rowToSnapshot(row))
      .filter((snapshot): snapshot is RunningTimerSnapshot => snapshot !== null)
      .sort((a, b) => a.timer.startedAt.localeCompare(b.timer.startedAt))
  }

  private getSnapshot(timerId: string): RunningTimerSnapshot | null {
    const row = this.getRow(timerId)
    return row ? this.rowToSnapshot(row) : null
  }

  getPendingIdlePrompt(): IdlePromptPayload | null {
    return this.pendingIdlePrompt
  }

  /** Starts an independent timer without affecting timers already active. */
  start(params: StartTimerParams): RunningTimerSnapshot {
    const project = this.projects.getOrThrow(params.projectId)
    if (project.isArchived) {
      throw new ValidationError('Cannot start a timer on an archived project.')
    }
    const task = params.taskId ? this.tasks.getOrThrow(params.taskId) : null
    if (task && task.projectId !== project.id) {
      throw new ValidationError('Task does not belong to the given project.')
    }

    const timerId = nanoid()
    this.db.transaction(() => {
      const row: ActiveTimerRow = {
        timerId,
        projectId: project.id,
        taskId: task?.id ?? null,
        description: params.description ?? null,
        startedAt: nowIso(),
        accumulatedPauseSeconds: 0,
        pausedAt: null,
        suspendedAt: null
      }
      this.db.insert(activeTimer).values(row).run()
      this.settings.setCurrentProject(project.id)
    })

    logger.info('Timer started', { projectId: project.id, taskId: task?.id })
    const snapshot = this.getSnapshot(timerId)
    if (!snapshot) throw new AppError('Failed to start timer', 'INTERNAL_ERROR')
    this.emit('changed', this.getSnapshots())
    return snapshot
  }

  /** Internal stop used within a transaction; does not emit events. */
  private stopInternal(timerId: string): TimeEntry | null {
    const row = this.getRow(timerId)
    if (!row) return null
    const state = rowToState(row)
    const elapsedSeconds = computeElapsedSeconds({
      startedAt: state.startedAt,
      accumulatedPauseSeconds: state.accumulatedPauseSeconds,
      pausedAt: state.pausedAt
    })
    const endedAt = state.pausedAt ?? nowIso()

    this.db.delete(activeTimer).where(eq(activeTimer.timerId, timerId)).run()

    if (elapsedSeconds < 1) return null

    return this.timeEntries.create({
      projectId: state.projectId,
      taskId: state.taskId,
      description: state.description,
      startedAt: state.startedAt,
      endedAt,
      durationSeconds: elapsedSeconds,
      source: 'timer'
    })
  }

  stop(timerId: string): TimeEntry | null {
    const entry = this.db.transaction(() => this.stopInternal(timerId))
    this.removeTimerFromPendingPrompt(timerId)
    logger.info('Timer stopped', { timerId, entryId: entry?.id })
    this.emit('changed', this.getSnapshots())
    return entry
  }

  pause(timerId: string): RunningTimerSnapshot {
    const row = this.getRow(timerId)
    if (!row) throw new ValidationError('Timer not found.')
    if (row.pausedAt) return this.getSnapshot(timerId) as RunningTimerSnapshot

    this.db
      .update(activeTimer)
      .set({ pausedAt: nowIso() })
      .where(eq(activeTimer.timerId, timerId))
      .run()
    const snapshot = this.getSnapshot(timerId)
    if (!snapshot) throw new AppError('Failed to pause timer', 'INTERNAL_ERROR')
    this.removeTimerFromPendingPrompt(timerId)
    this.emit('changed', this.getSnapshots())
    return snapshot
  }

  resume(timerId: string): RunningTimerSnapshot {
    const row = this.getRow(timerId)
    if (!row) throw new ValidationError('Timer not found.')
    if (!row.pausedAt) return this.getSnapshot(timerId) as RunningTimerSnapshot

    const pauseSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(row.pausedAt).getTime()) / 1000)
    )
    this.db
      .update(activeTimer)
      .set({
        pausedAt: null,
        accumulatedPauseSeconds: row.accumulatedPauseSeconds + pauseSeconds
      })
      .where(eq(activeTimer.timerId, timerId))
      .run()

    const snapshot = this.getSnapshot(timerId)
    if (!snapshot) throw new AppError('Failed to resume timer', 'INTERNAL_ERROR')
    this.emit('changed', this.getSnapshots())
    return snapshot
  }

  /** Called once at app startup to sync in-memory listeners with DB state. */
  restore(): RunningTimerSnapshot[] {
    const snapshots = this.getSnapshots()
    if (snapshots.length > 0) logger.info('Restored active timers from previous session', { count: snapshots.length })
    return snapshots
  }

  // --- Idle / sleep handling -------------------------------------------------

  /** Called by IdleService when the user returns after being idle past the threshold. */
  notifyIdleDetected(idleStartedAt: string, idleSeconds: number): void {
    const timers = this.getRows().filter((row) => !row.pausedAt).map(rowToState)
    if (timers.length === 0) return
    this.pendingIdlePrompt = { idleStartedAt, idleSeconds, timers }
    this.emit('idle-detected', this.pendingIdlePrompt)
  }

  /** Called when the OS reports the machine is about to sleep. */
  handleSuspend(): void {
    const rows = this.getRows().filter((row) => !row.pausedAt && !row.suspendedAt)
    if (rows.length === 0) return
    const suspendedAt = nowIso()
    this.db.transaction(() => {
      for (const row of rows) {
        this.db
          .update(activeTimer)
          .set({ suspendedAt })
          .where(eq(activeTimer.timerId, row.timerId))
          .run()
      }
    })
    logger.info('System suspending while timers active', { count: rows.length })
  }

  /** Called when the OS reports the machine has woken up. */
  handleResume(): void {
    const rows = this.getRows().filter((row) => row.suspendedAt !== null)
    if (rows.length === 0) return
    const suspendedAt = rows.reduce(
      (earliest, row) => (row.suspendedAt && row.suspendedAt < earliest ? row.suspendedAt : earliest),
      rows[0]!.suspendedAt as string
    )
    const gapSeconds = Math.max(0, Math.round((Date.now() - new Date(suspendedAt).getTime()) / 1000))

    this.db.transaction(() => {
      for (const row of rows) {
        this.db
          .update(activeTimer)
          .set({ suspendedAt: null })
          .where(eq(activeTimer.timerId, row.timerId))
          .run()
      }
    })

    if (gapSeconds >= 120) {
      const timers = rows.map((row) => rowToState({ ...row, suspendedAt: null }))
      this.pendingIdlePrompt = { idleStartedAt: suspendedAt, idleSeconds: gapSeconds, timers }
      this.emit('idle-detected', this.pendingIdlePrompt)
    }
    logger.info('System resumed', { gapSeconds })
  }

  resolveIdlePrompt(resolution: IdleResolution): TimeEntry[] {
    const prompt = this.pendingIdlePrompt
    if (!prompt) return []
    this.pendingIdlePrompt = null

    const rows = prompt.timers
      .map((timer) => this.getRow(timer.id))
      .filter((row): row is ActiveTimerRow => row !== null)
    if (rows.length === 0) return []

    if (resolution === 'keep') {
      this.emit('changed', this.getSnapshots())
      return []
    }

    if (resolution === 'discard') {
      const idleSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(prompt.idleStartedAt).getTime()) / 1000)
      )
      this.db.transaction(() => {
        for (const row of rows) {
          this.db
            .update(activeTimer)
            .set({ accumulatedPauseSeconds: row.accumulatedPauseSeconds + idleSeconds })
            .where(eq(activeTimer.timerId, row.timerId))
            .run()
        }
      })
      this.emit('changed', this.getSnapshots())
      return []
    }

    // 'split': close out the running entry as of idleStartedAt, then start a
    // fresh timer for the same project/task beginning now.
    const entries = this.db.transaction(() => {
      const created: TimeEntry[] = []
      const now = nowIso()
      for (const row of rows) {
        const state = rowToState(row)
        this.db.delete(activeTimer).where(eq(activeTimer.timerId, row.timerId)).run()
        const elapsedBeforeIdle = computeElapsedSeconds({
          startedAt: state.startedAt,
          accumulatedPauseSeconds: state.accumulatedPauseSeconds,
          pausedAt: prompt.idleStartedAt
        })
        if (elapsedBeforeIdle >= 1) {
          created.push(
            this.timeEntries.create({
              projectId: state.projectId,
              taskId: state.taskId,
              description: state.description,
              startedAt: state.startedAt,
              endedAt: prompt.idleStartedAt,
              durationSeconds: elapsedBeforeIdle,
              source: 'timer'
            })
          )
        }

        this.db
          .insert(activeTimer)
          .values({
            timerId: nanoid(),
            projectId: state.projectId,
            taskId: state.taskId,
            description: state.description,
            startedAt: now,
            accumulatedPauseSeconds: 0,
            pausedAt: null,
            suspendedAt: null
          })
          .run()
      }
      return created
    })

    this.emit('changed', this.getSnapshots())
    return entries
  }

  private removeTimerFromPendingPrompt(timerId: string): void {
    if (!this.pendingIdlePrompt) return
    const timers = this.pendingIdlePrompt.timers.filter((timer) => timer.id !== timerId)
    this.pendingIdlePrompt = timers.length > 0 ? { ...this.pendingIdlePrompt, timers } : null
  }
}
