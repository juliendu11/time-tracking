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
    const timer = env.timer.start({ projectId: project.id })
    vi.advanceTimersByTime(90_000)

    const entry = env.timer.stop(timer.timer.id)
    expect(entry).not.toBeNull()
    expect(entry?.durationSeconds).toBe(90)
    expect(env.timer.getSnapshots()).toHaveLength(0)
    vi.useRealTimers()
  })

  it('runs multiple task timers at the same time without finalising either one', () => {
    vi.useFakeTimers()
    const project = createProject()
    const taskA = env.tasks.create({ projectId: project.id, name: 'Task A' })
    const taskB = env.tasks.create({ projectId: project.id, name: 'Task B' })

    env.timer.start({ projectId: project.id, taskId: taskA.id })
    vi.advanceTimersByTime(60_000)
    env.timer.start({ projectId: project.id, taskId: taskB.id })

    const entries = env.timeEntries.listRecent(10)
    expect(entries).toHaveLength(0)

    const snapshots = env.timer.getSnapshots()
    expect(snapshots).toHaveLength(2)
    expect(snapshots.map((snapshot) => snapshot.task?.id)).toEqual([taskA.id, taskB.id])
    vi.useRealTimers()
  })

  it('runs timers with and without tasks concurrently', () => {
    const project = createProject()
    const task = env.tasks.create({ projectId: project.id, name: 'Task' })

    env.timer.start({ projectId: project.id })
    env.timer.start({ projectId: project.id, taskId: task.id })

    const snapshots = env.timer.getSnapshots()
    expect(snapshots).toHaveLength(2)
    expect(snapshots.some((snapshot) => snapshot.task === null)).toBe(true)
    expect(snapshots.some((snapshot) => snapshot.task?.id === task.id)).toBe(true)
  })

  it('emits the complete active timer list after every start', () => {
    const projectA = createProject('Project A')
    const projectB = createProject('Project B')
    const changes: number[] = []
    env.timer.on('changed', (snapshots) => changes.push(snapshots.length))

    env.timer.start({ projectId: projectA.id })
    env.timer.start({ projectId: projectB.id })

    expect(changes).toEqual([1, 2])
  })

  it('pauses and stops timers independently', () => {
    vi.useFakeTimers()
    const projectA = createProject('Project A')
    const projectB = createProject('Project B')
    const timerA = env.timer.start({ projectId: projectA.id })
    const timerB = env.timer.start({ projectId: projectB.id })

    vi.advanceTimersByTime(30_000)
    env.timer.pause(timerA.timer.id)
    vi.advanceTimersByTime(20_000)

    const snapshots = env.timer.getSnapshots()
    expect(snapshots.find((snapshot) => snapshot.timer.id === timerA.timer.id)?.elapsedSeconds).toBe(30)
    expect(snapshots.find((snapshot) => snapshot.timer.id === timerB.timer.id)?.elapsedSeconds).toBe(50)

    const entry = env.timer.stop(timerA.timer.id)
    expect(entry?.projectId).toBe(projectA.id)
    expect(env.timer.getSnapshots().map((snapshot) => snapshot.timer.id)).toEqual([timerB.timer.id])
    vi.useRealTimers()
  })

  it('pause freezes elapsed time and resume continues counting', () => {
    vi.useFakeTimers()
    const project = createProject()
    const timer = env.timer.start({ projectId: project.id })

    vi.advanceTimersByTime(30_000)
    env.timer.pause(timer.timer.id)
    vi.advanceTimersByTime(45_000)
    const paused = env.timer.getSnapshots()[0]
    expect(paused?.elapsedSeconds).toBe(30)

    env.timer.resume(timer.timer.id)
    vi.advanceTimersByTime(10_000)
    const resumed = env.timer.getSnapshots()[0]
    expect(resumed?.elapsedSeconds).toBe(40)
    vi.useRealTimers()
  })

  it('restore() reflects the persisted timer after a simulated restart', () => {
    const project = createProject()
    env.timer.start({ projectId: project.id })

    // Simulate an app restart: a brand new TimerService instance reading
    // from the same database must see the same running timer.
    const revived = new TimerService(env.db, env.projects, env.tasks, env.timeEntries, env.settings)
    const snapshots = revived.restore()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.project.id).toBe(project.id)
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
    const snapshot = env.timer.getSnapshots()[0]
    // 6 minutes elapsed total, 5 minutes discarded -> ~1 minute counted
    expect(snapshot?.elapsedSeconds).toBeGreaterThanOrEqual(59)
    expect(snapshot?.elapsedSeconds).toBeLessThanOrEqual(61)
    vi.useRealTimers()
  })

  it('applies idle resolution to every running timer', () => {
    vi.useFakeTimers()
    const start = Date.now()
    const projectA = createProject('Project A')
    const projectB = createProject('Project B')
    env.timer.start({ projectId: projectA.id })
    env.timer.start({ projectId: projectB.id })

    vi.advanceTimersByTime(60_000)
    const idleStartedAt = new Date(start + 60_000).toISOString()
    vi.advanceTimersByTime(5 * 60_000)
    env.timer.notifyIdleDetected(idleStartedAt, 300)
    env.timer.resolveIdlePrompt('discard')

    expect(env.timer.getSnapshots()).toHaveLength(2)
    for (const snapshot of env.timer.getSnapshots()) {
      expect(snapshot.elapsedSeconds).toBeGreaterThanOrEqual(59)
      expect(snapshot.elapsedSeconds).toBeLessThanOrEqual(61)
    }
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

    const [closedEntry] = env.timer.resolveIdlePrompt('split')
    expect(closedEntry?.durationSeconds).toBe(60)

    const snapshot = env.timer.getSnapshots()[0]
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

    const snapshot = env.timer.getSnapshots()[0]
    expect(snapshot?.elapsedSeconds).toBeGreaterThanOrEqual(359)
    vi.useRealTimers()
  })
})
