<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Pause, Play, Square } from '@lucide/vue'
import { formatDurationClock } from '@shared/utils/duration'
import { useTimerStore } from '../../stores/timer'

const timerStore = useTimerStore()
const { t } = useI18n()
</script>

<template>
  <div class="tt-drag flex h-screen w-screen flex-col gap-3 overflow-y-auto bg-base-200 p-4 text-base-content">
    <div class="flex items-center justify-between">
      <span class="text-xs font-semibold uppercase tracking-wide text-base-content/60">
        {{ t('miniTimer.active', timerStore.snapshots.length) }}
      </span>
      <span class="font-mono text-sm font-semibold tabular-nums">
        {{ t('miniTimer.total', { duration: formatDurationClock(timerStore.totalElapsedSeconds) }) }}
      </span>
    </div>

    <div v-if="timerStore.isRunning" class="space-y-2">
      <div
        v-for="snapshot in timerStore.snapshots"
        :key="snapshot.timer.id"
        class="tt-no-drag rounded-lg border border-base-300 border-l-[3px] bg-base-100/70 p-2.5"
        :class="snapshot.isPaused ? 'opacity-65' : ''"
        :style="{ borderLeftColor: snapshot.project.color }"
      >
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full tt-pulse" :style="{ backgroundColor: snapshot.project.color }" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ snapshot.project.name }}</span>
          <div class="flex shrink-0 gap-1">
            <button
              class="btn btn-ghost btn-xs btn-square"
              @click="snapshot.isPaused ? timerStore.resume(snapshot.timer.id) : timerStore.pause(snapshot.timer.id)"
            >
              <Play v-if="snapshot.isPaused" :size="12" />
              <Pause v-else :size="12" />
            </button>
            <button class="btn btn-error btn-xs btn-square" @click="timerStore.stop(snapshot.timer.id)">
              <Square :size="12" />
            </button>
          </div>
        </div>
        <div class="mt-1 flex items-center justify-between gap-2 pl-4.5">
          <p class="truncate text-xs text-base-content/60">{{ snapshot.task?.name ?? t('common.noTask') }}</p>
          <span class="font-mono text-base font-semibold tabular-nums">
            {{ formatDurationClock(timerStore.elapsedSeconds(snapshot.timer.id)) }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="my-auto text-center text-sm text-base-content/60">{{ t('miniTimer.empty') }}</div>
  </div>
</template>

<style scoped>
.tt-drag {
  -webkit-app-region: drag;
}
.tt-no-drag {
  -webkit-app-region: no-drag;
}
</style>
