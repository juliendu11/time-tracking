/**
 * Central, fully-typed IPC contract shared by main, preload and renderer.
 * Nothing in the renderer talks to Node/SQLite except through this surface.
 */
import type {
  AdditionalMetrics,
  AppSettings,
  AppSettingsUpdate,
  BackupFileInfo,
  DailyBucket,
  DashboardSummary,
  ExportBundle,
  FocusScoreBreakdown,
  HeatmapDay,
  IdlePromptPayload,
  IdleResolution,
  Project,
  ProjectDistributionSlice,
  ProjectInput,
  ProjectStats,
  ProjectUpdate,
  ReportFilter,
  ReportGroupBy,
  ReportResult,
  RunningTimerSnapshot,
  SearchResultItem,
  SmartSuggestion,
  Tag,
  TagInput,
  Task,
  TaskFolder,
  TaskFolderInput,
  TaskFolderUpdate,
  TaskInput,
  TaskUpdate,
  TimeEntry,
  TimeEntryInput,
  TimeEntryUpdate,
  TimesheetWeek,
  TopTaskEntry,
  WeekStartsOn
} from './domain'

export interface OverlapCheckResult {
  hasOverlap: boolean
  overlapping: TimeEntry[]
}

export interface DesktopApi {
  projects: {
    list(includeArchived?: boolean): Promise<Project[]>
    get(id: string): Promise<Project | null>
    create(input: ProjectInput): Promise<Project>
    update(id: string, update: ProjectUpdate): Promise<Project>
    archive(id: string): Promise<Project>
    restore(id: string): Promise<Project>
    delete(id: string): Promise<void>
    setFavorite(id: string, isFavorite: boolean): Promise<Project>
    setCurrent(id: string): Promise<AppSettings>
    getStats(id: string): Promise<ProjectStats>
  }
  tasks: {
    listByProject(projectId: string, includeArchived?: boolean): Promise<Task[]>
    get(id: string): Promise<Task | null>
    create(input: TaskInput): Promise<Task>
    update(id: string, update: TaskUpdate): Promise<Task>
    archive(id: string): Promise<Task>
    delete(id: string): Promise<void>
  }
  taskFolders: {
    listByProject(projectId: string): Promise<TaskFolder[]>
    create(input: TaskFolderInput): Promise<TaskFolder>
    update(id: string, update: TaskFolderUpdate): Promise<TaskFolder>
    delete(id: string): Promise<void>
  }
  timeEntries: {
    listInRange(startDate: string, endDate: string, projectId?: string): Promise<TimeEntry[]>
    listRecent(limit: number): Promise<TimeEntry[]>
    listByTask(taskId: string): Promise<TimeEntry[]>
    create(input: TimeEntryInput): Promise<TimeEntry>
    update(id: string, update: TimeEntryUpdate): Promise<TimeEntry>
    delete(id: string): Promise<void>
    checkOverlap(startedAt: string, endedAt: string, excludeId?: string): Promise<OverlapCheckResult>
    restore(entry: TimeEntry): Promise<TimeEntry>
  }
  tags: {
    list(): Promise<Tag[]>
    create(input: TagInput): Promise<Tag>
    delete(id: string): Promise<void>
  }
  timer: {
    getSnapshots(): Promise<RunningTimerSnapshot[]>
    start(params: { projectId: string; taskId?: string | null; description?: string | null }): Promise<RunningTimerSnapshot>
    stop(timerId: string): Promise<TimeEntry | null>
    pause(timerId: string): Promise<RunningTimerSnapshot>
    resume(timerId: string): Promise<RunningTimerSnapshot>
    getPendingIdlePrompt(): Promise<IdlePromptPayload | null>
    resolveIdlePrompt(resolution: IdleResolution): Promise<TimeEntry[]>
    onChanged(callback: (snapshots: RunningTimerSnapshot[]) => void): () => void
    onIdleDetected(callback: (payload: IdlePromptPayload) => void): () => void
  }
  settings: {
    get(): Promise<AppSettings>
    update(update: AppSettingsUpdate): Promise<AppSettings>
  }
  reports: {
    getDashboardSummary(referenceDate: string): Promise<DashboardSummary>
    getLastNDaysBuckets(referenceDate: string, days: number): Promise<DailyBucket[]>
    getHeatmap(referenceDate: string, months: number, projectId?: string): Promise<HeatmapDay[]>
    getProjectDistribution(startDate: string, endDate: string): Promise<ProjectDistributionSlice[]>
    getTopTasks(startDate: string, endDate: string, limit: number): Promise<TopTaskEntry[]>
    getAdditionalMetrics(referenceDate: string): Promise<AdditionalMetrics>
    getFocusScore(referenceDate: string): Promise<FocusScoreBreakdown>
    runReport(filter: ReportFilter, groupBy: ReportGroupBy): Promise<ReportResult>
    getTimesheetWeek(weekStart: string, weekStartsOn: WeekStartsOn): Promise<TimesheetWeek>
  }
  suggestions: {
    get(currentProjectId: string | null, limit?: number): Promise<SmartSuggestion[]>
  }
  search: {
    query(text: string): Promise<SearchResultItem[]>
  }
  backup: {
    exportJson(): Promise<string>
    exportCsv(): Promise<string>
    createNow(): Promise<BackupFileInfo>
    list(): Promise<BackupFileInfo[]>
    openFolder(): Promise<void>
    restore(filePath: string): Promise<void>
    pickBackupFile(): Promise<string | null>
    buildExportBundle(): Promise<ExportBundle>
    resetAllData(): Promise<void>
  }
  system: {
    getVersion(): Promise<string>
    getPlatform(): Promise<NodeJS.Platform>
    openLogsFolder(): Promise<void>
    quit(): Promise<void>
  }
  notifications: {
    sendTest(): Promise<boolean>
  }
}

