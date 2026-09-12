<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {Play, Plus} from '@lucide/vue'
import type {Project, ProjectStats, Task, TaskPriority} from '@shared/types/domain'
import {formatDurationSpaced} from '@shared/utils/duration'
import {useProjectsStore} from '../../stores/projects'
import {useTasksStore} from '../../stores/tasks'
import {useTimerStore} from '../../stores/timer'
import TaskRow from '../tasks/TaskRow.vue'
import TaskFormModal from '../tasks/TaskFormModal.vue'

const props = defineProps<{ id: string }>()

const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const timerStore = useTimerStore()

const project = ref<Project | null>(null)
const stats = ref<ProjectStats | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'todo' | 'in_progress' | 'done'>('all')
const sortBy = ref<'created' | 'priority' | 'name'>('created')
const showTaskForm = ref(false)
const editingTask = ref<Task | null>(null)

async function load(): Promise<void> {
  if (projectsStore.projects.length === 0) await projectsStore.load()
  project.value = projectsStore.byId(props.id) ?? (await window.desktop.projects.get(props.id))
  stats.value = await window.desktop.projects.getStats(props.id)
  await tasksStore.loadForProject(props.id, true)
}

onMounted(load)
watch(() => props.id, load)

const tasks = computed(() => tasksStore.tasksFor(props.id))

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {urgent: 0, high: 1, normal: 2, low: 3}

const filteredTasks = computed(() => {
  let list = tasks.value.filter((t) => t.status !== 'archived')
  if (statusFilter.value !== 'all') list = list.filter((t) => t.status === statusFilter.value)
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((t) => t.name.toLowerCase().includes(q))

  return [...list].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'priority') return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    return b.createdAt.localeCompare(a.createdAt)
  })
})

const taskDurations = ref<Record<string, number>>({})

async function refreshDurations(): Promise<void> {
  const entries = await Promise.all(
      tasks.value.map(async (t) => {
        const list = await window.desktop.timeEntries.listByTask(t.id)
        const total = list.reduce((sum, e) => sum + e.durationSeconds, 0)
        return [t.id, total] as const
      })
  )
  taskDurations.value = Object.fromEntries(entries)
}

watch(tasks, refreshDurations, {immediate: true})

async function refreshStats(): Promise<void> {
  stats.value = await window.desktop.projects.getStats(props.id)
}

/**
 * Completed-entry durations are only refetched when the DB actually changes
 * (task list changes, or a timer session finalises). The running session's
 * own elapsed time is layered on top here, ticking every second from
 * timerStore's timestamp-derived clock — never from a local counter.
 */
const liveTaskDurations = computed(() => {
  const activeTaskId = timerStore.snapshot?.task?.id ?? null
  if (!activeTaskId) return taskDurations.value
  return {
    ...taskDurations.value,
    [activeTaskId]: (taskDurations.value[activeTaskId] ?? 0) + timerStore.elapsedSeconds
  }
})

// A timer starting, stopping or switching task means a TimeEntry was just
// created/finalised in the DB — refresh the durations and stats that
// depend on it so this page never needs a manual revisit to catch up.
watch(
    () => timerStore.snapshot?.timer.id ?? null,
    (newId, oldId) => {
      if (newId === oldId) return
      void refreshDurations()
      void refreshStats()
    }
)

async function startTask(task: Task): Promise<void> {
  await timerStore.switchTask(task.id)
}

async function startFreeTimer(): Promise<void> {
  await timerStore.switchProject(props.id)
}

async function toggleComplete(task: Task): Promise<void> {
  await tasksStore.update(task.id, props.id, {status: task.status === 'done' ? 'todo' : 'done'})
}

async function toggleFavorite(task: Task): Promise<void> {
  await tasksStore.update(task.id, props.id, {isFavorite: !task.isFavorite})
}

async function archiveTask(task: Task): Promise<void> {
  await tasksStore.archive(task.id, props.id)
}

async function removeTask(task: Task): Promise<void> {
  if (!window.confirm(`Delete task "${task.name}"?`)) return
  await tasksStore.remove(task.id, props.id)
}

const weekProgress = computed(() => {
  if (!stats.value || !project.value?.weeklyTargetMinutes) return null
  return Math.min(100, Math.round((stats.value.week.durationSeconds / 60 / project.value.weeklyTargetMinutes) * 100))
})
</script>

<template>
  <div v-if="project" class="mx-auto max-w-4xl space-y-6 p-6">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="h-4 w-4 rounded-full" :style="{ backgroundColor: project.color }" />
        <h1 class="text-xl font-semibold">{{ project.name }}</h1>
      </div>
      <button class="btn btn-primary btn-sm gap-1.5" @click="startFreeTimer">
        <Play :size="14" />
        Start timer
      </button>
    </div>

    <div v-if="stats" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">Today</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.today.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">This week</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.week.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">This month</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.month.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">All time</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.allTime.durationSeconds) }}</p>
      </div>
    </div>

    <div v-if="weekProgress !== null" class="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div class="mb-1 flex justify-between text-sm">
        <span class="text-base-content/60">Weekly goal</span>
        <span class="font-medium">{{ weekProgress }}%</span>
      </div>
      <progress class="progress progress-primary w-full" :value="weekProgress" max="100" />
    </div>

    <div>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold">Tasks</h2>
        <div class="flex items-center gap-2">
          <input v-model="search" placeholder="Search tasks…" class="input input-bordered input-xs w-40" />
          <select v-model="statusFilter" class="select select-bordered select-xs">
            <option value="all">All</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In progress</option>
            <option value="done">Done</option>
          </select>
          <select v-model="sortBy" class="select select-bordered select-xs w-40">
            <option value="created">Newest</option>
            <option value="priority">Priority</option>
            <option value="name">Name</option>
          </select>
          <button class="btn btn-ghost btn-xs gap-1" @click="showTaskForm = true">
            <Plus :size="13" />
            Task
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <TaskRow
          v-for="task in filteredTasks"
          :key="task.id"
          :task="task"
          :duration-seconds="liveTaskDurations[task.id] ?? 0"
          :is-active="timerStore.snapshot?.task?.id === task.id"
          @start="startTask(task)"
          @toggle-complete="toggleComplete(task)"
          @toggle-favorite="toggleFavorite(task)"
          @edit="editingTask = task"
          @archive="archiveTask(task)"
          @delete="removeTask(task)"
        />
        <p v-if="filteredTasks.length === 0" class="py-8 text-center text-sm text-base-content/40">
          No tasks yet
        </p>
      </div>
    </div>

    <TaskFormModal
      v-if="showTaskForm"
      :project-id="props.id"
      @close="showTaskForm = false"
    />
    <TaskFormModal
      v-if="editingTask"
      :project-id="props.id"
      :task="editingTask"
      @close="editingTask = null"
    />
  </div>
</template>
