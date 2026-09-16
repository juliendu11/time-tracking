<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Pencil,
  Play,
  Plus,
  Trash2
} from '@lucide/vue'
import type {Project, ProjectStats, Task, TaskFolder, TaskPriority} from '@shared/types/domain'
import {formatDurationSpaced} from '@shared/utils/duration'
import {useProjectsStore} from '../../stores/projects'
import {useTaskFoldersStore} from '../../stores/taskFolders'
import {useTasksStore} from '../../stores/tasks'
import {useTimerStore} from '../../stores/timer'
import TaskRow from '../tasks/TaskRow.vue'
import TaskFormModal from '../tasks/TaskFormModal.vue'
import TaskFolderFormModal from '../tasks/TaskFolderFormModal.vue'

const props = defineProps<{ id: string }>()

const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const taskFoldersStore = useTaskFoldersStore()
const timerStore = useTimerStore()

const project = ref<Project | null>(null)
const stats = ref<ProjectStats | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'todo' | 'in_progress' | 'done'>('all')
const sortBy = ref<'created' | 'priority' | 'name'>('created')
const showTaskForm = ref(false)
const initialTaskFolderId = ref<string | null>(null)
const editingTask = ref<Task | null>(null)
const showFolderForm = ref(false)
const editingFolder = ref<TaskFolder | null>(null)
const collapsedFolderIds = ref<Set<string>>(new Set())

async function load(): Promise<void> {
  if (projectsStore.projects.length === 0) await projectsStore.load()
  project.value = projectsStore.byId(props.id) ?? (await window.desktop.projects.get(props.id))
  stats.value = await window.desktop.projects.getStats(props.id)
  await Promise.all([
    tasksStore.loadForProject(props.id, true),
    taskFoldersStore.loadForProject(props.id)
  ])
}

onMounted(load)
watch(() => props.id, load)

const tasks = computed(() => tasksStore.tasksFor(props.id))
const taskFolders = computed(() => taskFoldersStore.foldersFor(props.id))

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

const taskGroups = computed(() => {
  const isFiltering = search.value.trim() !== '' || statusFilter.value !== 'all'
  let grouped: Array<{
    id: string
    name: string
    folder: TaskFolder | null
    tasks: Task[]
  }> = taskFolders.value.map((folder) => ({
    id: folder.id,
    name: folder.name,
    folder,
    tasks: filteredTasks.value.filter((task) => task.folderIds.includes(folder.id))
  }))
  if (isFiltering) grouped = grouped.filter((group) => group.tasks.length > 0)
  const unfiled = filteredTasks.value.filter((task) => task.folderIds.length === 0)
  if (unfiled.length > 0 || (!isFiltering && taskFolders.value.length === 0)) {
    grouped.push({id: '', name: 'No folder', folder: null, tasks: unfiled})
  }
  return grouped
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
  const durations = {...taskDurations.value}
  for (const snapshot of timerStore.snapshots) {
    if (!snapshot.task) continue
    durations[snapshot.task.id] =
        (durations[snapshot.task.id] ?? 0) + timerStore.elapsedSeconds(snapshot.timer.id)
  }
  return durations
})

// A changed timer ID means the live duration composition changed; stopping
// one may also have finalised a TimeEntry. Refresh persisted totals and stats.
watch(
    () => timerStore.snapshots.map((snapshot) => snapshot.timer.id).join(','),
    (newId, oldId) => {
      if (newId === oldId) return
      void refreshDurations()
      void refreshStats()
    }
)

async function startTask(task: Task): Promise<void> {
  await timerStore.start({projectId: task.projectId, taskId: task.id})
}

