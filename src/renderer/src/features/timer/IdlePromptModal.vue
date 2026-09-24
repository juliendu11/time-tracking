<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { IdleResolution } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'
import { useTimerStore } from '../../stores/timer'

const timerStore = useTimerStore()
const prompt = computed(() => timerStore.idlePrompt)
const { t } = useI18n()

async function resolve(resolution: IdleResolution): Promise<void> {
  await timerStore.resolveIdle(resolution)
}
</script>

<template>
  <div v-if="prompt" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
      <h2 class="mb-1 text-base font-semibold">{{ t('idle.title') }}</h2>
      <p class="mb-4 text-sm text-base-content/70">
        <i18n-t keypath="idle.body" scope="global">
          <template #duration>
            <span class="font-medium">{{ formatDurationSpaced(prompt.idleSeconds) }}</span>
          </template>
        </i18n-t>
      </p>

      <div class="space-y-2">
        <button class="btn btn-sm w-full justify-start" @click="resolve('discard')">
          {{ t('idle.discard') }}
          <span class="ml-auto text-xs text-base-content/50">{{ t('idle.discardHint') }}</span>
        </button>
        <button class="btn btn-sm w-full justify-start" @click="resolve('keep')">
          {{ t('idle.keep') }}
          <span class="ml-auto text-xs text-base-content/50">{{ t('idle.keepHint') }}</span>
        </button>
        <button class="btn btn-sm w-full justify-start" @click="resolve('split')">
          {{ t('idle.split') }}
          <span class="ml-auto text-xs text-base-content/50">{{ t('idle.splitHint') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
