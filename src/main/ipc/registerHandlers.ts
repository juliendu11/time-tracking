import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type {
  AppSettingsUpdate,
  IdleResolution,
  ProjectInput,
  ProjectUpdate,
  ReportFilter,
  ReportGroupBy,
  TagInput,
  TimeEntryInput,
  TimeEntryUpdate,
  TaskInput,
  TaskUpdate,
  TimeEntry,
  WeekStartsOn
} from '@shared/types/domain'
import {
  appSettingsUpdateSchema,
  idleResolutionSchema,
  projectInputSchema,
  projectUpdateSchema,
  reportFilterSchema,
  reportGroupBySchema,
  startTimerSchema,
  tagInputSchema,
  taskInputSchema,
  taskUpdateSchema,
  timeEntryInputSchema,
  timeEntryUpdateSchema
} from '@shared/validation/schemas'
import { logger } from '@main/logger'
import { toIpcError } from '@main/errors'
import { getBackupsDir, getLogsDir } from '@main/paths'
import type { AppContext } from '@main/context'
import { applyAccelerator } from '@main/shortcuts/globalShortcuts'
import { toggleMiniTimerWindow } from '@main/windows/miniTimerWindow'
import { applyLaunchAtStartup } from '@main/autostart'

function handle<Args extends unknown[], Result>(
  channel: string,
  fn: (...args: Args) => Result | Promise<Result>
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
    try {
      return await fn(...(args as Args))
    } catch (error) {
      const payload = toIpcError(error)
      logger.error(`IPC handler failed: ${channel}`, error)
      const wrapped = new Error(payload.message)
      ;(wrapped as Error & { code?: string }).code = payload.code
      throw wrapped
    }
  })
}

