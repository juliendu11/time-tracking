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
  const snapshot = context.timer.getSnapshot()

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
          if (task) context.timer.switchTask(task.id)
          else if (project) context.timer.switchProject(project.id)
        }
      }
    })

  const header = snapshot
    ? [
        { label: `● ${snapshot.project.name}`, enabled: false },
        ...(snapshot.task ? [{ label: `  ${snapshot.task.name}`, enabled: false }] : []),
        { label: `  ${formatDurationClock(snapshot.elapsedSeconds)}`, enabled: false },
        {
          label: snapshot.isPaused ? 'Resume timer' : 'Pause timer',
          click: () => (snapshot.isPaused ? context.timer.resume() : context.timer.pause())
        },
        { label: 'Stop timer', click: () => context.timer.stop() }
      ]
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
    snapshot ? `TimeTracker — ${snapshot.project.name} ${formatDurationClock(snapshot.elapsedSeconds)}` : 'TimeTracker'
  )
}
