<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { reactive, ref } from 'vue'
import type { Project } from '@shared/types/domain'
import { useProjectsStore } from '../../stores/projects'

const props = defineProps<{ project?: Project }>()
const emit = defineEmits<{ close: [] }>()

const projectsStore = useProjectsStore()
const { t } = useI18n()

const COLORS = ['#7C6CF6', '#4CC9C0', '#F5A25D', '#EF6E8B', '#5AA9E6', '#9BD35A', '#E85D75', '#8B8FA3']
const ICONS = ['folder', 'sparkles', 'megaphone', 'book-open', 'code', 'briefcase', 'rocket', 'palette']

const form = reactive({
  name: props.project?.name ?? '',
  description: props.project?.description ?? '',
  color: props.project?.color ?? COLORS[0]!,
  icon: props.project?.icon ?? ICONS[0]!,
  hourlyRate: props.project?.hourlyRate ?? null,
  weeklyTargetMinutes: props.project?.weeklyTargetMinutes
    ? props.project.weeklyTargetMinutes / 60
    : null,
  budgetMinutes: props.project?.budgetMinutes ? props.project.budgetMinutes / 60 : null
})

const saving = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  if (!form.name.trim()) {
    error.value = t('projects.form.errorName')
    return
  }
  saving.value = true
  error.value = null
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description || null,
      color: form.color,
      icon: form.icon,
      hourlyRate: form.hourlyRate,
      weeklyTargetMinutes: form.weeklyTargetMinutes ? Math.round(form.weeklyTargetMinutes * 60) : null,
      budgetMinutes: form.budgetMinutes ? Math.round(form.budgetMinutes * 60) : null
    }
    if (props.project) {
      await projectsStore.update(props.project.id, payload)
    } else {
      const created = await projectsStore.create(payload)
      if (!projectsStore.currentProjectId) {
        await projectsStore.setCurrent(created.id)
      }
    }
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-xl border border-base-300 bg-base-100 p-5 shadow-2xl">
      <h2 class="mb-4 text-base font-semibold">{{ project ? t('projects.form.editTitle') : t('projects.new') }}</h2>

      <div class="space-y-3">
        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('common.name') }}</label>
          <input v-model="form.name" class="input input-bordered input-sm w-full" :placeholder="t('projects.form.namePlaceholder')" />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('common.description') }}</label>
          <textarea v-model="form.description" class="textarea textarea-bordered textarea-sm w-full" rows="2" />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('projects.form.color') }}</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="color in COLORS"
              :key="color"
              class="h-6 w-6 rounded-full ring-offset-2 ring-offset-base-100"
              :class="form.color === color ? 'ring-2 ring-primary' : ''"
              :style="{ backgroundColor: color }"
              @click="form.color = color"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('projects.form.weeklyTarget') }}</label>
            <input v-model.number="form.weeklyTargetMinutes" type="number" min="0" step="0.5" class="input input-bordered input-sm w-full" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('projects.form.budget') }}</label>
            <input v-model.number="form.budgetMinutes" type="number" min="0" step="0.5" class="input input-bordered input-sm w-full" />
          </div>
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-base-content/60">{{ t('projects.form.hourlyRate') }}</label>
          <input v-model.number="form.hourlyRate" type="number" min="0" step="1" class="input input-bordered input-sm w-full" />
        </div>

        <p v-if="error" class="text-xs text-error">{{ error }}</p>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button class="btn btn-ghost btn-sm" @click="emit('close')">{{ t('common.cancel') }}</button>
        <button class="btn btn-primary btn-sm" :disabled="saving" @click="submit">
          {{ project ? t('common.save') : t('palette.createProject') }}
        </button>
      </div>
    </div>
  </div>
</template>
