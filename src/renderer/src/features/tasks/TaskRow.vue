<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import {
  Archive,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ListTree,
  Pencil,
  Play,
  Plus,
  Star,
  Trash2
} from '@lucide/vue'
import type { Task } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'

const props = withDefaults(
  defineProps<{
    task: Task
    durationSeconds: number
    isActive: boolean
    /** Nesting level inside the task tree; 0 for top-level rows. */
    depth?: number
    /** Direct, non-archived subtasks; `total` is 0 when the task has none. */
    subtasks?: { done: number; total: number }
    collapsed?: boolean
  }>(),
  { depth: 0, subtasks: () => ({ done: 0, total: 0 }), collapsed: false }
)
defineEmits<{
  start: []
  toggleComplete: []
  toggleCollapse: []
  addSubtask: []
  toggleFavorite: []
  edit: []
  archive: []
  delete: []
}>()

const { t } = useI18n()

const progress = computed(() => {
  if (!props.task.estimatedMinutes) return null
  return Math.min(100, Math.round((props.durationSeconds / 60 / props.task.estimatedMinutes) * 100))
})

const hasSubtasks = computed(() => props.subtasks.total > 0)
const blocked = computed(
  () => props.task.status !== 'done' && props.subtasks.done < props.subtasks.total
)
const completeLabel = computed(() => {
  if (props.task.status === 'done') return t('tasks.row.markNotDone')
  if (blocked.value) return t('tasks.row.completeSubtasksFirst', props.subtasks.total - props.subtasks.done)
  return t('tasks.row.markDone')
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
    :style="depth > 0 ? { marginLeft: `${depth * 1.75}rem` } : undefined"
  >
    <button
      v-if="hasSubtasks"
      class="-mx-1.5 shrink-0 text-base-content/50 hover:text-base-content"
      :aria-label="collapsed ? t('tasks.row.expand') : t('tasks.row.collapse')"
      @click="$emit('toggleCollapse')"
    >
      <ChevronRight v-if="collapsed" :size="14" />
      <ChevronDown v-else :size="14" />
    </button>
    <span v-else class="-mx-1.5 w-3.5 shrink-0" />

    <button
      class="shrink-0 disabled:cursor-not-allowed"
      :disabled="blocked"
      :title="completeLabel"
      :aria-label="completeLabel"
      @click="$emit('toggleComplete')"
    >
      <CircleCheck
        :size="18"
        :class="task.status === 'done' ? 'text-success' : blocked ? 'text-base-content/10' : 'text-base-content/25'"
      />
    </button>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium" :class="task.status === 'done' ? 'line-through text-base-content/40' : ''">
        {{ task.name }}
      </p>
      <div class="flex items-center gap-2 text-xs text-base-content/50">
        <span class="tabular-nums">⏱ {{ formatDurationCompact(durationSeconds) }}</span>
        <span
          v-if="hasSubtasks"
          class="inline-flex items-center gap-1 tabular-nums"
          :class="subtasks.done === subtasks.total ? 'text-success' : ''"
          :title="t('tasks.row.subtasksDone', { done: subtasks.done, total: subtasks.total })"
        >
          <ListTree :size="12" /> {{ subtasks.done }}/{{ subtasks.total }}
        </span>
        <span v-if="task.estimatedMinutes">{{ t('tasks.row.estimate', { hours: (task.estimatedMinutes / 60).toFixed(1) }) }}</span>
        <span v-if="progress !== null">{{ t('tasks.row.progress', { percent: progress }) }}</span>
        <span class="font-medium" :class="priorityColor[task.priority]">● {{ t(`tasks.priority.${task.priority}`) }}</span>
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
      <Play :size="12" /> {{ t('palette.start') }}
    </button>
    <span v-else class="badge badge-primary badge-sm shrink-0">{{ t('tasks.row.tracking') }}</span>

    <div class="hidden shrink-0 items-center gap-1 group-hover:flex">
      <button
        class="btn btn-ghost btn-xs btn-square"
        :title="t('tasks.row.addSubtask')"
        :aria-label="t('tasks.row.addSubtask')"
        @click="$emit('addSubtask')"
      >
        <Plus :size="12" />
      </button>
      <button class="btn btn-ghost btn-xs btn-square" :title="t('common.edit')" @click="$emit('edit')"><Pencil :size="12" /></button>
      <button class="btn btn-ghost btn-xs btn-square" :title="t('projects.archive')" @click="$emit('archive')"><Archive :size="12" /></button>
      <button class="btn btn-ghost btn-xs btn-square text-error" :title="t('common.delete')" @click="$emit('delete')"><Trash2 :size="12" /></button>
    </div>
  </div>
</template>
