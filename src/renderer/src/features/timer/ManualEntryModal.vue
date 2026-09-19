<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { Task, TimeEntry } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'
import { useProjectsStore } from '../../stores/projects'
import { useTasksStore } from '../../stores/tasks'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ entry?: TimeEntry }>()
const emit = defineEmits<{ close: [] }>()

const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const uiStore = useUiStore()

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const now = new Date()
const defaultStart = new Date(now.getTime() - 30 * 60_000)

const form = reactive({
  projectId: props.entry?.projectId ?? projectsStore.currentProjectId ?? '',
  taskId: props.entry?.taskId ?? null,
  description: props.entry?.description ?? '',
  startInput: props.entry ? toLocalInputValue(props.entry.startedAt) : toLocalInputValue(defaultStart.toISOString()),
  endInput: props.entry?.endedAt ? toLocalInputValue(props.entry.endedAt) : toLocalInputValue(now.toISOString())
})

const tasks = ref<Task[]>([])
const error = ref<string | null>(null)
const overlapWarning = ref<string | null>(null)
const saving = ref(false)

watch(
  () => form.projectId,
  async (projectId) => {
    if (!projectId) {
      tasks.value = []
      return
    }
    tasks.value = await tasksStore.loadForProject(projectId)
  },
  { immediate: true }
)

const durationSeconds = computed(() => {
  const start = new Date(form.startInput)
  const end = new Date(form.endInput)
  const seconds = Math.round((end.getTime() - start.getTime()) / 1000)
  return Number.isFinite(seconds) ? seconds : 0
})

const durationLabel = computed(() =>
  durationSeconds.value > 0 ? formatDurationSpaced(durationSeconds.value) : '—'
)

onMounted(async () => {
  await checkOverlap()
})

async function checkOverlap(): Promise<void> {
  overlapWarning.value = null
  if (durationSeconds.value <= 0) return
  const start = new Date(form.startInput).toISOString()
  const end = new Date(form.endInput).toISOString()
  const result = await window.desktop.timeEntries.checkOverlap(start, end, props.entry?.id)
  if (result.hasOverlap) {
    overlapWarning.value = `This overlaps with ${result.overlapping.length} existing entr${
      result.overlapping.length > 1 ? 'ies' : 'y'
    }.`
  }
}

async function submit(): Promise<void> {
  error.value = null
  if (!form.projectId) {
    error.value = 'Choose a project.'
    return
  }
  if (durationSeconds.value <= 0) {
    error.value = 'End time must be after start time.'
    return
  }

  saving.value = true
  try {
    const startedAt = new Date(form.startInput).toISOString()
    const endedAt = new Date(form.endInput).toISOString()
    const payload = {
      projectId: form.projectId,
      taskId: form.taskId,
      description: form.description || null,
      startedAt,
      endedAt,
      source: 'manual' as const
    }
    if (props.entry) {
      await window.desktop.timeEntries.update(props.entry.id, payload)
    } else {
      await window.desktop.timeEntries.create(payload)
    }
    uiStore.notifyDataChanged()
    uiStore.pushToast({ message: `Saved ${formatDurationSpaced(durationSeconds.value)}` })
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unable to save the time entry.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
      <h2 class="mb-4 text-base font-semibold">{{ entry ? 'Edit time entry' : 'Add time manually' }}</h2>

      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">Project</label>
            <select v-model="form.projectId" class="select select-bordered select-sm w-full">
              <option value="" disabled>Choose project</option>
              <option v-for="p in projectsStore.activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">Task (optional)</label>
            <select v-model="form.taskId" class="select select-bordered select-sm w-full">
              <option :value="null">No task</option>
              <option v-for="t in tasks" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Description</label>
          <input v-model="form.description" class="input input-bordered input-sm w-full" placeholder="What did you work on?" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">Start</label>
            <input
              v-model="form.startInput"
              type="datetime-local"
              class="input input-bordered input-sm w-full"
              @change="checkOverlap"
            />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">End</label>
            <input
              v-model="form.endInput"
              type="datetime-local"
              class="input input-bordered input-sm w-full"
              @change="checkOverlap"
            />
          </div>
        </div>

        <p class="text-sm text-base-content/70">Duration: <span class="font-medium">{{ durationLabel }}</span></p>

        <div v-if="overlapWarning" class="rounded-lg bg-warning/15 px-3 py-2 text-xs text-warning-content">
          ⚠️ {{ overlapWarning }}
        </div>
        <p v-if="error" class="text-xs text-error">{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="submit">Save</button>
      </div>
    </div>
  </div>
</template>
