<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import type { TimeEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { buildMonthGrid, getMonthGridRange, shiftMonth, type CalendarDay } from '@shared/utils/calendar'
import { toLocalDateKey } from '@shared/utils/time'
import { useProjectsStore } from '../../stores/projects'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'
import ManualEntryModal from '../timer/ManualEntryModal.vue'

const MAX_CHIPS = 3

const projectsStore = useProjectsStore()
const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const currentMonth = ref(shiftMonth(new Date(), 0))
const selectedDate = ref(toLocalDateKey(new Date()))
const entries = ref<TimeEntry[]>([])
const editingEntry = ref<TimeEntry | null>(null)

const weekStartsOn = computed(() => settingsStore.settings?.weekStartsOn ?? 1)
const todayKey = computed(() => toLocalDateKey(new Date()))

const monthLabel = computed(() =>
  currentMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const isCurrentMonth = computed(() => {
  const now = new Date()
  return (
    currentMonth.value.getFullYear() === now.getFullYear() && currentMonth.value.getMonth() === now.getMonth()
  )
})

async function load(): Promise<void> {
  const { start, end } = getMonthGridRange(currentMonth.value, weekStartsOn.value)
  entries.value = await window.desktop.timeEntries.listInRange(start.toISOString(), end.toISOString())
}

onMounted(load)
watch([currentMonth, weekStartsOn], load)
watch(() => uiStore.dataVersion, load)

const days = computed(() => buildMonthGrid(currentMonth.value, weekStartsOn.value, entries.value))

const weekdayLabels = computed(() =>
  days.value
    .slice(0, 7)
    .map((d) => new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' }))
)

const monthTotal = computed(() =>
  days.value.filter((d) => d.inMonth).reduce((sum, d) => sum + d.totalSeconds, 0)
)

const maxDayTotal = computed(() => Math.max(1, ...days.value.map((d) => d.totalSeconds)))

const selectedDay = computed<CalendarDay | null>(
  () => days.value.find((d) => d.date === selectedDate.value) ?? null
)

const selectedDayLabel = computed(() =>
  new Date(`${selectedDate.value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })
)

function shift(delta: number): void {
  currentMonth.value = shiftMonth(currentMonth.value, delta)
}

function goToday(): void {
  currentMonth.value = shiftMonth(new Date(), 0)
  selectedDate.value = todayKey.value
}

function selectDay(day: CalendarDay): void {
  selectedDate.value = day.date
  if (!day.inMonth) currentMonth.value = shiftMonth(new Date(`${day.date}T12:00:00`), 0)
}

function projectColor(id: string): string {
  return projectsStore.byId(id)?.color ?? '#888'
}
function projectName(id: string): string {
  return projectsStore.byId(id)?.name ?? 'Unknown'
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/** Subtle background intensity so busy days stand out at a glance. */
function intensityStyle(day: CalendarDay): Record<string, string> {
  if (day.totalSeconds === 0) return {}
  const alpha = 0.04 + 0.16 * (day.totalSeconds / maxDayTotal.value)
  return { backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round(alpha * 100)}%, transparent)` }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Calendar</h1>
      <div class="flex items-center gap-1.5">
        <button class="btn btn-ghost btn-sm btn-square" aria-label="Previous month" @click="shift(-1)">
          <ChevronLeft :size="16" />
        </button>
        <button class="btn btn-ghost btn-sm" :class="isCurrentMonth ? 'btn-disabled' : ''" @click="goToday">Today</button>
        <button class="btn btn-ghost btn-sm btn-square" aria-label="Next month" @click="shift(1)">
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>
    <div class="flex items-baseline justify-between">
      <p class="text-sm capitalize text-base-content/60">{{ monthLabel }}</p>
      <p class="text-sm text-base-content/60">
        Total <span class="font-semibold text-base-content">{{ formatDurationCompact(monthTotal) }}</span>
      </p>
    </div>

    <div class="flex flex-col gap-4 lg:flex-row">
      <div class="min-w-0 flex-1 overflow-hidden rounded-xl border border-base-300 bg-base-200/30">
        <div class="grid grid-cols-7 border-b border-base-300 text-[11px] uppercase tracking-wide text-base-content/40">
          <div v-for="label in weekdayLabels" :key="label" class="px-2 py-1.5">{{ label }}</div>
        </div>
        <div class="grid grid-cols-7 grid-rows-6">
          <button
            v-for="(day, i) in days"
            :key="day.date"
            class="flex min-h-24 flex-col gap-1 border-base-300/60 p-1.5 text-left transition-colors hover:bg-base-300/40"
            :class="[
              i % 7 !== 6 ? 'border-r' : '',
              i < 35 ? 'border-b' : '',
              day.inMonth ? '' : 'opacity-40',
              day.date === selectedDate ? 'ring-2 ring-inset ring-primary' : ''
            ]"
            :style="intensityStyle(day)"
            @click="selectDay(day)"
          >
            <div class="flex items-center justify-between text-xs">
              <span
                class="flex h-5 min-w-5 items-center justify-center rounded-full px-1"
                :class="day.date === todayKey ? 'bg-primary font-semibold text-primary-content' : 'text-base-content/70'"
              >
                {{ day.dayOfMonth }}
              </span>
              <span v-if="day.totalSeconds > 0" class="font-medium tabular-nums text-base-content/70">
                {{ formatDurationCompact(day.totalSeconds) }}
              </span>
            </div>
            <div
              v-for="entry in day.entries.slice(0, MAX_CHIPS)"
              :key="entry.id"
              class="truncate rounded border-l-2 px-1 text-[11px] leading-4"
              :style="{
                borderColor: projectColor(entry.projectId),
                backgroundColor: projectColor(entry.projectId) + '22'
              }"
            >
              {{ entry.description || projectName(entry.projectId) }}
            </div>
            <p v-if="day.entries.length > MAX_CHIPS" class="px-1 text-[11px] text-base-content/50">
              +{{ day.entries.length - MAX_CHIPS }} more
            </p>
          </button>
        </div>
      </div>

      <aside class="w-full shrink-0 space-y-3 rounded-xl border border-base-300 bg-base-200/30 p-4 lg:w-72">
        <div>
          <p class="text-sm font-semibold capitalize">{{ selectedDayLabel }}</p>
          <p class="text-xs text-base-content/60">
            {{ formatDurationCompact(selectedDay?.totalSeconds ?? 0) }} tracked
          </p>
        </div>
        <div v-if="selectedDay && selectedDay.entries.length > 0" class="space-y-2">
          <button
            v-for="entry in selectedDay.entries"
            :key="entry.id"
            class="w-full rounded-md border-l-4 px-2 py-1.5 text-left text-xs shadow-sm hover:brightness-95"
            :style="{
              borderColor: projectColor(entry.projectId),
              backgroundColor: projectColor(entry.projectId) + '22'
            }"
            @click="editingEntry = entry"
          >
            <p class="truncate font-medium">{{ projectName(entry.projectId) }}</p>
            <p v-if="entry.description" class="truncate text-base-content/60">{{ entry.description }}</p>
            <p class="tabular-nums text-base-content/50">
              {{ timeLabel(entry.startedAt) }} – {{ entry.endedAt ? timeLabel(entry.endedAt) : '…' }}
              · {{ formatDurationCompact(entry.durationSeconds) }}
            </p>
          </button>
        </div>
        <p v-else class="py-6 text-center text-sm text-base-content/40">No time tracked on this day</p>
      </aside>
    </div>

    <ManualEntryModal v-if="editingEntry" :entry="editingEntry" @close="editingEntry = null; load()" />
  </div>
</template>
