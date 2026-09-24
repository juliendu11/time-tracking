<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { TimeEntry, TimeFormat } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { MINUTES_PER_DAY, type ScheduleBlock } from '@shared/utils/schedule'
import { toLocalDateKey } from '@shared/utils/time'
import { useProjectsStore } from '../../../stores/projects'

const props = defineProps<{
  days: Date[]
  columns: Map<string, ScheduleBlock<TimeEntry>[]>
  /** First visible hour; the grid always runs until midnight. */
  startHour: number
  timeFormat: TimeFormat
  /** Show the weekday/date header above each column (weekly view). */
  showHeader: boolean
}>()

const emit = defineEmits<{ select: [entry: TimeEntry]; selectDay: [day: Date] }>()

const projectsStore = useProjectsStore()

const HOUR_HEIGHT = 56
const MIN_BLOCK_HEIGHT = 18

const hours = computed(() => {
  const list: number[] = []
  for (let h = props.startHour; h < 24; h += 1) list.push(h)
  return list
})
const gridHeight = computed(() => hours.value.length * HOUR_HEIGHT)

// Re-evaluated every minute so the "now" line and today marker stay current.
const now = ref(new Date())
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tick = setInterval(() => (now.value = new Date()), 60_000)
})
onBeforeUnmount(() => clearInterval(tick))

const todayKey = computed(() => toLocalDateKey(now.value))

function minuteToY(minute: number): number {
  return ((minute - props.startHour * 60) / 60) * HOUR_HEIGHT
}

const nowY = computed(() => {
  const minutes = now.value.getHours() * 60 + now.value.getMinutes()
  return minutes < props.startHour * 60 ? null : minuteToY(minutes)
})

