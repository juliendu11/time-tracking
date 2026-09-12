<script setup lang="ts">
import { computed } from 'vue'
import { Archive, CircleCheck, Pencil, Play, Star, Trash2 } from '@lucide/vue'
import type { Task } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'

const props = defineProps<{ task: Task; durationSeconds: number; isActive: boolean }>()
defineEmits<{
  start: []
  toggleComplete: []
  toggleFavorite: []
  edit: []
  archive: []
  delete: []
}>()

const progress = computed(() => {
  if (!props.task.estimatedMinutes) return null
  return Math.min(100, Math.round((props.durationSeconds / 60 / props.task.estimatedMinutes) * 100))
})

const priorityColor: Record<string, string> = {
  urgent: 'text-error',
  high: 'text-warning',
  normal: 'text-base-content/40',
  low: 'text-base-content/30'
}
</script>

<template>
  <div
    class="group flex items-center gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2.5"
    :class="isActive ? 'border-primary/50 bg-primary/5' : ''"
  >
    <button class="shrink-0" @click="$emit('toggleComplete')">
      <CircleCheck :size="18" :class="task.status === 'done' ? 'text-success' : 'text-base-content/25'" />
    </button>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium" :class="task.status === 'done' ? 'line-through text-base-content/40' : ''">
        {{ task.name }}
      </p>
      <div class="flex items-center gap-2 text-xs text-base-content/50">
        <span class="tabular-nums">⏱ {{ formatDurationCompact(durationSeconds) }}</span>
        <span v-if="task.estimatedMinutes">Estimate: {{ (task.estimatedMinutes / 60).toFixed(1) }}h</span>
        <span v-if="progress !== null">Progress: {{ progress }}%</span>
        <span class="font-medium" :class="priorityColor[task.priority]">● {{ task.priority }}</span>
      </div>
      <progress v-if="progress !== null" class="progress progress-primary mt-1 h-1 w-full" :value="progress" max="100" />
    </div>

    <button class="shrink-0" @click="$emit('toggleFavorite')">
      <Star :size="14" :fill="task.isFavorite ? 'currentColor' : 'none'" :class="task.isFavorite ? 'text-warning' : 'text-base-content/25'" />
    </button>

    <button
      v-if="!isActive"
      class="btn btn-primary btn-xs shrink-0 gap-1"
      @click="$emit('start')"
    >
      <Play :size="12" /> Start
    </button>
    <span v-else class="badge badge-primary badge-sm shrink-0">Tracking</span>

    <div class="hidden shrink-0 items-center gap-1 group-hover:flex">
      <button class="btn btn-ghost btn-xs btn-square" @click="$emit('edit')"><Pencil :size="12" /></button>
      <button class="btn btn-ghost btn-xs btn-square" @click="$emit('archive')"><Archive :size="12" /></button>
      <button class="btn btn-ghost btn-xs btn-square text-error" @click="$emit('delete')"><Trash2 :size="12" /></button>
    </div>
  </div>
</template>
