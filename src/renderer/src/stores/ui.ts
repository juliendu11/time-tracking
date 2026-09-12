import { ref } from 'vue'
import { defineStore } from 'pinia'

export interface Toast {
  id: string
  message: string
  actionLabel?: string
  onAction?: () => void
  timeoutMs?: number
}

export const useUiStore = defineStore('ui', () => {
  const commandPaletteOpen = ref(false)
  const sidebarCollapsed = ref(false)
  const manualEntryOpen = ref(false)
  const newProjectOpen = ref(false)
  const toasts = ref<Toast[]>([])

  function openCommandPalette(): void {
    commandPaletteOpen.value = true
  }
  function closeCommandPalette(): void {
    commandPaletteOpen.value = false
  }
  function toggleSidebar(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function pushToast(toast: Omit<Toast, 'id'>): void {
    const id = crypto.randomUUID()
    const timeoutMs = toast.timeoutMs ?? 6000
    toasts.value.push({ id, ...toast, timeoutMs })
    window.setTimeout(() => dismissToast(id), timeoutMs)
  }

  function dismissToast(id: string): void {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    commandPaletteOpen,
    sidebarCollapsed,
    manualEntryOpen,
    newProjectOpen,
    toasts,
    openCommandPalette,
    closeCommandPalette,
    toggleSidebar,
    pushToast,
    dismissToast
  }
})