function formatHour(hour: number): string {
  if (props.timeFormat === '12h') {
    const suffix = hour < 12 ? 'AM' : 'PM'
    return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`
  }
  return `${String(hour).padStart(2, '0')}:00`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: props.timeFormat === '12h'
  })
}

function projectColor(id: string): string {
  return projectsStore.byId(id)?.color ?? '#888'
}
function projectName(id: string): string {
  return projectsStore.byId(id)?.name ?? 'Unknown'
}

function blockStyle(block: ScheduleBlock<TimeEntry>): Record<string, string> {
  const visibleStart = Math.max(block.startMinute, props.startHour * 60)
  const top = minuteToY(visibleStart)
  const bottom = minuteToY(Math.min(block.endMinute, MINUTES_PER_DAY))
  const color = projectColor(block.item.projectId)
  const width = 100 / block.laneCount
  return {
    top: `${top}px`,
    height: `${Math.max(MIN_BLOCK_HEIGHT, bottom - top - 2)}px`,
    left: `calc(${block.lane * width}% + 2px)`,
    width: `calc(${width}% - 4px)`,
    borderLeftColor: color,
    backgroundColor: `${color}24`
  }
}

/** Pixel height available to the block, used to decide how much text fits. */
function blockHeight(block: ScheduleBlock<TimeEntry>): number {
  const visibleStart = Math.max(block.startMinute, props.startHour * 60)
  return minuteToY(block.endMinute) - minuteToY(visibleStart)
}

/** Overlapping lanes in a week column are too narrow for the secondary lines. */
function isNarrow(block: ScheduleBlock<TimeEntry>): boolean {
  return props.showHeader ? block.laneCount > 1 : block.laneCount > 3
}

function dayTotalSeconds(day: Date): number {
  const blocks = props.columns.get(toLocalDateKey(day)) ?? []
  return blocks.reduce((sum, block) => sum + (block.endMinute - block.startMinute) * 60, 0)
}

function isWeekend(day: Date): boolean {
  return day.getDay() === 0 || day.getDay() === 6
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-base-300 bg-base-100">
    <!-- Column headers -->
    <div
      v-if="showHeader"
      class="sticky top-0 z-20 grid border-b border-base-300 bg-base-100"
      :style="{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }"
    >
      <div class="border-r border-base-300" />
      <button
        v-for="day in days"
        :key="toLocalDateKey(day)"
        type="button"
        class="group flex flex-col items-center gap-0.5 border-r border-base-300 py-2 last:border-r-0 hover:bg-base-200/60"
        :class="isWeekend(day) ? 'bg-base-200/30' : ''"
        :title="day.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })"
        @click="emit('selectDay', day)"
      >
        <span
          class="text-[11px] font-medium uppercase tracking-wide"
          :class="toLocalDateKey(day) === todayKey ? 'text-primary' : 'text-base-content/50'"
        >
          {{ day.toLocaleDateString(undefined, { weekday: 'short' }) }}
        </span>
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold tabular-nums"
          :class="toLocalDateKey(day) === todayKey ? 'bg-primary text-primary-content' : 'group-hover:bg-base-300/60'"
        >
          {{ day.getDate() }}
        </span>
        <span class="text-[11px] tabular-nums text-base-content/40">
          {{ dayTotalSeconds(day) > 0 ? formatDurationCompact(dayTotalSeconds(day)) : '—' }}
        </span>
      </button>
    </div>

    <!-- Hour rows + day columns -->
    <div
      class="relative grid"
      :style="{
        gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))`,
        height: `${gridHeight}px`
      }"
    >
      <!-- Time gutter -->
      <div class="relative border-r border-base-300">
        <span
          v-for="(h, i) in hours"
          :key="h"
          class="absolute right-2 text-[11px] tabular-nums text-base-content/40"
          :class="i === 0 ? 'top-1' : '-translate-y-1/2'"
          :style="i === 0 ? {} : { top: `${i * HOUR_HEIGHT}px` }"
        >
          {{ formatHour(h) }}
        </span>
      </div>

      <!-- Hour / half-hour lines spanning all day columns -->
      <div class="pointer-events-none absolute bottom-0 left-14 right-0 top-0">
        <template v-for="(h, i) in hours" :key="h">
          <div v-if="i > 0" class="absolute left-0 right-0 border-t border-base-300/70" :style="{ top: `${i * HOUR_HEIGHT}px` }" />
          <div
            class="absolute left-0 right-0 border-t border-dashed border-base-300/40"
            :style="{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }"
          />
        </template>
      </div>

      <div
        v-for="day in days"
        :key="toLocalDateKey(day)"
        class="relative border-r border-base-300/70 last:border-r-0"
        :class="[
          isWeekend(day) && showHeader ? 'bg-base-200/30' : '',
          toLocalDateKey(day) === todayKey && showHeader ? 'bg-primary/[0.04]' : ''
        ]"
      >
        <button
          v-for="block in columns.get(toLocalDateKey(day)) ?? []"
          :key="block.item.id"
          type="button"
          class="absolute z-10 flex flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs leading-tight shadow-sm transition hover:z-20 hover:shadow-md hover:brightness-95"
          :class="[block.continuesBefore ? 'rounded-t-none' : '', block.continuesAfter ? 'rounded-b-none' : '']"
          :style="blockStyle(block)"
          :title="`${projectName(block.item.projectId)} · ${formatTime(block.item.startedAt)} – ${formatTime(block.item.endedAt as string)}${block.item.description ? `\n${block.item.description}` : ''}`"
          @click="emit('select', block.item)"
        >
          <p class="truncate font-semibold">{{ projectName(block.item.projectId) }}</p>
          <p v-if="blockHeight(block) >= 34 && !isNarrow(block)" class="truncate tabular-nums text-base-content/60">
            {{ formatTime(block.item.startedAt) }} – {{ formatTime(block.item.endedAt as string) }}
          </p>
          <p v-if="blockHeight(block) >= 52 && !isNarrow(block) && block.item.description" class="truncate text-base-content/70">
            {{ block.item.description }}
          </p>
          <p v-if="blockHeight(block) >= 70" class="mt-auto tabular-nums text-base-content/50">
            {{ formatDurationCompact(block.item.durationSeconds) }}
          </p>
        </button>

        <!-- Current time indicator -->
        <div
          v-if="toLocalDateKey(day) === todayKey && nowY !== null"
          class="pointer-events-none absolute left-0 right-0 z-30 border-t-2 border-error"
          :style="{ top: `${nowY}px` }"
        >
          <span class="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-error" />
        </div>
      </div>
    </div>
  </div>
</template>
