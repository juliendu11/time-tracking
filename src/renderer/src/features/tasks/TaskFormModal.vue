<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { Task, TaskFolder, TaskPriority } from '@shared/types/domain'
import { useTasksStore } from '../../stores/tasks'

const props = defineProps<{
  projectId: string
  task?: Task
  folders?: TaskFolder[]
  initialFolderId?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const tasksStore = useTasksStore()

const form = reactive({
  name: props.task?.name ?? '',
  folderId: props.task?.folderId ?? props.initialFolderId ?? null,
  description: props.task?.description ?? '',
  priority: (props.task?.priority ?? 'normal') as TaskPriority,
  estimatedHours: props.task?.estimatedMinutes ? props.task.estimatedMinutes / 60 : null
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
      folderId: form.folderId,
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
      <h2 class="mb-4 text-base font-semibold">{{ task ? 'Edit task' : 'New task' }}</h2>

      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Name</label>
          <input v-model="form.name" class="input input-bordered input-sm w-full" placeholder="Task name" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">Folder</label>
          <select v-model="form.folderId" class="select select-bordered select-sm w-full">
            <option :value="null">No folder</option>
            <option v-for="folder in folders" :key="folder.id" :value="folder.id">
              {{ folder.name }}
            </option>
          </select>
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
