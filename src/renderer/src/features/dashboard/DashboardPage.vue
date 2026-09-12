<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type {
  AdditionalMetrics,
  DailyBucket,
  DashboardSummary,
  FocusScoreBreakdown,
  HeatmapDay,
  ProjectDistributionSlice,
  TimeEntry,
  TopTaskEntry
} from '@shared/types/domain'
import { useProjectsStore } from '../../stores/projects'
import DashboardHeader from './components/DashboardHeader.vue'
import RecentEntriesList from './components/RecentEntriesList.vue'
import LastSevenDaysChart from './components/LastSevenDaysChart.vue'
import ActivityHeatmap from './components/ActivityHeatmap.vue'
import ProjectDistributionDonut from './components/ProjectDistributionDonut.vue'
import TopTasksList from './components/TopTasksList.vue'
import MetricsGrid from './components/MetricsGrid.vue'
import FocusScoreCard from './components/FocusScoreCard.vue'
import DayEntriesDrawer from './components/DayEntriesDrawer.vue'

const projectsStore = useProjectsStore()

const summary = ref<DashboardSummary | null>(null)
const recentEntries = ref<TimeEntry[]>([])
const lastSevenDays = ref<DailyBucket[]>([])
const heatmap = ref<HeatmapDay[]>([])
const distribution = ref<ProjectDistributionSlice[]>([])
const topTasks = ref<TopTaskEntry[]>([])
const metrics = ref<AdditionalMetrics | null>(null)
const focusScore = ref<FocusScoreBreakdown | null>(null)
const heatmapFilterCurrentOnly = ref(false)
const selectedDay = ref<string | null>(null)
const loading = ref(true)

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
})

async function loadAll(): Promise<void> {
  loading.value = true
  const now = new Date().toISOString()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)

  const [s, recent, days, heat, dist, tasks, m, focus] = await Promise.all([
    window.desktop.reports.getDashboardSummary(now),
    window.desktop.timeEntries.listRecent(8),
    window.desktop.reports.getLastNDaysBuckets(now, 7),
    window.desktop.reports.getHeatmap(
      now,
      12,
      heatmapFilterCurrentOnly.value ? (projectsStore.currentProjectId ?? undefined) : undefined
    ),
    window.desktop.reports.getProjectDistribution(weekStart.toISOString(), now),
    window.desktop.reports.getTopTasks(weekStart.toISOString(), now, 4),
    window.desktop.reports.getAdditionalMetrics(now),
    window.desktop.reports.getFocusScore(now)
  ])

  summary.value = s
  recentEntries.value = recent
  lastSevenDays.value = days
  heatmap.value = heat
  distribution.value = dist
  topTasks.value = tasks
  metrics.value = m
  focusScore.value = focus
  loading.value = false
}

async function toggleHeatmapFilter(): Promise<void> {
  heatmapFilterCurrentOnly.value = !heatmapFilterCurrentOnly.value
  heatmap.value = await window.desktop.reports.getHeatmap(
    new Date().toISOString(),
    12,
    heatmapFilterCurrentOnly.value ? (projectsStore.currentProjectId ?? undefined) : undefined
  )
}

function selectDistributionProject(projectId: string): void {
  // Filtering the whole dashboard by project is intentionally simple: jump
  // to that project's own page, which already has focused stats.
  window.location.hash = `#/projects/${projectId}`
}

onMounted(loadAll)
defineExpose({ loadAll })
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 p-6">
    <DashboardHeader
      v-if="summary"
      :greeting="greeting"
      :summary="summary"
      :loading="loading"
    />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="space-y-6 lg:col-span-2">
        <LastSevenDaysChart :buckets="lastSevenDays" @select-day="selectedDay = $event" />
        <ActivityHeatmap
          :days="heatmap"
          :filter-current-only="heatmapFilterCurrentOnly"
          @toggle-filter="toggleHeatmapFilter"
          @select-day="selectedDay = $event"
        />
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <ProjectDistributionDonut :slices="distribution" @select="selectDistributionProject" />
          <TopTasksList :tasks="topTasks" />
        </div>
      </div>
      <div class="space-y-6">
        <FocusScoreCard v-if="focusScore" :score="focusScore" />
        <MetricsGrid v-if="metrics" :metrics="metrics" />
        <RecentEntriesList :entries="recentEntries" @changed="loadAll" />
      </div>
    </div>

    <DayEntriesDrawer v-if="selectedDay" :date="selectedDay" @close="selectedDay = null" />
  </div>
</template>
