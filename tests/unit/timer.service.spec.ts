import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TimerService } from '@main/services/timer.service'
import { setupTestEnvironment, type TestEnvironment } from '../helpers/setupDb'

let env: TestEnvironment

beforeEach(() => {
  env = setupTestEnvironment()
})

function createProject(name = 'Habits Hero') {
  return env.projects.create({ name })
}

describe('TimerService', () => {
  it('starts a free timer on a project', () => {
    const project = createProject()
    const snapshot = env.timer.start({ projectId: project.id })
    expect(snapshot.project.id).toBe(project.id)
    expect(snapshot.task).toBeNull()
    expect(snapshot.isPaused).toBe(false)
  })

  it('persists the current project to settings when starting', () => {
    const project = createProject()
    env.timer.start({ projectId: project.id })
    expect(env.settings.get().currentProjectId).toBe(project.id)
  })

  it('rejects starting a timer on an archived project', () => {
    const project = createProject()
    env.projects.archive(project.id)
    expect(() => env.timer.start({ projectId: project.id })).toThrow()
  })

  it('stop() finalises a TimeEntry with the elapsed duration', () => {
    vi.useFakeTimers()
    const project = createProject()
    env.timer.start({ projectId: project.id })
    vi.advanceTimersByTime(90_000)

    const entry = env.timer.stop()
    expect(entry).not.toBeNull()
    expect(entry?.durationSeconds).toBe(90)
    expect(env.timer.getSnapshot()).toBeNull()
    vi.useRealTimers()
  })

  it('switching tasks atomically stops the previous timer and starts a new one', () => {
    vi.useFakeTimers()
    const project = createProject()
    const taskA = env.tasks.create({ projectId: project.id, name: 'Task A' })
    const taskB = env.tasks.create({ projectId: project.id, name: 'Task B' })

    env.timer.start({ projectId: project.id, taskId: taskA.id })
    vi.advanceTimersByTime(60_000)
    env.timer.switchTask(taskB.id)

    const entries = env.timeEntries.listRecent(10)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.taskId).toBe(taskA.id)
    expect(entries[0]?.durationSeconds).toBe(60)

    const snapshot = env.timer.getSnapshot()
    expect(snapshot?.task?.id).toBe(taskB.id)
    vi.useRealTimers()
  })

  it('pause freezes elapsed time and resume continues counting', () => {
    vi.useFakeTimers()
    const project = createProject()
    env.timer.start({ projectId: project.id })

    vi.advanceTimersByTime(30_000)
    env.timer.pause()
    vi.advanceTimersByTime(45_000)
    const paused = env.timer.getSnapshot()
    expect(paused?.elapsedSeconds).toBe(30)

    env.timer.resume()
    vi.advanceTimersByTime(10_000)
    const resumed = env.timer.getSnapshot()
    expect(resumed?.elapsedSeconds).toBe(40)
    vi.useRealTimers()
  })

  it('restore() reflects the persisted timer after a simulated restart', () => {
    const project = createProject()
    env.timer.start({ projectId: project.id })

    // Simulate an app restart: a brand new TimerService instance reading
    // from the same database must see the same running timer.
    const revived = new TimerService(env.db, env.projects, env.tasks, env.timeEntries, env.settings)
    const snapshot = revived.restore()
    expect(snapshot?.project.id).toBe(project.id)
  })

  it('idle resolution "discard" excludes idle time from the running timer', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const project = createProject()
    env.timer.start({ projectId: project.id })

    vi.advanceTimersByTime(60_000)
    const idleStartedAt = new Date(start + 60_000).toISOString()
    vi.advanceTimersByTime(5 * 60_000) // 5 minutes idle
    env.timer.notifyIdleDetected(idleStartedAt, 300)

    env.timer.resolveIdlePrompt('discard')
    const snapshot = env.timer.getSnapshot()
    // 6 minutes elapsed total, 5 minutes discarded -> ~1 minute counted
    expect(snapshot?.elapsedSeconds).toBeGreaterThanOrEqual(59)
    expect(snapshot?.elapsedSeconds).toBeLessThanOrEqual(61)
    vi.useRealTimers()
  })

  it('idle resolution "split" closes the current entry and starts a fresh one', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const project = createProject()
    env.timer.start({ projectId: project.id })

    vi.advanceTimersByTime(60_000)
    const idleStartedAt = new Date(start + 60_000).toISOString()
    vi.advanceTimersByTime(5 * 60_000)
    env.timer.notifyIdleDetected(idleStartedAt, 300)

    const closedEntry = env.timer.resolveIdlePrompt('split')
    expect(closedEntry?.durationSeconds).toBe(60)

    const snapshot = env.timer.getSnapshot()
    expect(snapshot?.project.id).toBe(project.id)
    expect(snapshot?.elapsedSeconds).toBeLessThanOrEqual(1)
    vi.useRealTimers()
  })

  it('idle resolution "keep" leaves elapsed time untouched', () => {
    vi.useFakeTimers()
    const project = createProject()
    env.timer.start({ projectId: project.id })
    vi.advanceTimersByTime(6 * 60_000)

    env.timer.notifyIdleDetected(new Date().toISOString(), 300)
    env.timer.resolveIdlePrompt('keep')

    const snapshot = env.timer.getSnapshot()
    expect(snapshot?.elapsedSeconds).toBeGreaterThanOrEqual(359)
    vi.useRealTimers()
  })
})
