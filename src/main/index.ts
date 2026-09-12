import { app, BrowserWindow } from 'electron'
import { buildAppContext } from '@main/context'
import { openDatabase, closeDatabase } from '@main/db/client'
import { registerIpcHandlers } from '@main/ipc/registerHandlers'
import { logger } from '@main/logger'
import { applyLaunchAtStartup } from '@main/autostart'
import { registerGlobalShortcuts, unregisterAllShortcuts } from '@main/shortcuts/globalShortcuts'
import { NotificationService } from '@main/services/notification.service'
import { SeedService } from '@main/services/seed.service'
import { createTray, destroyTray } from '@main/tray/tray'
import { createMainWindow, showMainWindow } from '@main/windows/mainWindow'
import { toggleMiniTimerWindow } from '@main/windows/miniTimerWindow'

const AUTO_BACKUP_CHECK_INTERVAL_MS = 6 * 3600_000

let isQuitting = false

function maybeRunAutoBackup(context: ReturnType<typeof buildAppContext>): void {
  const settings = context.settings.get()
  if (!settings.autoBackupEnabled) return

  const backups = context.backup.listBackups()
  const latest = backups[0]
  const intervalMs = settings.autoBackupFrequency === 'daily' ? 24 * 3600_000 : 7 * 24 * 3600_000
  const isDue = !latest || Date.now() - new Date(latest.createdAt).getTime() >= intervalMs

  if (isDue) {
    try {
      context.backup.createBackupNow()
      context.backup.pruneOldBackups(settings.autoBackupKeepCount)
    } catch (error) {
      logger.error('Automatic backup failed', error)
    }
  }
}

function bootstrap(): void {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', () => showMainWindow())

  app.whenReady().then(() => {
    const { db } = openDatabase()
    const context = buildAppContext(db, () => {
      isQuitting = true
      app.relaunch()
      app.quit()
    })

    registerIpcHandlers(context)

    if (process.env.SEED === '1' && !app.isPackaged) {
      new SeedService(context.projects, context.tasks, context.timeEntries, context.tags).run()
    }

    context.timer.restore()

    createMainWindow({
      onCloseToTray: () => !isQuitting && context.settings.get().minimizeToTray
    })

    createTray(context)
    registerGlobalShortcuts(context)
    context.idle.start()
    applyLaunchAtStartup(context.settings.get().launchAtStartup)

    if (context.settings.get().showMiniTimer) {
      toggleMiniTimerWindow(true, context.settings.get().miniTimerAlwaysOnTop)
    }

    const notifications = new NotificationService(context)
    notifications.start()

    maybeRunAutoBackup(context)
    setInterval(() => maybeRunAutoBackup(context), AUTO_BACKUP_CHECK_INTERVAL_MS)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow({
          onCloseToTray: () => !isQuitting && context.settings.get().minimizeToTray
        })
      } else {
        showMainWindow()
      }
    })

    app.on('before-quit', () => {
      isQuitting = true
      context.idle.stop()
      notifications.stop()
      unregisterAllShortcuts()
      destroyTray()
    })

    app.on('will-quit', () => {
      closeDatabase()
    })

    logger.info('TimeTracker ready')
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      // On Windows/Linux the app keeps running in the tray unless the user
      // explicitly quit (handled by the mainWindow close interception).
    }
  })
}

bootstrap()
