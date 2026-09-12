import { globalShortcut } from 'electron'
import { logger } from '@main/logger'
import type { AppContext } from '@main/context'

let registeredAccelerator: string | null = null

function toggleLastTimer(context: AppContext): void {
  const snapshot = context.timer.getSnapshot()
  if (snapshot) {
    context.timer.stop()
    return
  }

  const [lastEntry] = context.timeEntries.listRecent(1)
  const currentProjectId = context.settings.get().currentProjectId
  const projectId = lastEntry?.projectId ?? currentProjectId
  if (!projectId) return

  context.timer.start({ projectId, taskId: lastEntry?.taskId ?? null })
}

export function registerGlobalShortcuts(context: AppContext): void {
  const accelerator = context.settings.get().globalShortcutToggleTimer
  applyAccelerator(context, accelerator)
}

export function applyAccelerator(context: AppContext, accelerator: string): boolean {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }

  const ok = globalShortcut.register(accelerator, () => toggleLastTimer(context))
  if (!ok) {
    logger.warn('Failed to register global shortcut', { accelerator })
    return false
  }
  registeredAccelerator = accelerator
  return true
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
  registeredAccelerator = null
}
