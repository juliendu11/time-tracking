<script setup lang="ts">
import { computed } from 'vue'
import type { AdditionalMetrics } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'

const props = defineProps<{ metrics: AdditionalMetrics }>()

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const mostProductiveDayLabel = computed(() =>
  props.metrics.mostProductiveWeekday === null ? '—' : WEEKDAYS[props.metrics.mostProductiveWeekday]
)

const mostProductiveHourLabel = computed(() => {
  const r = props.metrics.mostProductiveHourRange
  if (!r) return '—'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(r.startHour)}:00 → ${pad(r.endHour)}:00`
})
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-3 text-sm font-semibold">This week at a glance</h2>
    <dl class="grid grid-cols-2 gap-3 text-sm">
      <div>
        <dt class="text-xs text-base-content/50">Daily average</dt>
        <dd class="font-medium">{{ formatDurationCompact(metrics.dailyAverageSeconds) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">Longest session</dt>
        <dd class="font-medium">{{ formatDurationCompact(metrics.longestSessionSeconds) }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">Sessions today / week</dt>
        <dd class="font-medium">{{ metrics.sessionsToday }} / {{ metrics.sessionsWeek }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">Active days</dt>
        <dd class="font-medium">{{ metrics.activeDaysWeek }} / 7</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">Current streak</dt>
        <dd class="font-medium">{{ metrics.currentStreakDays }} day{{ metrics.currentStreakDays === 1 ? '' : 's' }}</dd>
      </div>
      <div>
        <dt class="text-xs text-base-content/50">Most productive day</dt>
        <dd class="font-medium">{{ mostProductiveDayLabel }}</dd>
      </div>
      <div class="col-span-2">
        <dt class="text-xs text-base-content/50">Most productive period</dt>
        <dd class="font-medium">{{ mostProductiveHourLabel }}</dd>
      </div>
      <div
        v-if="metrics.weeklyConsistencyPercent !== null"
        class="col-span-2 border-t border-base-300 pt-2"
        title="100% minus the coefficient of variation across worked days this week"
      >
        <dt class="text-xs text-base-content/50">Weekly consistency</dt>
        <dd class="font-medium">{{ metrics.weeklyConsistencyPercent }}%</dd>
      </div>
    </dl>
  </div>
</template>
