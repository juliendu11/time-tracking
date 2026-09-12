<script setup lang="ts">
import { computed } from 'vue'
import type { HeatmapDay } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'

const props = defineProps<{ days: HeatmapDay[]; filterCurrentOnly: boolean }>()
const emit = defineEmits<{ toggleFilter: []; selectDay: [date: string] }>()

const maxSeconds = computed(() => Math.max(1, ...props.days.map((d) => d.durationSeconds)))

function intensity(seconds: number): number {
  if (seconds <= 0) return 0
  const ratio = seconds / maxSeconds.value
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}

/** Weeks as columns (GitHub-style), each an array of 7 days (Sun-Sat). */
const weeks = computed(() => {
  const result: HeatmapDay[][] = []
  let currentWeek: HeatmapDay[] = []

  const firstDate = props.days[0] ? new Date(`${props.days[0].date}T00:00:00`) : null
  const leadingEmpty = firstDate ? firstDate.getDay() : 0
  for (let i = 0; i < leadingEmpty; i += 1) {
    currentWeek.push({ date: '', durationSeconds: 0, sessions: 0, projectCount: 0 })
  }

  for (const day of props.days) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      result.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) result.push(currentWeek)
  return result
})

function tooltip(day: HeatmapDay): string {
  if (!day.date) return ''
  const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
  return `${label}\n${formatDurationSpaced(day.durationSeconds)} tracked\n${day.projectCount} project${
    day.projectCount === 1 ? '' : 's'
  }\n${day.sessions} session${day.sessions === 1 ? '' : 's'}`
}
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-sm font-semibold">Activity — last 12 months</h2>
      <div class="flex rounded-lg border border-base-300 p-0.5 text-xs">
        <button
          class="rounded-md px-2 py-1"
          :class="!filterCurrentOnly ? 'bg-primary/15 text-primary' : ''"
          @click="filterCurrentOnly && emit('toggleFilter')"
        >
          All Projects
        </button>
        <button
          class="rounded-md px-2 py-1"
          :class="filterCurrentOnly ? 'bg-primary/15 text-primary' : ''"
          @click="!filterCurrentOnly && emit('toggleFilter')"
        >
          Current Project
        </button>
      </div>
    </div>
    <div class="overflow-x-auto">
      <div class="flex gap-[3px]">
        <div v-for="(week, wi) in weeks" :key="wi" class="flex flex-col gap-[3px]">
          <button
            v-for="(day, di) in week"
            :key="di"
            class="h-[11px] w-[11px] rounded-[2px]"
            :class="[
              !day.date ? 'invisible' : '',
              intensity(day.durationSeconds) === 0 ? 'bg-base-300/50' : '',
              intensity(day.durationSeconds) === 1 ? 'bg-primary/25' : '',
              intensity(day.durationSeconds) === 2 ? 'bg-primary/50' : '',
              intensity(day.durationSeconds) === 3 ? 'bg-primary/75' : '',
              intensity(day.durationSeconds) === 4 ? 'bg-primary' : ''
            ]"
            :title="tooltip(day)"
            @click="day.date && emit('selectDay', day.date)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
