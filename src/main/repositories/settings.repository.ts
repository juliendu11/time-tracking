import { eq } from 'drizzle-orm'
import type { AppDatabase } from '@main/db/client'
import { appSettings } from '@main/db/schema'
import type {
  AppSettings,
  AppSettingsUpdate,
  DateFormat,
  QuickSwitchBehavior,
  ThemePreference,
  TimeFormat,
  WeekStartsOn
} from '@shared/types/domain'

type SettingsRow = typeof appSettings.$inferSelect

function toDomain(row: SettingsRow): AppSettings {
  return {
    theme: row.theme as ThemePreference,
    language: row.language,
    weekStartsOn: row.weekStartsOn as WeekStartsOn,
    timeFormat: row.timeFormat as TimeFormat,
    dateFormat: row.dateFormat as DateFormat,
    defaultProjectId: row.defaultProjectId,
    currentProjectId: row.currentProjectId,
    idleDetectionEnabled: row.idleDetectionEnabled,
    idleThresholdMinutes: row.idleThresholdMinutes,
    launchAtStartup: row.launchAtStartup,
    minimizeToTray: row.minimizeToTray,
    confirmBeforeDeletingEntry: row.confirmBeforeDeletingEntry,
    dailyGoalMinutes: row.dailyGoalMinutes,
    weeklyGoalMinutes: row.weeklyGoalMinutes,
    notificationsEnabled: row.notificationsEnabled,
    quickSwitchBehavior: row.quickSwitchBehavior as QuickSwitchBehavior,
    streakThresholdMinutes: row.streakThresholdMinutes,
    autoBackupEnabled: row.autoBackupEnabled,
    autoBackupFrequency: row.autoBackupFrequency as 'daily' | 'weekly',
    autoBackupKeepCount: row.autoBackupKeepCount,
    pomodoroEnabled: row.pomodoroEnabled,
    pomodoroFocusMinutes: row.pomodoroFocusMinutes,
    pomodoroBreakMinutes: row.pomodoroBreakMinutes,
    pomodoroLongBreakMinutes: row.pomodoroLongBreakMinutes,
    globalShortcutToggleTimer: row.globalShortcutToggleTimer,
    showMiniTimer: row.showMiniTimer,
    miniTimerAlwaysOnTop: row.miniTimerAlwaysOnTop
  }
}

export class SettingsRepository {
  constructor(private readonly db: AppDatabase) {
    this.ensureRow()
  }

  private ensureRow(): void {
    const existing = this.db.select().from(appSettings).where(eq(appSettings.id, 1)).get()
    if (!existing) {
      this.db.insert(appSettings).values({ id: 1 }).run()
    }
  }

  get(): AppSettings {
    const row = this.db.select().from(appSettings).where(eq(appSettings.id, 1)).get()
    if (!row) throw new Error('Settings row missing after initialisation')
    return toDomain(row)
  }

  update(update: AppSettingsUpdate): AppSettings {
    this.db.update(appSettings).set(update).where(eq(appSettings.id, 1)).run()
    return this.get()
  }

  setCurrentProject(projectId: string | null): AppSettings {
    return this.update({ currentProjectId: projectId })
  }
}
