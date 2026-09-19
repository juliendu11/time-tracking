import {computed, ref} from 'vue'
import {defineStore} from 'pinia'
import {computeElapsedSeconds} from '@shared/utils/time'
import {useUiStore} from './ui'
import type {IdlePromptPayload, IdleResolution, RunningTimerSnapshot, TimeEntry} from '@shared/types/domain'

export const useTimerStore = defineStore('timer', () => {
    const snapshots = ref<RunningTimerSnapshot[]>([])
    const idlePrompt = ref<IdlePromptPayload | null>(null)
    const now = ref(new Date())

    let tickHandle: number | undefined
    let unsubscribeChanged: (() => void) | null = null
    let unsubscribeIdle: (() => void) | null = null

    async function init(): Promise<void> {
        await refresh()
        idlePrompt.value = await window.desktop.timer.getPendingIdlePrompt()

        unsubscribeChanged = window.desktop.timer.onChanged((next) => {
            const stopped = next.length < snapshots.value.length
            snapshots.value = next
            if (stopped) useUiStore().notifyDataChanged()
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

    const isRunning = computed(() => snapshots.value.length > 0)
    const elapsedSecondsById = computed<Record<string, number>>(() =>
        Object.fromEntries(
            snapshots.value.map((snapshot) => [
                snapshot.timer.id,
                computeElapsedSeconds({
                    startedAt: snapshot.timer.startedAt,
                    accumulatedPauseSeconds: snapshot.timer.accumulatedPauseSeconds,
                    pausedAt: snapshot.timer.pausedAt,
                    now: now.value
                })
            ])
        )
    )
    const totalElapsedSeconds = computed(() =>
        Object.values(elapsedSecondsById.value).reduce((sum, seconds) => sum + seconds, 0)
    )

    function elapsedSeconds(timerId: string): number {
        return elapsedSecondsById.value[timerId] ?? 0
    }

    async function refresh(): Promise<void> {
        snapshots.value = await window.desktop.timer.getSnapshots()
    }

    async function start(params: {
        projectId: string
        taskId?: string | null
        description?: string | null
    }): Promise<RunningTimerSnapshot> {
        const snapshot = await window.desktop.timer.start(params)
        await refresh()
        return snapshot
    }

    async function stop(timerId: string): Promise<TimeEntry | null> {
        const entry = await window.desktop.timer.stop(timerId)
        await refresh()
        useUiStore().notifyDataChanged()
        return entry
    }

    async function pause(timerId: string): Promise<void> {
        await window.desktop.timer.pause(timerId)
        await refresh()
    }

    async function resume(timerId: string): Promise<void> {
        await window.desktop.timer.resume(timerId)
        await refresh()
    }

    async function resolveIdle(resolution: IdleResolution): Promise<void> {
        await window.desktop.timer.resolveIdlePrompt(resolution)
        idlePrompt.value = null
    }

    return {
        snapshots,
        idlePrompt,
        isRunning,
        elapsedSecondsById,
        totalElapsedSeconds,
        elapsedSeconds,
        refresh,
        init,
        dispose,
        start,
        stop,
        pause,
        resume,
        resolveIdle
    }
})
