<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FocusScoreBreakdown } from '@shared/types/domain'

defineProps<{ score: FocusScoreBreakdown }>()

const { t } = useI18n()
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <div class="mb-1 flex items-center justify-between">
      <h2 class="text-sm font-semibold">{{ t('dashboard.focus.title') }}</h2>
      <div class="tooltip tooltip-left" :data-tip="t(score.dailyGoalReached ? 'dashboard.focus.tooltipReached' : 'dashboard.focus.tooltipNotReached', { minutes: score.averageSessionMinutes, interruptions: score.interruptionCount })">
        <span class="text-xs text-base-content/40">ⓘ</span>
      </div>
    </div>
    <p class="text-2xl font-semibold">{{ score.score }} <span class="text-sm font-normal text-base-content/50">/ 100</span></p>
    <progress class="progress progress-primary mt-2 w-full" :value="score.score" max="100" />
    <p class="mt-2 text-xs text-base-content/50">
      {{ t('dashboard.focus.disclaimer') }}
    </p>
  </div>
</template>
