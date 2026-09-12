import { computed, ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import type { AppSettings, AppSettingsUpdate } from '@shared/types/domain'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings | null>(null)
  const loaded = ref(false)

  async function load(): Promise<void> {
    settings.value = await window.desktop.settings.get()
    loaded.value = true
  }

  async function update(patch: AppSettingsUpdate): Promise<void> {
    if (!settings.value) return
    // Optimistic update for snappy toggles; server response is authoritative.
    settings.value = { ...settings.value, ...patch }
    settings.value = await window.desktop.settings.update(patch)
  }

  const effectiveTheme = computed<'light' | 'dark'>(() => {
    const pref = settings.value?.theme ?? 'system'
    if (pref === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return pref
  })

  watchEffect(() => {
    const theme = effectiveTheme.value === 'dark' ? 'tt-dark' : 'tt-light'
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = effectiveTheme.value
  })

  if (typeof window !== 'undefined' && window.matchMedia) {
    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        // Force recomputation for "system" theme users.
        if (settings.value) settings.value = { ...settings.value }
      })
  }

  return { settings, loaded, load, update, effectiveTheme }
})
