import { app, Menu, nativeImage, Tray } from 'electron'
import { formatDurationClock } from '@shared/utils/duration'
import type { AppContext } from '@main/context'
import { resourcePath } from '@main/resourcePaths'
import { showMainWindow } from '@main/windows/mainWindow'

let tray: Tray | null = null
let refreshHandle: NodeJS.Timeout | null = null

function trayIconPath(): string {
  return resourcePath('tray-icon.png')
}

export function createTray(context: AppContext): Tray {
  const icon = nativeImage.createFromPath(trayIconPath())
  tray = new Tray(icon)
  tray.setToolTip('TimeTracker')
  tray.on('click', () => showMainWindow())

  rebuildTrayMenu(context)
  context.timer.on('changed', () => rebuildTrayMenu(context))

  refreshHandle = setInterval(() => rebuildTrayMenu(context), 30_000)

  return tray
}

export function destroyTray(): void {
  if (refreshHandle) clearInterval(refreshHandle)
  tray?.destroy()
  tray = null
}

function rebuildTrayMenu(context: AppContext): void {
  if (!tray) return
  const snapshots = context.timer.getSnapshots()

  const recentEntries = context.timeEntries.listRecent(8)
  const seen = new Set<string>()
  const recentTasksMenu = recentEntries
    .filter((e) => {
      const key = `${e.projectId}::${e.taskId ?? 'none'}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 5)
    .map((entry) => {
      const project = context.projects.findById(entry.projectId)
      const task = entry.taskId ? context.tasks.findById(entry.taskId) : null
      const label = task ? `${project?.name ?? '?'} / ${task.name}` : project?.name ?? 'Unknown'
      return {
        label: `▶ ${label}`,
        click: () => {
          if (project) context.timer.start({ projectId: project.id, taskId: task?.id ?? null })
        }
      }
    })

  const header =
    snapshots.length > 0
      ? snapshots.flatMap((snapshot, index) => [
          ...(index > 0 ? [{ type: 'separator' as const }] : []),
          { label: `● ${snapshot.project.name}`, enabled: false },
          { label: `  ${snapshot.task?.name ?? 'No task'}`, enabled: false },
          { label: `  ${formatDurationClock(snapshot.elapsedSeconds)}`, enabled: false },
          {
            label: snapshot.isPaused ? 'Resume timer' : 'Pause timer',
            click: () =>
              snapshot.isPaused
                ? context.timer.resume(snapshot.timer.id)
                : context.timer.pause(snapshot.timer.id)
          },
          { label: 'Stop timer', click: () => context.timer.stop(snapshot.timer.id) }
        ])
      : [{ label: 'No timer running', enabled: false }]

  const menu = Menu.buildFromTemplate([
    { label: 'TimeTracker', enabled: false },
    { type: 'separator' },
    ...header,
    { type: 'separator' },
    ...(recentTasksMenu.length > 0
      ? [{ label: 'Recent tasks', enabled: false }, ...recentTasksMenu, { type: 'separator' as const }]
      : []),
    { label: 'Open TimeTracker', click: () => showMainWindow() },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.setToolTip(
    snapshots.length > 0
      ? `TimeTracker — ${snapshots.length} active timer${snapshots.length === 1 ? '' : 's'}`
      : 'TimeTracker'
  )
}
