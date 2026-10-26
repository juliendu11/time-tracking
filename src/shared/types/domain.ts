/**
 * Domain types shared between main, preload and renderer.
 * All dates are ISO-8601 UTC strings on the wire (SQLite stores them as TEXT).
 */

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export interface Project {
  id: string
  name: string
  description: string | null
  color: string
  icon: string
  status: ProjectStatus
  isFavorite: boolean
  isArchived: boolean
  hourlyRate: number | null
  currency: string | null
  weeklyTargetMinutes: number | null
  budgetMinutes: number | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
}

export type ProjectInput = Pick<Project, 'name'> &
  Partial<
    Pick<
      Project,
      | 'description'
      | 'color'
      | 'icon'
      | 'status'
      | 'isFavorite'
      | 'hourlyRate'
      | 'currency'
      | 'weeklyTargetMinutes'
      | 'budgetMinutes'
    >
  >

export type ProjectUpdate = Partial<ProjectInput>

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'archived'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TaskFolder {
  id: string
  projectId: string
  name: string
  position: number
  createdAt: string
  updatedAt: string
}

export type TaskFolderInput = Pick<TaskFolder, 'projectId' | 'name'> &
  Partial<Pick<TaskFolder, 'position'>>

export type TaskFolderUpdate = Partial<Pick<TaskFolder, 'name' | 'position'>>

export interface Task {
  id: string
  projectId: string
  folderIds: string[]
  /** Parent task in the same project; a parent cannot be done until all its children are. */
  parentTaskId: string | null
  name: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  estimatedMinutes: number | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
  completedAt: string | null
  archivedAt: string | null
}

export type TaskInput = Pick<Task, 'projectId' | 'name'> &
  Partial<
    Pick<
      Task,
      | 'folderIds'
      | 'parentTaskId'
      | 'description'
      | 'status'
      | 'priority'
      | 'estimatedMinutes'
      | 'isFavorite'
    >
  >

export type TaskUpdate = Partial<Omit<TaskInput, 'projectId'>> & {
  projectId?: string
}

export type TimeEntrySource =
  | 'timer'
  | 'manual'
  | 'timesheet'
  | 'idle_adjustment'
  | 'import'

export interface TimeEntry {
  id: string
  projectId: string
  taskId: string | null
  description: string | null
  startedAt: string
  endedAt: string | null
  durationSeconds: number
  source: TimeEntrySource
  createdAt: string
  updatedAt: string
  tagIds: string[]
}

export type TimeEntryInput = Pick<TimeEntry, 'projectId' | 'startedAt'> &
  Partial<
    Pick<
      TimeEntry,
      'taskId' | 'description' | 'endedAt' | 'durationSeconds' | 'source'
    >
  > & { tagIds?: string[] }

export type TimeEntryUpdate = Partial<TimeEntryInput>

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
}

export type TagInput = Pick<Tag, 'name'> & Partial<Pick<Tag, 'color'>>

export type ThemePreference = 'system' | 'light' | 'dark'
export type WeekStartsOn = 0 | 1
export type TimeFormat = '24h' | '12h'
export type DateFormat = 'iso' | 'us' | 'eu'
export type QuickSwitchBehavior = 'atomic_switch' | 'ask_to_stop'

