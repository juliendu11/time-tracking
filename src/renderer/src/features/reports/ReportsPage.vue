<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ReportGroupBy, ReportResult } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'
import { useProjectsStore } from '../../stores/projects'
import { useTagsStore } from '../../stores/tags'
import { useUiStore } from '../../stores/ui'
import BaseCheckBox from '@renderer/components/BaseCheckBox.vue'

const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const uiStore = useUiStore()

type Preset = 'this-week' | 'last-week' | 'this-month' | 'last-30' | 'custom'

const preset = ref<Preset>('this-week')
const customStart = ref('')
const customEnd = ref('')
const groupBy = ref<ReportGroupBy>('project')
const projectFilter = ref('')
const tagFilter = ref('')
const onlyWithoutTask = ref(false)
const compare = ref(false)

const result = ref<ReportResult | null>(null)
const previousResult = ref<ReportResult | null>(null)

function toIsoDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeForPreset(): { start: Date; end: Date } {
  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  if (preset.value === 'this-week') {
    const start = new Date(startOfToday)
    start.setDate(start.getDate() - start.getDay() + 1)
    return { start, end: new Date(start.getTime() + 7 * 24 * 3600_000) }
  }
  if (preset.value === 'last-week') {
    const start = new Date(startOfToday)
    start.setDate(start.getDate() - start.getDay() + 1 - 7)
    return { start, end: new Date(start.getTime() + 7 * 24 * 3600_000) }
  }
  if (preset.value === 'this-month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start, end: new Date(now.getFullYear(), now.getMonth() + 1, 1) }
  }
  if (preset.value === 'last-30') {
    return { start: new Date(startOfToday.getTime() - 30 * 24 * 3600_000), end: new Date(startOfToday.getTime() + 24 * 3600_000) }
  }
  return {
    start: customStart.value ? new Date(customStart.value) : startOfToday,
    end: customEnd.value ? new Date(new Date(customEnd.value).getTime() + 24 * 3600_000) : new Date(startOfToday.getTime() + 24 * 3600_000)
  }
}

async function runReport(): Promise<void> {
  const { start, end } = rangeForPreset()
  if (preset.value === 'custom') {
    customStart.value = customStart.value || toIsoDateInput(start)
    customEnd.value = customEnd.value || toIsoDateInput(new Date(end.getTime() - 24 * 3600_000))
  }

  const filter = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    projectIds: projectFilter.value ? [projectFilter.value] : undefined,
    tagIds: tagFilter.value ? [tagFilter.value] : undefined,
    onlyWithoutTask: onlyWithoutTask.value || undefined
  }
  result.value = await window.desktop.reports.runReport(filter, groupBy.value)

  if (compare.value) {
    const durationMs = end.getTime() - start.getTime()
    const prevStart = new Date(start.getTime() - durationMs)
    const prevEnd = new Date(start.getTime())
    previousResult.value = await window.desktop.reports.runReport(
      { ...filter, startDate: prevStart.toISOString(), endDate: prevEnd.toISOString() },
      groupBy.value
    )
  } else {
    previousResult.value = null
  }
}

onMounted(async () => {
  await Promise.all([projectsStore.load(), tagsStore.load()])
  await runReport()
})

watch(() => uiStore.dataVersion, runReport)
watch([preset, groupBy, projectFilter, tagFilter, onlyWithoutTask, compare], runReport)
watch([customStart, customEnd], () => {
  if (preset.value === 'custom') runReport()
})

const changePercent = computed(() => {
  if (!result.value || !previousResult.value || previousResult.value.totalSeconds === 0) return null
  return Math.round(
    ((result.value.totalSeconds - previousResult.value.totalSeconds) / previousResult.value.totalSeconds) * 1000
  ) / 10
})
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-5 p-6">
    <h1 class="text-xl font-semibold">Reports</h1>

    <div class="flex flex-wrap items-center gap-2">
      <select v-model="preset" class="select select-bordered select-sm">
        <option value="this-week">This week</option>
        <option value="last-week">Last week</option>
        <option value="this-month">This month</option>
        <option value="last-30">Last 30 days</option>
        <option value="custom">Custom range</option>
      </select>
      <template v-if="preset === 'custom'">
        <input v-model="customStart" type="date" class="input input-bordered input-sm" />
        <span class="text-base-content/40">→</span>
        <input v-model="customEnd" type="date" class="input input-bordered input-sm" />
      </template>

      <select v-model="projectFilter" class="select select-bordered select-sm">
        <option value="">All projects</option>
        <option v-for="p in projectsStore.activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>

      <select v-model="tagFilter" class="select select-bordered select-sm">
        <option value="">All tags</option>
        <option v-for="t in tagsStore.tags" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>

      <BaseCheckBox
        label="Without task"
        :checked="onlyWithoutTask"
        @change="onlyWithoutTask = ($event.target as HTMLInputElement).checked"
      />

      <BaseCheckBox
        label="Compare to previous period"
        :checked="compare"
        @change="compare = ($event.target as HTMLInputElement).checked"
      />

      <select v-model="groupBy" class="select select-bordered select-sm ml-auto">
        <option value="project">Group by project</option>
        <option value="task">Group by task</option>
        <option value="day">Group by day</option>
        <option value="week">Group by week</option>
        <option value="month">Group by month</option>
        <option value="tag">Group by tag</option>
      </select>
    </div>

    <div v-if="result" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">Total</p>
        <p class="font-semibold">{{ formatDurationSpaced(result.totalSeconds) }}</p>
        <p v-if="changePercent !== null" class="text-xs" :class="changePercent >= 0 ? 'text-success' : 'text-error'">
          {{ changePercent >= 0 ? '+' : '' }}{{ changePercent }}% vs previous
        </p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">Sessions</p>
        <p class="font-semibold">{{ result.totalSessions }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">Avg session</p>
        <p class="font-semibold">{{ formatDurationSpaced(result.averageSessionSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">Top project</p>
        <p class="truncate font-semibold">{{ result.topProject?.name ?? '—' }}</p>
      </div>
    </div>

    <div v-if="result" class="overflow-hidden rounded-xl border border-base-300">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-base-300 bg-base-200/50 text-left text-xs uppercase text-base-content/50">
            <th class="px-3 py-2">{{ groupBy }}</th>
            <th class="px-3 py-2 text-right">Duration</th>
            <th class="px-3 py-2 text-right">Sessions</th>
            <th class="px-3 py-2 text-right">Avg</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="group in result.groups" :key="group.key" class="border-b border-base-300/60">
            <td class="px-3 py-2">{{ group.label }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatDurationSpaced(group.durationSeconds) }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ group.sessions }}</td>
            <td class="px-3 py-2 text-right tabular-nums">{{ formatDurationSpaced(group.averageSessionSeconds) }}</td>
          </tr>
          <tr v-if="result.groups.length === 0">
            <td colspan="4" class="py-8 text-center text-base-content/40">No data for this period</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