export function registerIpcHandlers(context: AppContext): void {
  const { projects, tasks, timeEntries, tags, settings, timer, reports, suggestions, search, backup } =
    context

  // --- Projects ---------------------------------------------------------
  handle(IPC_CHANNELS.projectsList, (includeArchived?: boolean) =>
    projects.list({ includeArchived })
  )
  handle(IPC_CHANNELS.projectsGet, (id: string) => projects.findById(id))
  handle(IPC_CHANNELS.projectsCreate, (input: ProjectInput) =>
    projects.create(projectInputSchema.parse(input))
  )
  handle(IPC_CHANNELS.projectsUpdate, (id: string, update: ProjectUpdate) =>
    projects.update(id, projectUpdateSchema.parse(update))
  )
  handle(IPC_CHANNELS.projectsArchive, (id: string) => projects.archive(id))
  handle(IPC_CHANNELS.projectsRestore, (id: string) => projects.restore(id))
  handle(IPC_CHANNELS.projectsDelete, (id: string) => projects.delete(id))
  handle(IPC_CHANNELS.projectsSetFavorite, (id: string, isFavorite: boolean) =>
    projects.setFavorite(id, isFavorite)
  )
  handle(IPC_CHANNELS.projectsSetCurrent, (id: string) => settings.setCurrentProject(id))
  handle(IPC_CHANNELS.projectsGetStats, (id: string) => reports.getProjectStats(id, new Date()))

  // --- Tasks --------------------------------------------------------------
  handle(IPC_CHANNELS.tasksListByProject, (projectId: string, includeArchived?: boolean) =>
    tasks.listByProject(projectId, { includeArchived })
  )
  handle(IPC_CHANNELS.tasksGet, (id: string) => tasks.findById(id))
  handle(IPC_CHANNELS.tasksCreate, (input: TaskInput) => tasks.create(taskInputSchema.parse(input)))
  handle(IPC_CHANNELS.tasksUpdate, (id: string, update: TaskUpdate) =>
    tasks.update(id, taskUpdateSchema.parse(update))
  )
  handle(IPC_CHANNELS.tasksArchive, (id: string) => tasks.archive(id))
  handle(IPC_CHANNELS.tasksDelete, (id: string) => tasks.delete(id))

  // --- Time entries ---------------------------------------------------------
  handle(
    IPC_CHANNELS.timeEntriesListInRange,
    (startDate: string, endDate: string, projectId?: string) =>
      timeEntries.listInRange({
        startDate,
        endDate,
        projectIds: projectId ? [projectId] : undefined
      })
  )
  handle(IPC_CHANNELS.timeEntriesListRecent, (limit: number) => timeEntries.listRecent(limit))
  handle(IPC_CHANNELS.timeEntriesListByTask, (taskId: string) => timeEntries.listByTask(taskId))
  handle(IPC_CHANNELS.timeEntriesCreate, (input: TimeEntryInput) =>
    timeEntries.create(timeEntryInputSchema.parse(input))
  )
  handle(IPC_CHANNELS.timeEntriesUpdate, (id: string, update: TimeEntryUpdate) =>
    timeEntries.update(id, timeEntryUpdateSchema.parse(update))
  )
  handle(IPC_CHANNELS.timeEntriesDelete, (id: string) => timeEntries.delete(id))
  handle(
    IPC_CHANNELS.timeEntriesCheckOverlap,
    (startedAt: string, endedAt: string, excludeId?: string) => {
      const overlapping = timeEntries.findOverlapping(startedAt, endedAt, excludeId)
      return { hasOverlap: overlapping.length > 0, overlapping }
    }
  )
  handle(IPC_CHANNELS.timeEntriesRestore, (entry: TimeEntry) => timeEntries.restore(entry))

  // --- Tags -----------------------------------------------------------------
  handle(IPC_CHANNELS.tagsList, () => tags.list())
  handle(IPC_CHANNELS.tagsCreate, (input: TagInput) => tags.create(tagInputSchema.parse(input)))
  handle(IPC_CHANNELS.tagsDelete, (id: string) => tags.delete(id))

  // --- Timer ------------------------------------------------------------------
  handle(IPC_CHANNELS.timerGetSnapshot, () => timer.getSnapshot())
  handle(
    IPC_CHANNELS.timerStart,
    (params: { projectId: string; taskId?: string | null; description?: string | null }) =>
      timer.start(startTimerSchema.parse(params))
  )
  handle(IPC_CHANNELS.timerStop, () => timer.stop())
  handle(IPC_CHANNELS.timerPause, () => timer.pause())
  handle(IPC_CHANNELS.timerResume, () => timer.resume())
  handle(IPC_CHANNELS.timerSwitchTask, (taskId: string) => timer.switchTask(taskId))
  handle(IPC_CHANNELS.timerSwitchProject, (projectId: string) => timer.switchProject(projectId))
  handle(IPC_CHANNELS.timerGetPendingIdlePrompt, () => timer.getPendingIdlePrompt())
  handle(IPC_CHANNELS.timerResolveIdlePrompt, (resolution: IdleResolution) =>
    timer.resolveIdlePrompt(idleResolutionSchema.parse(resolution))
  )

  timer.on('changed', (snapshot) => {
    broadcast(IPC_CHANNELS.timerChangedEvent, snapshot)
  })
  timer.on('idle-detected', (payload) => {
    broadcast(IPC_CHANNELS.timerIdleDetectedEvent, payload)
  })

  // --- Settings ---------------------------------------------------------------
  handle(IPC_CHANNELS.settingsGet, () => settings.get())
  handle(IPC_CHANNELS.settingsUpdate, (update: AppSettingsUpdate) => {
    const next = settings.update(appSettingsUpdateSchema.parse(update))
    if (update.globalShortcutToggleTimer) applyAccelerator(context, next.globalShortcutToggleTimer)
    if (update.showMiniTimer !== undefined) {
      toggleMiniTimerWindow(next.showMiniTimer, next.miniTimerAlwaysOnTop)
    }
    if (update.launchAtStartup !== undefined) applyLaunchAtStartup(next.launchAtStartup)
    return next
  })

  // --- Reports ------------------------------------------------------------------
  handle(IPC_CHANNELS.reportsDashboardSummary, (referenceDate: string) =>
    reports.getDashboardSummary(new Date(referenceDate), settings.get().weeklyGoalMinutes)
  )
  handle(IPC_CHANNELS.reportsLastNDays, (referenceDate: string, days: number) =>
    reports.getLastNDaysBuckets(new Date(referenceDate), days)
  )
  handle(IPC_CHANNELS.reportsHeatmap, (referenceDate: string, months: number, projectId?: string) =>
    reports.getHeatmap(new Date(referenceDate), months, projectId)
  )
  handle(IPC_CHANNELS.reportsProjectDistribution, (startDate: string, endDate: string) =>
    reports.getProjectDistribution(new Date(startDate), new Date(endDate))
  )
  handle(IPC_CHANNELS.reportsTopTasks, (startDate: string, endDate: string, limit: number) =>
    reports.getTopTasks(new Date(startDate), new Date(endDate), limit)
  )
  handle(IPC_CHANNELS.reportsAdditionalMetrics, (referenceDate: string) =>
    reports.getAdditionalMetrics(new Date(referenceDate), settings.get().streakThresholdMinutes)
  )
  handle(IPC_CHANNELS.reportsFocusScore, (referenceDate: string) =>
    reports.getFocusScore(new Date(referenceDate), settings.get().dailyGoalMinutes)
  )
  handle(IPC_CHANNELS.reportsRun, (filter: ReportFilter, groupBy: ReportGroupBy) =>
    reports.runReport(reportFilterSchema.parse(filter), reportGroupBySchema.parse(groupBy))
  )
  handle(IPC_CHANNELS.reportsTimesheetWeek, (weekStart: string, weekStartsOn: WeekStartsOn) =>
    reports.getTimesheetWeek(new Date(weekStart), weekStartsOn)
  )

  // --- Suggestions & search -----------------------------------------------------
  handle(IPC_CHANNELS.suggestionsGet, (currentProjectId: string | null, limit?: number) =>
    suggestions.getSuggestions({ currentProjectId, limit })
  )
  handle(IPC_CHANNELS.searchQuery, (text: string) => search.search(text))

  // --- Backup / export -------------------------------------------------------------
  handle(IPC_CHANNELS.backupExportJson, () => backup.exportJson())
  handle(IPC_CHANNELS.backupExportCsv, () => backup.exportCsv())
  handle(IPC_CHANNELS.backupCreateNow, () => backup.createBackupNow())
  handle(IPC_CHANNELS.backupList, () => backup.listBackups())
  handle(IPC_CHANNELS.backupOpenFolder, () => shell.openPath(getBackupsDir()))
  handle(IPC_CHANNELS.backupBuildExportBundle, () => backup.buildExportBundle())
  handle(IPC_CHANNELS.backupPickFile, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = win
      ? await dialog.showOpenDialog(win, {
          filters: [{ name: 'SQLite backup', extensions: ['sqlite3'] }],
          properties: ['openFile']
        })
      : await dialog.showOpenDialog({
          filters: [{ name: 'SQLite backup', extensions: ['sqlite3'] }],
          properties: ['openFile']
        })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })
  handle(IPC_CHANNELS.backupRestore, async (filePath: string) => {
    backup.restoreBackup(filePath)
    context.requestRestart()
  })

  // --- System ---------------------------------------------------------------------
  handle(IPC_CHANNELS.systemGetVersion, () => app.getVersion())
  handle(IPC_CHANNELS.systemGetPlatform, () => process.platform)
  handle(IPC_CHANNELS.systemOpenLogsFolder, () => shell.openPath(getLogsDir()))
  handle(IPC_CHANNELS.systemQuit, () => {
    app.quit()
  })
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}
