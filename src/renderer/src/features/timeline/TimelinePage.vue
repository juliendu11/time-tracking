<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from '@lucide/vue'
import { addDays } from 'date-fns'
import type { TimeEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { layoutScheduleDays } from '@shared/utils/schedule'
import { getLocalDayRange, getLocalWeekRange } from '@shared/utils/time'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'
import ManualEntryModal from '../timer/ManualEntryModal.vue'
import ScheduleGrid from './components/ScheduleGrid.vue'

type ViewMode = 'day' | 'week'
const VIEW_STORAGE_KEY = 'timeline.viewMode'
const DEFAULT_START_HOUR = 6

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const { t, locale } = useI18n()
const currentDate = ref(new Date())
const viewMode = ref<ViewMode>(localStorage.getItem(VIEW_STORAGE_KEY) === 'week' ? 'week' : 'day')
const entries = ref<TimeEntry[]>([])
const editingEntry = ref<TimeEntry | null>(null)

watch(viewMode, (mode) => localStorage.setItem(VIEW_STORAGE_KEY, mode))

const weekStartsOn = computed(() => settingsStore.settings?.weekStartsOn ?? 1)
const timeFormat = computed(() => settingsStore.settings?.timeFormat ?? '24h')

const range = computed(() =>
  viewMode.value === 'week'
    ? getLocalWeekRange(currentDate.value, weekStartsOn.value)
    : getLocalDayRange(currentDate.value)
)

const days = computed(() => {
  const count = viewMode.value === 'week' ? 7 : 1
  return Array.from({ length: count }, (_, i) => addDays(range.value.start, i))
})

const periodLabel = computed(() => {
  if (viewMode.value === 'day') {
    return currentDate.value.toLocaleDateString(locale.value, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }
  const first = range.value.start
  const last = addDays(range.value.end, -1)
  const firstLabel = first.toLocaleDateString(locale.value, {
    day: 'numeric',
    month: first.getMonth() === last.getMonth() ? undefined : 'short',
    year: first.getFullYear() === last.getFullYear() ? undefined : 'numeric'
  })
  const lastLabel = last.toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
  return `${firstLabel} – ${lastLabel}`
})

const isCurrentPeriod = computed(() => {
  const now = Date.now()
  return now >= range.value.start.getTime() && now < range.value.end.getTime()
})

async function load(): Promise<void> {
  const { start, end } = range.value
  entries.value = await window.desktop.timeEntries.listInRange(start.toISOString(), end.toISOString())
}

onMounted(async () => {
  if (!settingsStore.settings) await settingsStore.load()
  await load()
})
watch(() => [range.value.start.getTime(), range.value.end.getTime()], load)
watch(() => uiStore.dataVersion, load)

function shift(delta: number): void {
  currentDate.value = addDays(currentDate.value, delta * (viewMode.value === 'week' ? 7 : 1))
}

function goToday(): void {
  currentDate.value = new Date()
}

function openDay(day: Date): void {
  currentDate.value = day
  viewMode.value = 'day'
}

const columns = computed(() => layoutScheduleDays(entries.value, days.value))

/** Extend the grid upwards when something was tracked before 06:00. */
const startHour = computed(() => {
  let earliest = DEFAULT_START_HOUR * 60
  for (const blocks of columns.value.values()) {
    for (const block of blocks) earliest = Math.min(earliest, block.startMinute)
  }
  return Math.floor(earliest / 60)
})

const totalSeconds = computed(() => {
  let sum = 0
  for (const blocks of columns.value.values()) {
    for (const block of blocks) sum += (block.endMinute - block.startMinute) * 60
  }
  return Math.round(sum)
})

const isEmpty = computed(() => [...columns.value.values()].every((blocks) => blocks.length === 0))
</script>

<template>
  <div class="mx-auto space-y-4 p-6" :class="viewMode === 'week' ? 'max-w-6xl' : 'max-w-4xl'">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">{{ t('routes.timeline') }}</h1>
      <div class="flex items-center gap-3">
        <div class="join" role="group" :aria-label="t('timeline.viewLabel')">
          <button
            type="button"
            class="btn join-item btn-sm gap-1.5"
            :class="viewMode === 'day' ? 'btn-active btn-neutral' : 'btn-ghost border-base-300'"
            :aria-pressed="viewMode === 'day'"
            @click="viewMode = 'day'"
          >
            <CalendarDays :size="14" /> {{ t('timeline.day') }}
          </button>
          <button
            type="button"
            class="btn join-item btn-sm gap-1.5"
            :class="viewMode === 'week' ? 'btn-active btn-neutral' : 'btn-ghost border-base-300'"
            :aria-pressed="viewMode === 'week'"
            @click="viewMode = 'week'"
          >
            <CalendarRange :size="14" /> {{ t('timeline.week') }}
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            class="btn btn-ghost btn-sm btn-square"
            :aria-label="viewMode === 'week' ? t('timeline.previousWeek') : t('timeline.previousDay')"
            @click="shift(-1)"
          >
            <ChevronLeft :size="16" />
          </button>
          <button class="btn btn-ghost btn-sm" :class="isCurrentPeriod ? 'btn-disabled' : ''" @click="goToday">
            {{ t('dashboard.header.today') }}
          </button>
          <button
            class="btn btn-ghost btn-sm btn-square"
            :aria-label="viewMode === 'week' ? t('timeline.nextWeek') : t('timeline.nextDay')"
            @click="shift(1)"
          >
            <ChevronRight :size="16" />
          </button>
        </div>
      </div>
    </div>

    <div class="flex items-baseline justify-between text-sm">
      <p class="text-base-content/60">{{ periodLabel }}</p>
      <p v-if="!isEmpty" class="tabular-nums text-base-content/50">
        {{ t('dashboard.heatmap.tracked', { duration: formatDurationCompact(totalSeconds) }) }}
      </p>
    </div>

    <ScheduleGrid
      :days="days"
      :columns="columns"
      :start-hour="startHour"
      :time-format="timeFormat"
      :show-header="viewMode === 'week'"
      @select="editingEntry = $event"
      @select-day="openDay"
    />

    <p v-if="isEmpty" class="py-6 text-center text-sm text-base-content/40">
      {{ viewMode === 'week' ? t('timeline.emptyWeek') : t('dashboard.dayDrawer.empty') }}
    </p>

    <ManualEntryModal v-if="editingEntry" :entry="editingEntry" @close="editingEntry = null; load()" />
  </div>
</template>
