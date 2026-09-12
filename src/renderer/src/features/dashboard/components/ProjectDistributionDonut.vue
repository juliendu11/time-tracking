<script setup lang="ts">
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import type { ProjectDistributionSlice } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'

const props = defineProps<{ slices: ProjectDistributionSlice[] }>()
const emit = defineEmits<{ select: [projectId: string] }>()

const chartData = computed<ChartData<'doughnut'>>(() => ({
  labels: props.slices.map((s) => s.projectName),
  datasets: [
    {
      data: props.slices.map((s) => s.durationSeconds),
      backgroundColor: props.slices.map((s) => s.color),
      borderWidth: 0
    }
  ]
}))

const chartOptions: ChartOptions<'doughnut'> = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '68%',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => ` ${formatDurationSpaced(Number(ctx.raw))}`
      }
    }
  },
  onClick: (_evt, elements) => {
    const index = elements[0]?.index
    if (index === undefined) return
    const slice = props.slices[index]
    if (slice) emit('select', slice.projectId)
  }
}

const total = computed(() => props.slices.reduce((sum, s) => sum + s.durationSeconds, 0))
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-3 text-sm font-semibold">Time by project</h2>
    <div v-if="slices.length > 0" class="flex items-center gap-4">
      <div class="relative h-36 w-36 shrink-0">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span class="text-sm font-semibold">{{ formatDurationSpaced(total) }}</span>
          <span class="text-[10px] text-base-content/50">this week</span>
        </div>
      </div>
      <ul class="min-w-0 flex-1 space-y-1.5">
        <li
          v-for="slice in slices.slice(0, 5)"
          :key="slice.projectId"
          class="flex cursor-pointer items-center gap-2 text-sm"
          @click="emit('select', slice.projectId)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: slice.color }" />
          <span class="min-w-0 flex-1 truncate">{{ slice.projectName }}</span>
          <span class="shrink-0 tabular-nums text-base-content/60">{{ slice.percentage }}%</span>
        </li>
      </ul>
    </div>
    <p v-else class="py-8 text-center text-sm text-base-content/40">No data this week</p>
  </div>
</template>
