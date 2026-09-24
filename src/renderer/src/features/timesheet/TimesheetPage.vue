<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Copy } from '@lucide/vue'
import type { TimeEntry, TimesheetWeek } from '@shared/types/domain'
import { formatDurationHm, parseDurationInput } from '@shared/utils/duration'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'

const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const { t, locale } = useI18n()

function startOfWeek(date: Date, weekStartsOn: 0 | 1): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = (day - weekStartsOn + 7) % 7
  d.setDate(d.getDate() - diff)
  return d
}

const anchorDate = ref(new Date())
const week = ref<TimesheetWeek | null>(null)
const weekEntries = ref<TimeEntry[]>([])
const editing = ref<{ rowKey: string; day: string } | null>(null)
const editValue = ref('')

const weekStartsOn = computed(() => settingsStore.settings?.weekStartsOn ?? 1)

async function load(): Promise<void> {
  const weekStart = startOfWeek(anchorDate.value, weekStartsOn.value)
  week.value = await window.desktop.reports.getTimesheetWeek(weekStart.toISOString(), weekStartsOn.value)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600_000)
  weekEntries.value = await window.desktop.timeEntries.listInRange(
    weekStart.toISOString(),
    weekEnd.toISOString()
  )
}

onMounted(load)
watch(anchorDate, load)
watch(() => uiStore.dataVersion, load)

function shiftWeek(delta: number): void {
  const next = new Date(anchorDate.value)
  next.setDate(next.getDate() + delta * 7)
  anchorDate.value = next
}

const dayKeys = computed(() => (week.value ? Object.keys(week.value.dailyTotals) : []))
const dayLabels = computed(() =>
  dayKeys.value.map((key) => new Date(`${key}T00:00:00`).toLocaleDateString(locale.value, { weekday: 'short' }))
)

function rowKeyOf(projectId: string, taskId: string | null): string {
  return `${projectId}::${taskId ?? 'none'}`
}

function startEdit(rowKey: string, day: string, currentSeconds: number): void {
  editing.value = { rowKey, day }
  editValue.value = currentSeconds > 0 ? formatDurationHm(currentSeconds) : ''
}

async function commitEdit(projectId: string, taskId: string | null, day: string): Promise<void> {
  if (!editing.value) return
  const target = editing.value
  editing.value = null
  const seconds = editValue.value.trim() ? parseDurationInput(editValue.value) : 0
  if (seconds === null) return

  const currentSeconds = week.value?.rows.find((r) => rowKeyOf(r.projectId, r.taskId) === target.rowKey)?.cells[day] ?? 0
  const delta = seconds - currentSeconds
  if (delta === 0) return

  const dayEntries = weekEntries.value
    .filter((e) => e.projectId === projectId && e.taskId === taskId && e.startedAt.slice(0, 10) === day)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  if (delta > 0) {
    const last = dayEntries[dayEntries.length - 1]
    const start = last?.endedAt ? new Date(last.endedAt) : new Date(`${day}T09:00:00`)
    const end = new Date(start.getTime() + delta * 1000)
    await window.desktop.timeEntries.create({
      projectId,
      taskId,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      source: 'timesheet'
    })
  } else {
    let remaining = -delta
    for (let i = dayEntries.length - 1; i >= 0 && remaining > 0; i -= 1) {
      const entry = dayEntries[i]
      if (!entry) continue
      if (entry.durationSeconds <= remaining) {
        remaining -= entry.durationSeconds
        await window.desktop.timeEntries.delete(entry.id)
      } else {
        const newDuration = entry.durationSeconds - remaining
        const start = new Date(entry.startedAt)
        await window.desktop.timeEntries.update(entry.id, {
          durationSeconds: newDuration,
          endedAt: new Date(start.getTime() + newDuration * 1000).toISOString()
        })
        remaining = 0
      }
    }
  }

  await load()
}

