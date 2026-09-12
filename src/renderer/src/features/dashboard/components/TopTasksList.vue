<script setup lang="ts">
import type { TopTaskEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'

defineProps<{ tasks: TopTaskEntry[] }>()
</script>

<template>
  <div class="rounded-xl border border-base-300 bg-base-200/40 p-4">
    <h2 class="mb-3 text-sm font-semibold">Top Tasks</h2>
    <ol class="space-y-2">
      <li v-for="(task, index) in tasks" :key="task.taskId" class="flex items-center gap-2 text-sm">
        <span class="w-4 shrink-0 text-base-content/40">{{ index + 1 }}.</span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium">{{ task.taskName }}</p>
          <p class="truncate text-xs text-base-content/50">{{ task.projectName }}</p>
        </div>
        <span class="shrink-0 tabular-nums text-base-content/70">{{ formatDurationCompact(task.durationSeconds) }}</span>
      </li>
      <li v-if="tasks.length === 0" class="py-6 text-center text-sm text-base-content/40">No tasks tracked this week</li>
    </ol>
  </div>
</template>
