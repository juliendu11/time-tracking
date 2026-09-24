<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Task, TaskFolder, TaskPriority } from '@shared/types/domain'
import { useTasksStore } from '../../stores/tasks'

const props = defineProps<{
  projectId: string
  task?: Task
  folders?: TaskFolder[]
  initialFolderIds?: string[]
  initialParentTaskId?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const tasksStore = useTasksStore()

const form = reactive({
  name: props.task?.name ?? '',
  folderIds: props.task?.folderIds ?? props.initialFolderIds ?? [],
  parentTaskId: props.task?.parentTaskId ?? props.initialParentTaskId ?? null,
  description: props.task?.description ?? '',
  priority: (props.task?.priority ?? 'normal') as TaskPriority,
  estimatedHours: props.task?.estimatedMinutes ? props.task.estimatedMinutes / 60 : null
})

/**
 * Candidate parents in tree order, indented by depth. The edited task and its
 * descendants are excluded since nesting under them would create a cycle.
 */
const parentOptions = computed(() => {
  const candidates = tasksStore
    .tasksFor(props.projectId)
    .filter((t) => t.status !== 'archived' || t.id === form.parentTaskId)
  const childrenByParent = new Map<string | null, Task[]>()
  const ids = new Set(candidates.map((t) => t.id))
  for (const t of candidates) {
    const key = t.parentTaskId && ids.has(t.parentTaskId) ? t.parentTaskId : null
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), t])
  }
  const options: Array<{ id: string; label: string }> = []
  const visit = (t: Task, depth: number): void => {
    if (t.id === props.task?.id) return
    options.push({ id: t.id, label: `${'\u2003'.repeat(depth)}${depth > 0 ? '↳ ' : ''}${t.name}` })
    for (const child of childrenByParent.get(t.id) ?? []) visit(child, depth + 1)
  }
  for (const root of childrenByParent.get(null) ?? []) visit(root, 0)
  return options
})

const saving = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    error.value = 'Task name is required.'
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      // Electron's structured clone cannot serialize Vue's reactive array proxy.
      folderIds: [...form.folderIds],
      parentTaskId: form.parentTaskId,
      description: form.description || null,
      priority: form.priority,
      estimatedMinutes: form.estimatedHours ? Math.round(form.estimatedHours * 60) : null
    }
    if (props.task) {
      await tasksStore.update(props.task.id, props.projectId, payload)
    } else {
      await tasksStore.create({ projectId: props.projectId, ...payload })
    }
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Something went wrong.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
      <h2 class="mb-4 text-base font-semibold">
        {{ task ? 'Edit task' : form.parentTaskId ? 'New subtask' : 'New task' }}
      </h2>

      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Name</label>
          <input v-model="form.name" class="input input-bordered input-sm w-full" placeholder="Task name" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Parent task</label>
          <select v-model="form.parentTaskId" class="select select-bordered select-sm w-full">
            <option :value="null">None (top-level task)</option>
            <option v-for="option in parentOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div>
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-base-content/60">Folders</span>
            <span v-if="form.folderIds.length > 0" class="text-[11px] text-base-content/40">
              {{ form.folderIds.length }} selected
            </span>
          </div>
          <div
            v-if="folders?.length"
            class="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-base-300 bg-base-200/30 p-1.5"
          >
            <label
              v-for="folder in folders"
              :key="folder.id"
              class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-base-100"
              :class="form.folderIds.includes(folder.id) ? 'bg-primary/10 text-primary' : ''"
            >
              <input
                v-model="form.folderIds"
                type="checkbox"
                class="checkbox checkbox-primary checkbox-xs"
                :value="folder.id"
              />
              <span class="truncate">{{ folder.name }}</span>
            </label>
          </div>
          <p v-else class="rounded-lg border border-dashed border-base-300 px-3 py-2 text-xs text-base-content/40">
            No folders in this project yet.
          </p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Description</label>
          <textarea v-model="form.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">Priority</label>
            <select v-model="form.priority" class="select select-bordered select-sm w-full">
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">Estimate (h)</label>
            <input v-model.number="form.estimatedHours" type="number" min="0" step="0.5" class="input input-bordered input-sm w-full" />
          </div>
        </div>
        <p v-if="error" class="text-xs text-error">{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="submit">
          {{ task ? 'Save' : 'Create task' }}
        </button>
      </div>
    </div>
  </div>
</template>