export const IPC_CHANNELS = {
  projectsList: 'projects:list',
  projectsGet: 'projects:get',
  projectsCreate: 'projects:create',
  projectsUpdate: 'projects:update',
  projectsArchive: 'projects:archive',
  projectsRestore: 'projects:restore',
  projectsDelete: 'projects:delete',
  projectsSetFavorite: 'projects:setFavorite',
  projectsSetCurrent: 'projects:setCurrent',
  projectsGetStats: 'projects:getStats',

  tasksListByProject: 'tasks:listByProject',
  tasksGet: 'tasks:get',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksArchive: 'tasks:archive',
  tasksDelete: 'tasks:delete',

  taskFoldersListByProject: 'taskFolders:listByProject',
  taskFoldersCreate: 'taskFolders:create',
  taskFoldersUpdate: 'taskFolders:update',
  taskFoldersDelete: 'taskFolders:delete',

  timeEntriesListInRange: 'timeEntries:listInRange',
  timeEntriesListRecent: 'timeEntries:listRecent',
  timeEntriesListByTask: 'timeEntries:listByTask',
  timeEntriesCreate: 'timeEntries:create',
  timeEntriesUpdate: 'timeEntries:update',
  timeEntriesDelete: 'timeEntries:delete',
  timeEntriesCheckOverlap: 'timeEntries:checkOverlap',
  timeEntriesRestore: 'timeEntries:restore',

  tagsList: 'tags:list',
  tagsCreate: 'tags:create',
  tagsDelete: 'tags:delete',

  timerGetSnapshots: 'timer:getSnapshots',
  timerStart: 'timer:start',
  timerStop: 'timer:stop',
  timerPause: 'timer:pause',
  timerResume: 'timer:resume',
  timerGetPendingIdlePrompt: 'timer:getPendingIdlePrompt',
  timerResolveIdlePrompt: 'timer:resolveIdlePrompt',
  timerChangedEvent: 'timer:changed',
  timerIdleDetectedEvent: 'timer:idleDetected',

  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',

  reportsDashboardSummary: 'reports:dashboardSummary',
  reportsLastNDays: 'reports:lastNDays',
  reportsHeatmap: 'reports:heatmap',
  reportsProjectDistribution: 'reports:projectDistribution',
  reportsTopTasks: 'reports:topTasks',
  reportsAdditionalMetrics: 'reports:additionalMetrics',
  reportsFocusScore: 'reports:focusScore',
  reportsRun: 'reports:run',
  reportsTimesheetWeek: 'reports:timesheetWeek',

  suggestionsGet: 'suggestions:get',
  searchQuery: 'search:query',

  backupExportJson: 'backup:exportJson',
  backupExportCsv: 'backup:exportCsv',
  backupCreateNow: 'backup:createNow',
  backupList: 'backup:list',
  backupOpenFolder: 'backup:openFolder',
  backupRestore: 'backup:restore',
  backupPickFile: 'backup:pickFile',
  backupBuildExportBundle: 'backup:buildExportBundle',
  backupResetAllData: 'backup:resetAllData',

  systemGetVersion: 'system:getVersion',
  systemGetPlatform: 'system:getPlatform',
  systemOpenLogsFolder: 'system:openLogsFolder',
  systemQuit: 'system:quit',

  notificationsSendTest: 'notifications:sendTest',

  commandStartTimerRequest: 'command:startTimerRequest',
  commandOpenPaletteRequest: 'command:openPaletteRequest'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
