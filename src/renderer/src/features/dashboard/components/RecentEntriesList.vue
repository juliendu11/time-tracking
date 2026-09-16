<script setup lang="ts">
import { ref } from 'vue'
import { Pencil, Play, Trash2 } from '@lucide/vue'
import type { TimeEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { useProjectsStore } from '../../../stores/projects'
import { useTimerStore } from '../../../stores/timer'
import { useUiStore } from '../../../stores/ui'
import ManualEntryModal from '../../timer/ManualEntryModal.vue'

const props = defineProps<{ entries: TimeEntry[] }>()
const emit = defineEmits<{ changed: [] }>()

const projectsStore = useProjectsStore()
const timerStore = useTimerStore()
const uiStore = useUiStore()

const editingEntry = ref<TimeEntry | null>(null)

function projectName(id: string): string {
  return projectsStore.byId(id)?.name ?? 'Unknown project'
}
function projectColor(id: string): string {
  return projectsStore.byId(id)?.color ?? '#888'
}

function timeRange(entry: TimeEntry): string {
  const start = new Date(entry.startedAt)
  const end = entry.endedAt ? new Date(entry.endedAt) : null
  const fmt = (d: Date): string => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start)
}

async function restart(entry: TimeEntry): Promise<void> {
  await timerStore.start({ projectId: entry.projectId, taskId: entry.taskId })
  emit('changed')
}

async function remove(entry: TimeEntry): Promise<void> {
  await window.desktop.timeEntries.delete(entry.id)
  uiStore.pushToast({
    message: 'Time entry deleted',
    actionLabel: 'Undo',
    onAction: async () => {
      await window.desktop.timeEntries.restore(entry)
      emit('changed')
    }
  })
  emit('changed')
}
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-3 text-sm font-semibold">Recent Time Entries</h2>
    <ul class="space-y-1">
      <li
        v-for="entry in props.entries"
        :key="entry.id"
        class="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-base-300/40"
      >
        <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: projectColor(entry.projectId) }" />
        <div class="min-w-0 flex-1">
          <p class="text-xs text-base-content/50">{{ timeRange(entry) }}</p>
          <p class="truncate text-sm font-medium">{{ projectName(entry.projectId) }}</p>
          <p v-if="entry.description" class="truncate text-xs text-base-content/60">{{ entry.description }}</p>
        </div>
        <span class="shrink-0 text-sm font-medium tabular-nums">{{ formatDurationCompact(entry.durationSeconds) }}</span>
        <div class="hidden shrink-0 items-center gap-1 group-hover:flex">
          <button class="btn btn-ghost btn-xs btn-square" title="Restart" @click="restart(entry)">
            <Play :size="13" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square" title="Edit" @click="editingEntry = entry">
            <Pencil :size="13" />
          </button>
          <button class="btn btn-ghost btn-xs btn-square text-error" title="Delete" @click="remove(entry)">
            <Trash2 :size="13" />
          </button>
        </div>
      </li>
      <li v-if="props.entries.length === 0" class="px-2 py-6 text-center text-sm text-base-content/40">
        No time entries yet
      </li>
    </ul>

    <ManualEntryModal
      v-if="editingEntry"
      :entry="editingEntry"
      @close="editingEntry = null; emit('changed')"
    />
  </div>
</template>