async function duplicatePreviousWeek(): Promise<void> {
  const prevStart = startOfWeek(new Date(anchorDate.value.getTime() - 7 * 24 * 3600_000), weekStartsOn.value)
  const prevWeek = await window.desktop.reports.getTimesheetWeek(prevStart.toISOString(), weekStartsOn.value)
  const dayOffsetMap = Object.keys(prevWeek.dailyTotals)

  for (const row of prevWeek.rows) {
    for (const [day, seconds] of Object.entries(row.cells)) {
      if (seconds <= 0) continue
      const dayIndex = dayOffsetMap.indexOf(day)
      const targetDay = dayKeys.value[dayIndex]
      if (!targetDay) continue
      const start = new Date(`${targetDay}T09:00:00`)
      const end = new Date(start.getTime() + seconds * 1000)
      await window.desktop.timeEntries.create({
        projectId: row.projectId,
        taskId: row.taskId,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        source: 'timesheet'
      })
    }
  }
  await load()
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">{{ t('routes.timesheet') }}</h1>
      <div class="flex items-center gap-1.5">
        <button class="btn btn-ghost btn-sm gap-1.5" @click="duplicatePreviousWeek">
          <Copy :size="14" /> {{ t('timesheet.duplicateLastWeek') }}
        </button>
        <button class="btn btn-ghost btn-sm btn-square" :aria-label="t('timeline.previousWeek')" @click="shiftWeek(-1)"><ChevronLeft :size="16" /></button>
        <button class="btn btn-ghost btn-sm btn-square" :aria-label="t('timeline.nextWeek')" @click="shiftWeek(1)"><ChevronRight :size="16" /></button>
      </div>
    </div>
    <p v-if="week" class="text-sm text-base-content/60">{{ week.weekStart }} → {{ week.weekEnd }}</p>

    <div v-if="week" class="overflow-x-auto rounded-xl border border-base-300">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-base-300 bg-base-200/50 text-left text-xs uppercase text-base-content/50">
            <th class="px-3 py-2">{{ t('timesheet.projectTask') }}</th>
            <th v-for="label in dayLabels" :key="label" class="px-2 py-2 text-center">{{ label }}</th>
            <th class="px-3 py-2 text-right">{{ t('calendar.total') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in week.rows" :key="rowKeyOf(row.projectId, row.taskId)" class="border-b border-base-300/60">
            <td class="px-3 py-2">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: row.projectColor }" />
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ row.projectName }}</p>
                  <p v-if="row.taskName" class="truncate text-xs text-base-content/50">{{ row.taskName }}</p>
                </div>
              </div>
            </td>
            <td v-for="day in dayKeys" :key="day" class="px-1 py-1 text-center">
              <input
                v-if="editing?.rowKey === rowKeyOf(row.projectId, row.taskId) && editing.day === day"
                v-model="editValue"
                autofocus
                class="input input-bordered input-xs w-16 text-center"
                @keydown.enter="commitEdit(row.projectId, row.taskId, day)"
                @blur="commitEdit(row.projectId, row.taskId, day)"
              />
              <button
                v-else
                class="w-16 rounded px-1 py-1 tabular-nums hover:bg-base-300/50"
                @click="startEdit(rowKeyOf(row.projectId, row.taskId), day, row.cells[day] ?? 0)"
              >
                {{ (row.cells[day] ?? 0) > 0 ? formatDurationHm(row.cells[day] ?? 0) : '-' }}
              </button>
            </td>
            <td class="px-3 py-2 text-right font-medium tabular-nums">{{ formatDurationHm(row.totalSeconds) }}</td>
          </tr>
          <tr v-if="week.rows.length === 0">
            <td :colspan="dayKeys.length + 2" class="py-8 text-center text-base-content/40">{{ t('timeline.emptyWeek') }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="bg-base-200/50 font-medium">
            <td class="px-3 py-2">{{ t('calendar.total') }}</td>
            <td v-for="day in dayKeys" :key="day" class="px-2 py-2 text-center tabular-nums">
              {{ formatDurationHm(week.dailyTotals[day] ?? 0) }}
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatDurationHm(week.weekTotalSeconds) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="text-xs text-base-content/40">
      {{ t('timesheet.formatsHint') }}
    </p>
  </div>
</template>
