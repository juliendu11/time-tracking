<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
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
import {useUiStore} from '../../stores/ui'
import TaskRow from '../tasks/TaskRow.vue'
import TaskFormModal from '../tasks/TaskFormModal.vue'
import TaskFolderFormModal from '../tasks/TaskFolderFormModal.vue'

const props = defineProps<{ id: string }>()

const projectsStore = useProjectsStore()
const tasksStore = useTasksStore()
const taskFoldersStore = useTaskFoldersStore()
const timerStore = useTimerStore()
const uiStore = useUiStore()
const {t} = useI18n()

const project = ref<Project | null>(null)
const stats = ref<ProjectStats | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'todo' | 'in_progress' | 'done'>('all')
const sortBy = ref<'created' | 'priority' | 'name'>('created')
const showTaskForm = ref(false)
const initialTaskFolderIds = ref<string[]>([])
const initialParentTaskId = ref<string | null>(null)
const editingTask = ref<Task | null>(null)
const showFolderForm = ref(false)
const editingFolder = ref<TaskFolder | null>(null)
const collapsedFolderIds = ref<Set<string>>(new Set())
const collapsedTaskIds = ref<Set<string>>(new Set())

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
watch(() => uiStore.dataVersion, load)

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

/** Done/total counts of each task's direct, non-archived subtasks. */
const subtaskCounts = computed(() => {
  const counts: Record<string, { done: number; total: number }> = {}
  for (const task of tasks.value) {
    if (!task.parentTaskId || task.status === 'archived') continue
    const count = (counts[task.parentTaskId] ??= {done: 0, total: 0})
    count.total++
    if (task.status === 'done') count.done++
  }
  return counts
})

interface TaskTreeRow {
  task: Task
  depth: number
}

/**
 * Flattens a group's tasks into depth-annotated rows. A task whose parent is
 * not shown in the same group (other folder, filtered out) becomes a root.
 */
function toTreeRows(groupTasks: Task[]): TaskTreeRow[] {
  const ids = new Set(groupTasks.map((task) => task.id))
  const childrenByParent = new Map<string, Task[]>()
  const roots: Task[] = []
  for (const task of groupTasks) {
    if (task.parentTaskId && ids.has(task.parentTaskId)) {
      const siblings = childrenByParent.get(task.parentTaskId) ?? []
      siblings.push(task)
      childrenByParent.set(task.parentTaskId, siblings)
    } else {
      roots.push(task)
    }
  }
  const rows: TaskTreeRow[] = []
  const visit = (task: Task, depth: number): void => {
    rows.push({task, depth})
    if (collapsedTaskIds.value.has(task.id)) return
    for (const child of childrenByParent.get(task.id) ?? []) visit(child, depth + 1)
  }
  for (const root of roots) visit(root, 0)
  return rows
}

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
    grouped.push({id: '', name: t('projectDetail.noFolder'), folder: null, tasks: unfiled})
  }
  return grouped.map((group) => ({...group, rows: toTreeRows(group.tasks)}))
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
  try {
    await tasksStore.update(task.id, props.id, {status: task.status === 'done' ? 'todo' : 'done'})
  } catch (e) {
    // Electron prefixes errors thrown by IPC handlers with the channel name.
    const message = e instanceof Error
        ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
        : t('projectDetail.errorUpdateTask')
    uiStore.pushToast({message})
  }
}

function toggleTaskCollapse(task: Task): void {
  const next = new Set(collapsedTaskIds.value)
  if (next.has(task.id)) next.delete(task.id)
  else next.add(task.id)
  collapsedTaskIds.value = next
}

async function toggleFavorite(task: Task): Promise<void> {
  await tasksStore.update(task.id, props.id, {isFavorite: !task.isFavorite})
}

async function archiveTask(task: Task): Promise<void> {
  await tasksStore.archive(task.id, props.id)
}

async function removeTask(task: Task): Promise<void> {
  const subtaskCount = tasks.value.filter((candidate) => candidate.parentTaskId === task.id).length
  const message = subtaskCount === 0
      ? t('projectDetail.confirmDeleteTask', {name: task.name})
      : t('projectDetail.confirmDeleteTaskWithSubtasks', {name: task.name, count: subtaskCount}, subtaskCount)
  if (!window.confirm(message)) return
  await tasksStore.remove(task.id, props.id)
}

function openTaskForm(folderId: string | null = null): void {
  initialTaskFolderIds.value = folderId ? [folderId] : []
  initialParentTaskId.value = null
  showTaskForm.value = true
}

/** Subtasks start in their parent's folders so they appear nested under it. */
function openSubtaskForm(parent: Task): void {
  initialTaskFolderIds.value = [...parent.folderIds]
  initialParentTaskId.value = parent.id
  const next = new Set(collapsedTaskIds.value)
  next.delete(parent.id)
  collapsedTaskIds.value = next
  showTaskForm.value = true
}

function closeTaskForm(): void {
  showTaskForm.value = false
  initialTaskFolderIds.value = []
  initialParentTaskId.value = null
}