async function startFreeTimer(): Promise<void> {
  await timerStore.start({projectId: props.id})
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

function openTaskForm(folderId: string | null = null): void {
  initialTaskFolderId.value = folderId
  showTaskForm.value = true
}

function closeTaskForm(): void {
  showTaskForm.value = false
  initialTaskFolderId.value = null
}

function toggleFolder(folderId: string): void {
  const next = new Set(collapsedFolderIds.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  collapsedFolderIds.value = next
}

async function removeFolder(folder: TaskFolder): Promise<void> {
  const taskCount = tasks.value.filter((task) => task.folderIds.includes(folder.id)).length
  const detail = taskCount === 0
      ? ''
      : ` It will be removed from ${taskCount} task${taskCount === 1 ? '' : 's'}; their other folders will be preserved.`
  if (!window.confirm(`Delete folder "${folder.name}"?${detail}`)) return
  await taskFoldersStore.remove(folder.id, props.id)
  await tasksStore.loadForProject(props.id, true)
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
          <button class="btn btn-ghost btn-xs gap-1" @click="showFolderForm = true">
            <FolderPlus :size="13" />
            Folder
          </button>
          <button class="btn btn-ghost btn-xs gap-1" @click="openTaskForm()">
            <Plus :size="13" />
            Task
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <section v-for="group in taskGroups" :key="group.id || 'unfiled'" class="group/folder">
          <div
            v-if="group.folder || taskFolders.length > 0"
            class="mb-1.5 flex min-h-8 items-center gap-1 rounded-lg px-2 text-base-content/60 hover:bg-base-200/60"
          >
            <button
              v-if="group.folder"
              class="btn btn-ghost btn-xs btn-square"
              :aria-label="collapsedFolderIds.has(group.id) ? 'Expand folder' : 'Collapse folder'"
              @click="toggleFolder(group.id)"
            >
              <ChevronRight v-if="collapsedFolderIds.has(group.id)" :size="14" />
              <ChevronDown v-else :size="14" />
            </button>
            <span v-else class="w-6" />
            <Folder :size="15" :fill="group.folder ? 'currentColor' : 'none'" class="opacity-70" />
            <span class="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider">
              {{ group.name }}
            </span>
            <span class="text-xs tabular-nums text-base-content/35">{{ group.tasks.length }}</span>
            <template v-if="group.folder">
              <button
                class="btn btn-ghost btn-xs btn-square opacity-0 group-hover/folder:opacity-100"
                aria-label="Add task to folder"
                @click="openTaskForm(group.id)"
              >
                <Plus :size="12" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square opacity-0 group-hover/folder:opacity-100"
                aria-label="Rename folder"
                @click="editingFolder = group.folder"
              >
                <Pencil :size="12" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square text-error opacity-0 group-hover/folder:opacity-100"
                aria-label="Delete folder"
                @click="removeFolder(group.folder)"
              >
                <Trash2 :size="12" />
              </button>
            </template>
          </div>

          <div v-if="!group.folder || !collapsedFolderIds.has(group.id)" class="space-y-1.5">
            <TaskRow
              v-for="task in group.tasks"
              :key="task.id"
              :task="task"
              :duration-seconds="liveTaskDurations[task.id] ?? 0"
              :is-active="timerStore.snapshots.some((snapshot) => snapshot.task?.id === task.id)"
              @start="startTask(task)"
              @toggle-complete="toggleComplete(task)"
              @toggle-favorite="toggleFavorite(task)"
              @edit="editingTask = task"
              @archive="archiveTask(task)"
              @delete="removeTask(task)"
            />
            <button
              v-if="group.folder && group.tasks.length === 0 && !search && statusFilter === 'all'"
              class="w-full rounded-lg border border-dashed border-base-300 py-3 text-xs text-base-content/35 transition-colors hover:border-primary/40 hover:text-primary"
              @click="openTaskForm(group.id)"
            >
              Add the first task
            </button>
          </div>
        </section>
        <p
          v-if="filteredTasks.length === 0 && taskFolders.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          No tasks yet
        </p>
        <p
          v-else-if="taskGroups.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          No matching tasks
        </p>
      </div>
    </div>

    <TaskFormModal
      v-if="showTaskForm"
      :project-id="props.id"
      :folders="taskFolders"
      :initial-folder-id="initialTaskFolderId"
      @close="closeTaskForm"
    />
    <TaskFormModal
      v-if="editingTask"
      :project-id="props.id"
      :task="editingTask"
      :folders="taskFolders"
      @close="editingTask = null"
    />
    <TaskFolderFormModal
      v-if="showFolderForm"
      :project-id="props.id"
      @close="showFolderForm = false"
    />
    <TaskFolderFormModal
      v-if="editingFolder"
      :project-id="props.id"
      :folder="editingFolder"
      @close="editingFolder = null"
    />
  </div>
</template>