/** UI languages the app ships translations for. */
export const SUPPORTED_LANGUAGES = ['en', 'fr'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export function isSupportedLanguage(value: string): value is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export interface AppSettings {
  theme: ThemePreference
  language: Language
  weekStartsOn: WeekStartsOn
  timeFormat: TimeFormat
  dateFormat: DateFormat
  defaultProjectId: string | null
  currentProjectId: string | null
  idleDetectionEnabled: boolean
  idleThresholdMinutes: number
  launchAtStartup: boolean
  minimizeToTray: boolean
  confirmBeforeDeletingEntry: boolean
  dailyGoalMinutes: number | null
  weeklyGoalMinutes: number | null
  notificationsEnabled: boolean
  quickSwitchBehavior: QuickSwitchBehavior
  streakThresholdMinutes: number
  autoBackupEnabled: boolean
  autoBackupFrequency: 'daily' | 'weekly'
  autoBackupKeepCount: number
  pomodoroEnabled: boolean
  pomodoroFocusMinutes: number
  pomodoroBreakMinutes: number
  pomodoroLongBreakMinutes: number
  globalShortcutToggleTimer: string
  showMiniTimer: boolean
  miniTimerAlwaysOnTop: boolean
}

export type AppSettingsUpdate = Partial<AppSettings>

/** One of the active timers in the application, persisted in SQLite. */
export interface ActiveTimerState {
  id: string
  projectId: string
  taskId: string | null
  description: string | null
  startedAt: string
  /** Sum of all completed pause intervals, in seconds. */
  accumulatedPauseSeconds: number
  /** Set while the timer is paused; null while running. */
  pausedAt: string | null
  /** Present while the system is suspected asleep since this timestamp. */
  suspendedAt: string | null
}

export interface RunningTimerSnapshot {
  timer: ActiveTimerState
  project: Project
  task: Task | null
  /** Elapsed seconds excluding paused time, computed at snapshot time. */
  elapsedSeconds: number
  isPaused: boolean
}

export interface IdlePromptPayload {
  idleStartedAt: string
  idleSeconds: number
  /** Timers that were running when the idle period was detected. */
  timers: ActiveTimerState[]
}

export type IdleResolution = 'discard' | 'keep' | 'split'

export interface DurationStats {
  durationSeconds: number
  sessions: number
}

export interface ProjectStats {
  today: DurationStats
  week: DurationStats & { goalPercentage: number | null }
  month: DurationStats
  allTime: DurationStats
  budgetPercentage: number | null
}

export interface DashboardSummary {
  todaySeconds: number
  weekSeconds: number
  weeklyGoalMinutes: number | null
  previousWeekSeconds: number
  changeVsLastWeekPercent: number | null
}

export interface DailyBucket {
  date: string
  durationSeconds: number
}

export interface HeatmapDay {
  date: string
  durationSeconds: number
  sessions: number
  projectCount: number
}

export interface ProjectDistributionSlice {
  projectId: string
  projectName: string
  color: string
  durationSeconds: number
  percentage: number
}

export interface TopTaskEntry {
  taskId: string
  taskName: string
  projectId: string
  projectName: string
  durationSeconds: number
}

export interface AdditionalMetrics {
  dailyAverageSeconds: number
  longestSessionSeconds: number
  sessionsToday: number
  sessionsWeek: number
  activeDaysWeek: number
  currentStreakDays: number
  mostProductiveWeekday: number | null
  mostProductiveHourRange: { startHour: number; endHour: number } | null
  weeklyConsistencyPercent: number | null
}

export interface FocusScoreBreakdown {
  score: number
  averageSessionMinutes: number
  interruptionCount: number
  dailyGoalReached: boolean
  fragmentationPenalty: number
}

export type ReportGroupBy = 'project' | 'task' | 'day' | 'week' | 'month' | 'tag'

export interface ReportFilter {
  startDate: string
  endDate: string
  projectIds?: string[]
  taskIds?: string[]
  tagIds?: string[]
  onlyWithoutTask?: boolean
}

export interface ReportGroupRow {
  key: string
  label: string
  durationSeconds: number
  sessions: number
  averageSessionSeconds: number
}

export interface ReportResult {
  totalSeconds: number
  totalSessions: number
  averageSessionSeconds: number
  topProject: { id: string; name: string; durationSeconds: number } | null
  topTask: { id: string; name: string; durationSeconds: number } | null
  groups: ReportGroupRow[]
}

export interface TimesheetCell {
  projectId: string
  taskId: string | null
  /** ISO date (yyyy-MM-dd), one per day of the week. */
  day: string
  durationSeconds: number
}

export interface TimesheetRow {
  projectId: string
  projectName: string
  projectColor: string
  taskId: string | null
  taskName: string | null
  cells: Record<string, number>
  totalSeconds: number
}

export interface TimesheetWeek {
  weekStart: string
  weekEnd: string
  rows: TimesheetRow[]
  dailyTotals: Record<string, number>
  weekTotalSeconds: number
}

export interface ExportBundle {
  exportedAt: string
  version: number
  projects: Project[]
  taskFolders: TaskFolder[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  tags: Tag[]
  settings: AppSettings
}

export interface BackupFileInfo {
  fileName: string
  filePath: string
  createdAt: string
  sizeBytes: number
}

export interface SmartSuggestion {
  taskId: string | null
  taskName: string | null
  projectId: string
  projectName: string
  projectColor: string
  score: number
}

export interface SearchResultItem {
  kind: 'project' | 'task' | 'timeEntry' | 'tag'
  id: string
  title: string
  subtitle: string | null
}
