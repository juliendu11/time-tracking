import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/types/ipc'
import type { DesktopApi } from '@shared/types/ipc'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args)

const desktopApi: DesktopApi = {
  projects: {
    list: (includeArchived) => invoke(IPC_CHANNELS.projectsList, includeArchived),
    get: (id) => invoke(IPC_CHANNELS.projectsGet, id),
    create: (input) => invoke(IPC_CHANNELS.projectsCreate, input),
    update: (id, update) => invoke(IPC_CHANNELS.projectsUpdate, id, update),
    archive: (id) => invoke(IPC_CHANNELS.projectsArchive, id),
    restore: (id) => invoke(IPC_CHANNELS.projectsRestore, id),
    delete: (id) => invoke(IPC_CHANNELS.projectsDelete, id),
    setFavorite: (id, isFavorite) => invoke(IPC_CHANNELS.projectsSetFavorite, id, isFavorite),
    setCurrent: (id) => invoke(IPC_CHANNELS.projectsSetCurrent, id),
    getStats: (id) => invoke(IPC_CHANNELS.projectsGetStats, id)
  },
  tasks: {
    listByProject: (projectId, includeArchived) =>
      invoke(IPC_CHANNELS.tasksListByProject, projectId, includeArchived),
    get: (id) => invoke(IPC_CHANNELS.tasksGet, id),
    create: (input) => invoke(IPC_CHANNELS.tasksCreate, input),
    update: (id, update) => invoke(IPC_CHANNELS.tasksUpdate, id, update),
    archive: (id) => invoke(IPC_CHANNELS.tasksArchive, id),
    delete: (id) => invoke(IPC_CHANNELS.tasksDelete, id)
  },
  timeEntries: {
    listInRange: (startDate, endDate, projectId) =>
      invoke(IPC_CHANNELS.timeEntriesListInRange, startDate, endDate, projectId),
    listRecent: (limit) => invoke(IPC_CHANNELS.timeEntriesListRecent, limit),
    listByTask: (taskId) => invoke(IPC_CHANNELS.timeEntriesListByTask, taskId),
    create: (input) => invoke(IPC_CHANNELS.timeEntriesCreate, input),
    update: (id, update) => invoke(IPC_CHANNELS.timeEntriesUpdate, id, update),
    delete: (id) => invoke(IPC_CHANNELS.timeEntriesDelete, id),
    checkOverlap: (startedAt, endedAt, excludeId) =>
      invoke(IPC_CHANNELS.timeEntriesCheckOverlap, startedAt, endedAt, excludeId),
    restore: (entry) => invoke(IPC_CHANNELS.timeEntriesRestore, entry)
  },
  tags: {
    list: () => invoke(IPC_CHANNELS.tagsList),
    create: (input) => invoke(IPC_CHANNELS.tagsCreate, input),
    delete: (id) => invoke(IPC_CHANNELS.tagsDelete, id)
  },
  timer: {
    getSnapshot: () => invoke(IPC_CHANNELS.timerGetSnapshot),
    start: (params) => invoke(IPC_CHANNELS.timerStart, params),
    stop: () => invoke(IPC_CHANNELS.timerStop),
    pause: () => invoke(IPC_CHANNELS.timerPause),
    resume: () => invoke(IPC_CHANNELS.timerResume),
    switchTask: (taskId) => invoke(IPC_CHANNELS.timerSwitchTask, taskId),
    switchProject: (projectId) => invoke(IPC_CHANNELS.timerSwitchProject, projectId),
    getPendingIdlePrompt: () => invoke(IPC_CHANNELS.timerGetPendingIdlePrompt),
    resolveIdlePrompt: (resolution) => invoke(IPC_CHANNELS.timerResolveIdlePrompt, resolution),
    onChanged: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, snapshot: Parameters<typeof callback>[0]): void =>
        callback(snapshot)
      ipcRenderer.on(IPC_CHANNELS.timerChangedEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.timerChangedEvent, listener)
    },
    onIdleDetected: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]): void =>
        callback(payload)
      ipcRenderer.on(IPC_CHANNELS.timerIdleDetectedEvent, listener)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.timerIdleDetectedEvent, listener)
    }
  },
  settings: {
    get: () => invoke(IPC_CHANNELS.settingsGet),
    update: (update) => invoke(IPC_CHANNELS.settingsUpdate, update)
  },
  reports: {
    getDashboardSummary: (referenceDate) => invoke(IPC_CHANNELS.reportsDashboardSummary, referenceDate),
    getLastNDaysBuckets: (referenceDate, days) =>
      invoke(IPC_CHANNELS.reportsLastNDays, referenceDate, days),
    getHeatmap: (referenceDate, months, projectId) =>
      invoke(IPC_CHANNELS.reportsHeatmap, referenceDate, months, projectId),
    getProjectDistribution: (startDate, endDate) =>
      invoke(IPC_CHANNELS.reportsProjectDistribution, startDate, endDate),
    getTopTasks: (startDate, endDate, limit) =>
      invoke(IPC_CHANNELS.reportsTopTasks, startDate, endDate, limit),
    getAdditionalMetrics: (referenceDate) =>
      invoke(IPC_CHANNELS.reportsAdditionalMetrics, referenceDate),
    getFocusScore: (referenceDate) => invoke(IPC_CHANNELS.reportsFocusScore, referenceDate),
    runReport: (filter, groupBy) => invoke(IPC_CHANNELS.reportsRun, filter, groupBy),
    getTimesheetWeek: (weekStart, weekStartsOn) =>
      invoke(IPC_CHANNELS.reportsTimesheetWeek, weekStart, weekStartsOn)
  },
  suggestions: {
    get: (currentProjectId, limit) => invoke(IPC_CHANNELS.suggestionsGet, currentProjectId, limit)
  },
  search: {
    query: (text) => invoke(IPC_CHANNELS.searchQuery, text)
  },
  backup: {
    exportJson: () => invoke(IPC_CHANNELS.backupExportJson),
    exportCsv: () => invoke(IPC_CHANNELS.backupExportCsv),
    createNow: () => invoke(IPC_CHANNELS.backupCreateNow),
    list: () => invoke(IPC_CHANNELS.backupList),
    openFolder: () => invoke(IPC_CHANNELS.backupOpenFolder),
    restore: (filePath) => invoke(IPC_CHANNELS.backupRestore, filePath),
    pickBackupFile: () => invoke(IPC_CHANNELS.backupPickFile),
    buildExportBundle: () => invoke(IPC_CHANNELS.backupBuildExportBundle),
    resetAllData: () => invoke(IPC_CHANNELS.backupResetAllData)
  },
  system: {
    getVersion: () => invoke(IPC_CHANNELS.systemGetVersion),
    getPlatform: () => invoke(IPC_CHANNELS.systemGetPlatform),
    openLogsFolder: () => invoke(IPC_CHANNELS.systemOpenLogsFolder),
    quit: () => invoke(IPC_CHANNELS.systemQuit)
  },
  notifications: {
    sendTest: () => invoke(IPC_CHANNELS.notificationsSendTest)
  }
}

contextBridge.exposeInMainWorld('desktop', desktopApi)

export type { DesktopApi }
