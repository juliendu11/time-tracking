<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import type { AdditionalMetrics } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { weekdayName } from '../../../i18n'

const props = defineProps<{ metrics: AdditionalMetrics }>()
const { t, locale } = useI18n()

const mostProductiveDayLabel = computed(() => {
  const weekday = props.metrics.mostProductiveWeekday
  return weekday === null ? '—' : weekdayName(weekday, locale.value)
})

const mostProductiveHourLabel = computed(() => {
  const r = props.metrics.mostProductiveHourRange
  if (!r) return '—'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(r.startHour)}:00 → ${pad(r.endHour)}:00`
})
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-3 text-sm font-semibold">{{ t('dashboard.metrics.title') }}</h2>
    <dl class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.dailyAverage') }}</dt>
        <dd class="font-medium">{{ formatDurationCompact(metrics.dailyAverageSeconds) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.longestSession') }}</dt>
        <dd class="font-medium">{{ formatDurationCompact(metrics.longestSessionSeconds) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.sessionsTodayWeek') }}</dt>
        <dd class="font-medium">{{ metrics.sessionsToday }} / {{ metrics.sessionsWeek }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.activeDays') }}</dt>
        <dd class="font-medium">{{ metrics.activeDaysWeek }} / 7</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.currentStreak') }}</dt>
        <dd class="font-medium">{{ t('dashboard.metrics.streakDays', metrics.currentStreakDays) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.mostProductiveDay') }}</dt>
        <dd class="font-medium">{{ mostProductiveDayLabel }}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.mostProductivePeriod') }}</dt>
        <dd class="font-medium">{{ mostProductiveHourLabel }}</dd>
      </div>
      <div
        v-if="metrics.weeklyConsistencyPercent !== null"
        class="col-span-2 border-t border-base-300 pt-2"
        :title="t('dashboard.metrics.consistencyHint')"
      >
        <dt class="text-xs text-base-content/50">{{ t('dashboard.metrics.weeklyConsistency') }}</dt>
        <dd class="font-medium">{{ metrics.weeklyConsistencyPercent }}%</dd>
      </div>
    </dl>
  </div>
</template>
