<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { DashboardSummary } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'

const props = defineProps<{ greeting: string; summary: DashboardSummary; loading: boolean }>()
const { t } = useI18n()

const goalLabel = computed(() => {
  if (!props.summary.weeklyGoalMinutes) return null
  return `${formatDurationSpaced(props.summary.weekSeconds)} / ${formatDurationSpaced(
    props.summary.weeklyGoalMinutes * 60
  )}`
})

const changeLabel = computed(() => {
  const pct = props.summary.changeVsLastWeekPercent
  if (pct === null) return null
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
})
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold">{{ greeting }} 👋</h1>
    <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">{{ t('dashboard.header.today') }}</p>
        <p class="mt-1 text-xl font-semibold">{{ formatDurationSpaced(summary.todaySeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">{{ t('dashboard.header.thisWeek') }}</p>
        <p class="mt-1 text-xl font-semibold">{{ formatDurationSpaced(summary.weekSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">{{ t('dashboard.header.weeklyGoal') }}</p>
        <p class="mt-1 text-xl font-semibold">{{ goalLabel ?? t('dashboard.header.notSet') }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
        <p class="text-xs font-medium uppercase tracking-wide text-base-content/50">{{ t('dashboard.header.vsLastWeek') }}</p>
        <p
          class="mt-1 text-xl font-semibold"
          :class="{
            'text-success': (summary.changeVsLastWeekPercent ?? 0) >= 0,
            'text-error': (summary.changeVsLastWeekPercent ?? 0) < 0
          }"
        >
          {{ changeLabel ?? '—' }}
        </p>
      </div>
    </div>
  </div>
</template>
