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
 * The single source of truth for "what timer is running right now".
 * Every mutation happens inside a SQLite transaction so the renderer,
 * tray, and mini-timer window can never observe a half-applied state.
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

  private getRow(): ActiveTimerRow | null {
    return this.db.select().from(activeTimer).where(eq(activeTimer.id, 1)).get() ?? null
  }

  getSnapshot(): RunningTimerSnapshot | null {
    const row = this.getRow()
    if (!row) return null
    const project = this.projects.findById(row.projectId)
    if (!project) {
      // Referential integrity is enforced at the DB level; this should be
      // unreachable, but never show a dangling timer if it somehow happens.
      this.db.delete(activeTimer).where(eq(activeTimer.id, 1)).run()
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

  getPendingIdlePrompt(): IdlePromptPayload | null {
    return this.pendingIdlePrompt
  }

  /** Starts a new timer, atomically stopping any currently running one first. */
  start(params: StartTimerParams): RunningTimerSnapshot {
    const project = this.projects.getOrThrow(params.projectId)
    if (project.isArchived) {
      throw new ValidationError('Cannot start a timer on an archived project.')
    }
    const task = params.taskId ? this.tasks.getOrThrow(params.taskId) : null
    if (task && task.projectId !== project.id) {
      throw new ValidationError('Task does not belong to the given project.')
    }

    this.db.transaction(() => {
      this.stopInternal()
      const now = nowIso()
      const row: ActiveTimerRow = {
        id: 1,
        timerId: nanoid(),
        projectId: project.id,
        taskId: task?.id ?? null,
        description: params.description ?? null,
        startedAt: now,
        accumulatedPauseSeconds: 0,
        pausedAt: null,
        suspendedAt: null
      }
      this.db.insert(activeTimer).values(row).run()
      this.settings.setCurrentProject(project.id)
    })

    this.pendingIdlePrompt = null
    logger.info('Timer started', { projectId: project.id, taskId: task?.id })
    const snapshot = this.getSnapshot()
    if (!snapshot) throw new AppError('Failed to start timer', 'INTERNAL_ERROR')
    this.emit('changed', snapshot)
    return snapshot
  }

  /** Internal stop used within a transaction; does not emit events. */
  private stopInternal(): TimeEntry | null {
    const row = this.getRow()
    if (!row) return null
    const state = rowToState(row)
    const elapsedSeconds = computeElapsedSeconds({
      startedAt: state.startedAt,
      accumulatedPauseSeconds: state.accumulatedPauseSeconds,
      pausedAt: state.pausedAt
    })
    const endedAt = state.pausedAt ?? nowIso()

    this.db.delete(activeTimer).where(eq(activeTimer.id, 1)).run()

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

  stop(): TimeEntry | null {
    const entry = this.db.transaction(() => this.stopInternal())
    this.pendingIdlePrompt = null
    logger.info('Timer stopped', { entryId: entry?.id })
    this.emit('changed', null)
    return entry
  }

  pause(): RunningTimerSnapshot {
    const row = this.getRow()
    if (!row) throw new ValidationError('No timer is currently running.')
    if (row.pausedAt) return this.getSnapshot() as RunningTimerSnapshot

    this.db.update(activeTimer).set({ pausedAt: nowIso() }).where(eq(activeTimer.id, 1)).run()
    const snapshot = this.getSnapshot()
    if (!snapshot) throw new AppError('Failed to pause timer', 'INTERNAL_ERROR')
    this.emit('changed', snapshot)
    return snapshot
  }

  resume(): RunningTimerSnapshot {
    const row = this.getRow()
    if (!row) throw new ValidationError('No timer is currently running.')
    if (!row.pausedAt) return this.getSnapshot() as RunningTimerSnapshot

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
      .where(eq(activeTimer.id, 1))
      .run()

    const snapshot = this.getSnapshot()
    if (!snapshot) throw new AppError('Failed to resume timer', 'INTERNAL_ERROR')
    this.emit('changed', snapshot)
    return snapshot
  }

  switchTask(taskId: string): RunningTimerSnapshot {
    const task = this.tasks.getOrThrow(taskId)
    return this.start({ projectId: task.projectId, taskId: task.id })
  }

  switchProject(projectId: string): RunningTimerSnapshot {
    return this.start({ projectId })
  }

  /** Called once at app startup to sync in-memory listeners with DB state. */
  restore(): RunningTimerSnapshot | null {
    const snapshot = this.getSnapshot()
    if (snapshot) logger.info('Restored active timer from previous session', { id: snapshot.timer.id })
    return snapshot
  }

  // --- Idle / sleep handling -------------------------------------------------

  /** Called by IdleService when the user returns after being idle past the threshold. */
  notifyIdleDetected(idleStartedAt: string, idleSeconds: number): void {
    const row = this.getRow()
    if (!row || row.pausedAt) return
    const state = rowToState(row)
    this.pendingIdlePrompt = { idleStartedAt, idleSeconds, timer: state }
    this.emit('idle-detected', this.pendingIdlePrompt)
  }

  /** Called when the OS reports the machine is about to sleep. */
  handleSuspend(): void {
    const row = this.getRow()
    if (!row || row.suspendedAt) return
    this.db
      .update(activeTimer)
      .set({ suspendedAt: nowIso() })
      .where(eq(activeTimer.id, 1))
      .run()
    logger.info('System suspending while timer active')
  }

  /** Called when the OS reports the machine has woken up. */
  handleResume(): void {
    const row = this.getRow()
    if (!row || !row.suspendedAt) return
    const suspendedAt = row.suspendedAt
    const gapSeconds = Math.max(0, Math.round((Date.now() - new Date(suspendedAt).getTime()) / 1000))

    this.db.update(activeTimer).set({ suspendedAt: null }).where(eq(activeTimer.id, 1)).run()

    if (gapSeconds >= 120) {
      const state = rowToState({ ...row, suspendedAt: null })
      this.pendingIdlePrompt = { idleStartedAt: suspendedAt, idleSeconds: gapSeconds, timer: state }
      this.emit('idle-detected', this.pendingIdlePrompt)
    }
    logger.info('System resumed', { gapSeconds })
  }

  resolveIdlePrompt(resolution: IdleResolution): TimeEntry | null {
    const prompt = this.pendingIdlePrompt
    if (!prompt) return null
    this.pendingIdlePrompt = null

    const row = this.getRow()
    if (!row) return null

    if (resolution === 'keep') {
      this.emit('changed', this.getSnapshot())
      return null
    }

    if (resolution === 'discard') {
      const idleSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(prompt.idleStartedAt).getTime()) / 1000)
      )
      this.db
        .update(activeTimer)
        .set({ accumulatedPauseSeconds: row.accumulatedPauseSeconds + idleSeconds })
        .where(eq(activeTimer.id, 1))
        .run()
      this.emit('changed', this.getSnapshot())
      return null
    }

    // 'split': close out the running entry as of idleStartedAt, then start a
    // fresh timer for the same project/task beginning now.
    const state = rowToState(row)
    const entry = this.db.transaction(() => {
      this.db.delete(activeTimer).where(eq(activeTimer.id, 1)).run()
      const elapsedBeforeIdle = computeElapsedSeconds({
        startedAt: state.startedAt,
        accumulatedPauseSeconds: state.accumulatedPauseSeconds,
        pausedAt: prompt.idleStartedAt
      })
      const created =
        elapsedBeforeIdle >= 1
          ? this.timeEntries.create({
              projectId: state.projectId,
              taskId: state.taskId,
              description: state.description,
              startedAt: state.startedAt,
              endedAt: prompt.idleStartedAt,
              durationSeconds: elapsedBeforeIdle,
              source: 'timer'
            })
          : null

      const now = nowIso()
      this.db
        .insert(activeTimer)
        .values({
          id: 1,
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

      return created
    })

    this.emit('changed', this.getSnapshot())
    return entry
  }
}
