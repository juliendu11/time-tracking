<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TimeEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { useProjectsStore } from '../../../stores/projects'

const props = defineProps<{ date: string }>()
const emit = defineEmits<{ close: [] }>()

const projectsStore = useProjectsStore()
const entries = ref<TimeEntry[]>([])
const loading = ref(true)

onMounted(async () => {
  const start = new Date(`${props.date}T00:00:00`)
  const end = new Date(start.getTime() + 24 * 3600_000)
  entries.value = await window.desktop.timeEntries.listInRange(start.toISOString(), end.toISOString())
  loading.value = false
})

function projectName(id: string): string {
  return projectsStore.byId(id)?.name ?? 'Unknown'
}
function projectColor(id: string): string {
  return projectsStore.byId(id)?.color ?? '#888'
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex justify-end bg-black/30" @click.self="emit('close')">
    <div class="h-full w-full max-w-sm overflow-y-auto border-l border-base-300 bg-base-100 p-5 shadow-2xl">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-semibold">
          {{ new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }}
        </h2>
        <button class="btn btn-ghost btn-xs" @click="emit('close')">Close</button>
      </div>

      <p v-if="loading" class="text-sm text-base-content/50">Loading…</p>
      <ul v-else class="space-y-2">
        <li v-for="entry in entries" :key="entry.id" class="rounded-lg border border-base-300 p-3">
          <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: projectColor(entry.projectId) }" />
            <span class="text-sm font-medium">{{ projectName(entry.projectId) }}</span>
            <span class="ml-auto text-xs tabular-nums text-base-content/50">
              {{ formatDurationCompact(entry.durationSeconds) }}
            </span>
          </div>
          <p v-if="entry.description" class="mt-1 text-xs text-base-content/60">{{ entry.description }}</p>
        </li>
        <li v-if="entries.length === 0" class="py-8 text-center text-sm text-base-content/40">
          No time tracked on this day
        </li>
      </ul>
    </div>
  </div>
</template>
