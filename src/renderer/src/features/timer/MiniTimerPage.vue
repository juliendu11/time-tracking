<script setup lang="ts">
import { computed } from 'vue'
import { Square } from '@lucide/vue'
import { formatDurationClock } from '@shared/utils/duration'
import { useTimerStore } from '../../stores/timer'

const timerStore = useTimerStore()
const snapshot = computed(() => timerStore.snapshot)
</script>

<template>
  <div class="tt-drag flex h-screen w-screen flex-col justify-between bg-base-200 p-4 text-base-content">
    <div v-if="snapshot" class="flex flex-col gap-1">
      <div class="flex items-center gap-2">
        <span class="h-2.5 w-2.5 rounded-full tt-pulse" :style="{ backgroundColor: snapshot.project.color }" />
        <span class="truncate text-sm font-medium">{{ snapshot.project.name }}</span>
      </div>
      <p v-if="snapshot.task" class="truncate text-xs text-base-content/60">{{ snapshot.task.name }}</p>
    </div>
    <div v-else class="text-sm text-base-content/60">No timer running</div>

    <div class="text-center font-mono text-3xl font-semibold tabular-nums">
      {{ formatDurationClock(timerStore.elapsedSeconds) }}
    </div>

    <button
      class="tt-no-drag btn btn-sm btn-error gap-1 self-center"
      :disabled="!snapshot"
      @click="timerStore.stop()"
    >
      <Square :size="14" />
      Stop
    </button>
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
