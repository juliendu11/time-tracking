<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Languages } from '@lucide/vue'
import { SUPPORTED_LANGUAGES, type Language } from '@shared/types/domain'
import { LANGUAGE_NAMES } from '../i18n'
import { useSettingsStore } from '../stores/settings'

const { t } = useI18n()
const settingsStore = useSettingsStore()

const current = computed<Language>(() => settingsStore.settings?.language ?? 'en')

async function select(language: Language): Promise<void> {
  // Closes the DaisyUI focus-driven dropdown.
  ;(document.activeElement as HTMLElement | null)?.blur()
  if (language !== current.value) await settingsStore.update({ language })
}
</script>

<template>
  <div class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn btn-ghost btn-sm gap-1.5"
      :title="t('settings.language.label')"
      :aria-label="t('settings.language.label')"
    >
      <Languages :size="15" />
      <span class="text-xs font-semibold uppercase">{{ current }}</span>
    </div>
    <ul tabindex="0" class="dropdown-content menu z-30 mt-1 w-40 rounded-box border border-base-300 bg-base-100 p-1 shadow-xl">
      <li v-for="language in SUPPORTED_LANGUAGES" :key="language">
        <button class="flex items-center justify-between" :lang="language" @click="select(language)">
          {{ LANGUAGE_NAMES[language] }}
          <Check v-if="language === current" :size="14" class="text-primary" />
        </button>
      </li>
    </ul>
  </div>
</template>
