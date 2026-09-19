<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import type { TimeEntry } from '@shared/types/domain'
import { formatDurationCompact } from '@shared/utils/duration'
import { useProjectsStore } from '../../stores/projects'
import { useUiStore } from '../../stores/ui'
import ManualEntryModal from '../timer/ManualEntryModal.vue'

const projectsStore = useProjectsStore()
const uiStore = useUiStore()
const currentDate = ref(new Date())
const entries = ref<TimeEntry[]>([])
const editingEntry = ref<TimeEntry | null>(null)

const dayLabel = computed(() =>
  currentDate.value.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
)

const isToday = computed(() => {
  const now = new Date()
  return currentDate.value.toDateString() === now.toDateString()
})

async function load(): Promise<void> {
  const start = new Date(currentDate.value)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 3600_000)
  entries.value = await window.desktop.timeEntries.listInRange(start.toISOString(), end.toISOString())
}

onMounted(load)
watch(currentDate, load)
watch(() => uiStore.dataVersion, load)

function shiftDay(delta: number): void {
  const next = new Date(currentDate.value)
  next.setDate(next.getDate() + delta)
  currentDate.value = next
}

function goToday(): void {
  currentDate.value = new Date()
}

const HOUR_HEIGHT = 56
const START_HOUR = 6
const END_HOUR = 23

const hours = computed(() => {
  const list: number[] = []
  for (let h = START_HOUR; h <= END_HOUR; h += 1) list.push(h)
  return list
})

function projectColor(id: string): string {
  return projectsStore.byId(id)?.color ?? '#888'
}
function projectName(id: string): string {
  return projectsStore.byId(id)?.name ?? 'Unknown'
}

interface Block {
  entry: TimeEntry
  top: number
  height: number
}

const blocks = computed<Block[]>(() =>
  entries.value
    .filter((e) => e.endedAt)
    .map((entry) => {
      const start = new Date(entry.startedAt)
      const end = new Date(entry.endedAt as string)
      const startMinutes = Math.max(0, (start.getHours() - START_HOUR) * 60 + start.getMinutes())
      const endMinutes = Math.min(
        (END_HOUR - START_HOUR + 1) * 60,
        (end.getHours() - START_HOUR) * 60 + end.getMinutes()
      )
      return {
        entry,
        top: (startMinutes / 60) * HOUR_HEIGHT,
        height: Math.max(18, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT)
      }
    })
)
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-4 p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Timeline</h1>
      <div class="flex items-center gap-1.5">
        <button class="btn btn-ghost btn-sm btn-square" @click="shiftDay(-1)"><ChevronLeft :size="16" /></button>
        <button class="btn btn-ghost btn-sm" :class="isToday ? 'btn-disabled' : ''" @click="goToday">Today</button>
        <button class="btn btn-ghost btn-sm btn-square" @click="shiftDay(1)"><ChevronRight :size="16" /></button>
      </div>
    </div>
    <p class="text-sm text-base-content/60">{{ dayLabel }}</p>

    <div class="relative rounded-xl border border-base-300 bg-base-200/30 p-4">
      <div class="relative" :style="{ height: `${hours.length * HOUR_HEIGHT}px` }">
        <div
          v-for="(h, i) in hours"
          :key="h"
          class="absolute left-0 right-0 flex items-start gap-2 border-t border-base-300/60 text-[11px] text-base-content/40"
          :style="{ top: `${i * HOUR_HEIGHT}px` }"
        >
          <span class="w-10 -translate-y-1/2">{{ String(h).padStart(2, '0') }}:00</span>
        </div>

        <div class="absolute left-14 right-0 top-0 bottom-0">
          <button
            v-for="block in blocks"
            :key="block.entry.id"
            class="absolute left-0 right-2 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm"
            :style="{
              top: `${block.top}px`,
              height: `${block.height}px`,
              borderColor: projectColor(block.entry.projectId),
              backgroundColor: projectColor(block.entry.projectId) + '22'
            }"
            @click="editingEntry = block.entry"
          >
            <p class="truncate font-medium">{{ projectName(block.entry.projectId) }}</p>
            <p v-if="block.entry.description" class="truncate text-base-content/60">{{ block.entry.description }}</p>
            <p class="text-base-content/50">{{ formatDurationCompact(block.entry.durationSeconds) }}</p>
          </button>
        </div>
      </div>
    </div>

    <p v-if="entries.length === 0" class="py-6 text-center text-sm text-base-content/40">
      No time tracked on this day
    </p>

    <ManualEntryModal v-if="editingEntry" :entry="editingEntry" @close="editingEntry = null; load()" />
  </div>
</template>
