import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { computeElapsedSeconds } from '@shared/utils/time'
import type { IdlePromptPayload, IdleResolution, RunningTimerSnapshot, TimeEntry } from '@shared/types/domain'

export const useTimerStore = defineStore('timer', () => {
  const snapshot = ref<RunningTimerSnapshot | null>(null)
  const idlePrompt = ref<IdlePromptPayload | null>(null)
  const now = ref(new Date())

  let tickHandle: number | undefined
  let unsubscribeChanged: (() => void) | null = null
  let unsubscribeIdle: (() => void) | null = null

  async function init(): Promise<void> {
    snapshot.value = await window.desktop.timer.getSnapshot()
    idlePrompt.value = await window.desktop.timer.getPendingIdlePrompt()

    unsubscribeChanged = window.desktop.timer.onChanged((next) => {
      snapshot.value = next
    })
    unsubscribeIdle = window.desktop.timer.onIdleDetected((payload) => {
      idlePrompt.value = payload
    })

    tickHandle = window.setInterval(() => {
      now.value = new Date()
    }, 1000)
  }

  function dispose(): void {
    unsubscribeChanged?.()
    unsubscribeIdle?.()
    if (tickHandle) window.clearInterval(tickHandle)
  }

  const isRunning = computed(() => snapshot.value !== null)
  const isPaused = computed(() => snapshot.value?.isPaused ?? false)

  /** Always re-derived from timestamps on each tick, never incremented. */
  const elapsedSeconds = computed(() => {
    const state = snapshot.value?.timer
    if (!state) return 0
    return computeElapsedSeconds({
      startedAt: state.startedAt,
      accumulatedPauseSeconds: state.accumulatedPauseSeconds,
      pausedAt: state.pausedAt,
      now: now.value
    })
  })

  async function start(params: {
    projectId: string
    taskId?: string | null
    description?: string | null
  }): Promise<void> {
    snapshot.value = await window.desktop.timer.start(params)
  }

  async function stop(): Promise<TimeEntry | null> {
    const entry = await window.desktop.timer.stop()
    snapshot.value = null
    return entry
  }

  async function pause(): Promise<void> {
    snapshot.value = await window.desktop.timer.pause()
  }

  async function resume(): Promise<void> {
    snapshot.value = await window.desktop.timer.resume()
  }

  async function switchTask(taskId: string): Promise<void> {
    snapshot.value = await window.desktop.timer.switchTask(taskId)
  }

  async function switchProject(projectId: string): Promise<void> {
    snapshot.value = await window.desktop.timer.switchProject(projectId)
  }

  async function resolveIdle(resolution: IdleResolution): Promise<void> {
    await window.desktop.timer.resolveIdlePrompt(resolution)
    idlePrompt.value = null
  }

  return {
    snapshot,
    idlePrompt,
    isRunning,
    isPaused,
    elapsedSeconds,
    init,
    dispose,
    start,
    stop,
    pause,
    resume,
    switchTask,
    switchProject,
    resolveIdle
  }
})
