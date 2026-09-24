<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import type { TaskFolder } from '@shared/types/domain'
import { useTaskFoldersStore } from '../../stores/taskFolders'

const props = defineProps<{ projectId: string; folder?: TaskFolder }>()
const emit = defineEmits<{ close: [] }>()

const foldersStore = useTaskFoldersStore()
const { t } = useI18n()
const name = ref(props.folder?.name ?? '')
const saving = ref(false)
const error = ref<string | null>(null)
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

onMounted(async () => {
  await nextTick()
  nameInput.value?.focus()
})

async function submit(): Promise<void> {
  const normalizedName = name.value.trim()
  if (!normalizedName) {
    error.value = t('tasks.folderForm.errorName')
    return
  }

  saving.value = true
  error.value = null
  try {
    if (props.folder) {
      await foldersStore.update(props.folder.id, props.projectId, { name: normalizedName })
    } else {
      await foldersStore.create({ projectId: props.projectId, name: normalizedName })
    }
    emit('close')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <form
      class="w-full max-w-sm rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl"
      @submit.prevent="submit"
    >
      <h2 class="mb-4 text-base font-semibold">{{ folder ? t('tasks.folderForm.renameTitle') : t('tasks.folderForm.newTitle') }}</h2>
      <label class="mb-1 block text-xs font-medium text-base-content/60" for="task-folder-name">{{ t('common.name') }}</label>
      <input
        id="task-folder-name"
        ref="nameInput"
        v-model="name"
        class="input input-bordered input-sm w-full"
        maxlength="100"
        :placeholder="t('tasks.folderForm.namePlaceholder')"
      />
      <p v-if="error" class="mt-2 text-xs text-error">{{ error }}</p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" class="btn btn-ghost btn-sm" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">
          {{ folder ? t('common.save') : t('tasks.folderForm.create') }}
        </button>
      </div>
    </form>
  </div>
</template>
