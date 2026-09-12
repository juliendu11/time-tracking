<script setup lang="ts">
import { computed } from 'vue'
import type { IdleResolution } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'
import { useTimerStore } from '../../stores/timer'

const timerStore = useTimerStore()
const prompt = computed(() => timerStore.idlePrompt)

async function resolve(resolution: IdleResolution): Promise<void> {
  await timerStore.resolveIdle(resolution)
}
</script>

<template>
  <div v-if="prompt" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
      <h2 class="mb-1 text-base font-semibold">Welcome back</h2>
      <p class="mb-4 text-sm text-base-content/70">
        You were inactive for <span class="font-medium">{{ formatDurationSpaced(prompt.idleSeconds) }}</span>.
        What should we do with that time?
      </p>

      <div class="space-y-2">
        <button class="btn btn-sm w-full justify-start" @click="resolve('discard')">
          Remove idle time
          <span class="ml-auto text-xs text-base-content/50">Subtract it from this session</span>
        </button>
        <button class="btn btn-sm w-full justify-start" @click="resolve('keep')">
          Keep idle time
          <span class="ml-auto text-xs text-base-content/50">Count it as worked</span>
        </button>
        <button class="btn btn-sm w-full justify-start" @click="resolve('split')">
          Split session
          <span class="ml-auto text-xs text-base-content/50">Close it, start a new one now</span>
        </button>
      </div>
    </div>
  </div>
</template>
