<script setup lang="ts">
import type { FocusScoreBreakdown } from '@shared/types/domain'

defineProps<{ score: FocusScoreBreakdown }>()
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <div class="mb-1 flex items-center justify-between">
      <h2 class="text-sm font-semibold">Focus Score</h2>
      <div class="tooltip tooltip-left" :data-tip="`Avg session ${score.averageSessionMinutes}m · ${score.interruptionCount} interruptions · goal ${score.dailyGoalReached ? 'reached' : 'not reached'}`">
        <span class="text-xs text-base-content/40">ⓘ</span>
      </div>
    </div>
    <p class="text-2xl font-semibold">{{ score.score }} <span class="text-sm font-normal text-base-content/50">/ 100</span></p>
    <progress class="progress progress-primary mt-2 w-full" :value="score.score" max="100" />
    <p class="mt-2 text-xs text-base-content/50">
      Based on session length, interruptions, and today's goal. Not a scientific measure of productivity.
    </p>
  </div>
</template>