function toggleFolder(folderId: string): void {
  const next = new Set(collapsedFolderIds.value)
  if (next.has(folderId)) next.delete(folderId)
  else next.add(folderId)
  collapsedFolderIds.value = next
}

async function removeFolder(folder: TaskFolder): Promise<void> {
  const taskCount = tasks.value.filter((task) => task.folderIds.includes(folder.id)).length
  const message = taskCount === 0
      ? t('projectDetail.confirmDeleteFolder', {name: folder.name})
      : t('projectDetail.confirmDeleteFolderWithTasks', {name: folder.name, count: taskCount}, taskCount)
  if (!window.confirm(message)) return
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
        {{ t('timer.start') }}
      </button>
    </div>

    <div v-if="stats" class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">{{ t('dashboard.header.today') }}</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.today.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">{{ t('dashboard.header.thisWeek') }}</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.week.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">{{ t('projectDetail.thisMonth') }}</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.month.durationSeconds) }}</p>
      </div>
      <div class="rounded-xl border border-base-300 bg-base-200/40 p-3">
        <p class="text-xs text-base-content/50">{{ t('projectDetail.allTime') }}</p>
        <p class="font-semibold">{{ formatDurationSpaced(stats.allTime.durationSeconds) }}</p>
      </div>
    </div>

    <div v-if="weekProgress !== null" class="rounded-xl border border-base-300 bg-base-200/40 p-4">
      <div class="mb-1 flex justify-between text-sm">
        <span class="text-base-content/60">{{ t('dashboard.header.weeklyGoal') }}</span>
        <span class="font-medium">{{ weekProgress }}%</span>
      </div>
      <progress class="progress progress-primary w-full" :value="weekProgress" max="100" />
    </div>

    <div>
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold">{{ t('projectDetail.tasks') }}</h2>
        <div class="flex items-center gap-2">
          <input v-model="search" :placeholder="t('projectDetail.searchPlaceholder')" class="input input-bordered input-xs w-40" />
          <select v-model="statusFilter" class="select select-bordered select-xs">
            <option value="all">{{ t('projectDetail.status.all') }}</option>
            <option value="todo">{{ t('projectDetail.status.todo') }}</option>
            <option value="in_progress">{{ t('projectDetail.status.inProgress') }}</option>
            <option value="done">{{ t('projectDetail.status.done') }}</option>
          </select>
          <select v-model="sortBy" class="select select-bordered select-xs w-40">
            <option value="created">{{ t('projectDetail.sort.newest') }}</option>
            <option value="priority">{{ t('tasks.form.priority') }}</option>
            <option value="name">{{ t('common.name') }}</option>
          </select>
          <button class="btn btn-ghost btn-xs gap-1" @click="showFolderForm = true">
            <FolderPlus :size="13" />
            {{ t('projectDetail.addFolder') }}
          </button>
          <button class="btn btn-ghost btn-xs gap-1" @click="openTaskForm()">
            <Plus :size="13" />
            {{ t('projectDetail.addTask') }}
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
              :aria-label="collapsedFolderIds.has(group.id) ? t('projectDetail.expandFolder') : t('projectDetail.collapseFolder')"
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
                :aria-label="t('projectDetail.addTaskToFolder')"
                @click="openTaskForm(group.id)"
              >
                <Plus :size="12" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square opacity-0 group-hover/folder:opacity-100"
                :aria-label="t('tasks.folderForm.renameTitle')"
                @click="editingFolder = group.folder"
              >
                <Pencil :size="12" />
              </button>
              <button
                class="btn btn-ghost btn-xs btn-square text-error opacity-0 group-hover/folder:opacity-100"
                :aria-label="t('projectDetail.deleteFolder')"
                @click="removeFolder(group.folder)"
              >
                <Trash2 :size="12" />
              </button>
            </template>
          </div>

          <div v-if="!group.folder || !collapsedFolderIds.has(group.id)" class="space-y-1.5">
            <TaskRow
              v-for="{ task, depth } in group.rows"
              :key="task.id"
              :task="task"
              :depth="depth"
              :subtasks="subtaskCounts[task.id]"
              :collapsed="collapsedTaskIds.has(task.id)"
              :duration-seconds="liveTaskDurations[task.id] ?? 0"
              :is-active="timerStore.snapshots.some((snapshot) => snapshot.task?.id === task.id)"
              @start="startTask(task)"
              @toggle-complete="toggleComplete(task)"
              @toggle-collapse="toggleTaskCollapse(task)"
              @add-subtask="openSubtaskForm(task)"
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
              {{ t('projectDetail.addFirstTask') }}
            </button>
          </div>
        </section>
        <p
          v-if="filteredTasks.length === 0 && taskFolders.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          {{ t('projectDetail.noTasks') }}
        </p>
        <p
          v-else-if="taskGroups.length === 0"
          class="py-8 text-center text-sm text-base-content/40"
        >
          {{ t('projectDetail.noMatchingTasks') }}
        </p>
      </div>
    </div>

    <TaskFormModal
      v-if="showTaskForm"
      :project-id="props.id"
      :folders="taskFolders"
      :initial-folder-ids="initialTaskFolderIds"
      :initial-parent-task-id="initialParentTaskId"
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
