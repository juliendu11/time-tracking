import { z } from 'zod'

const isoDate = z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date')

export const projectStatusSchema = z.enum(['active', 'paused', 'completed', 'archived'])

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  icon: z.string().max(50).optional(),
  status: projectStatusSchema.optional(),
  isFavorite: z.boolean().optional(),
  hourlyRate: z.number().nonnegative().nullable().optional(),
  currency: z.string().max(10).nullable().optional(),
  weeklyTargetMinutes: z.number().int().positive().nullable().optional(),
  budgetMinutes: z.number().int().positive().nullable().optional()
})

export const projectUpdateSchema = projectInputSchema.partial()

export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done', 'archived'])
export const taskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])

export const taskFolderInputSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, 'Folder name is required').max(100),
  position: z.number().int().nonnegative().optional()
})

export const taskFolderUpdateSchema = taskFolderInputSchema.omit({ projectId: true }).partial()

export const taskInputSchema = z.object({
  projectId: z.string().min(1),
  folderIds: z.array(z.string().min(1)).optional(),
  parentTaskId: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1, 'Task name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  isFavorite: z.boolean().optional()
})

export const taskUpdateSchema = taskInputSchema.partial().extend({
  projectId: z.string().min(1).optional()
})

export const timeEntrySourceSchema = z.enum(['timer', 'manual', 'timesheet', 'idle_adjustment', 'import'])

export const timeEntryInputSchema = z
  .object({
    projectId: z.string().min(1),
    taskId: z.string().min(1).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    startedAt: isoDate,
    endedAt: isoDate.nullable().optional(),
    durationSeconds: z.number().int().nonnegative().optional(),
    source: timeEntrySourceSchema.optional(),
    tagIds: z.array(z.string().min(1)).optional()
  })
  .refine(
    (data) => !data.endedAt || new Date(data.endedAt).getTime() > new Date(data.startedAt).getTime(),
    { message: 'endedAt must be after startedAt', path: ['endedAt'] }
  )

export const timeEntryUpdateSchema = z.object({
  projectId: z.string().min(1).optional(),
  taskId: z.string().min(1).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  startedAt: isoDate.optional(),
  endedAt: isoDate.nullable().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
  source: timeEntrySourceSchema.optional(),
  tagIds: z.array(z.string().min(1)).optional()
})

export const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
})

export const appSettingsUpdateSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']),
    language: z.string().min(2).max(10),
    weekStartsOn: z.union([z.literal(0), z.literal(1)]),
    timeFormat: z.enum(['24h', '12h']),
    dateFormat: z.enum(['iso', 'us', 'eu']),
    defaultProjectId: z.string().nullable(),
    currentProjectId: z.string().nullable(),
    idleDetectionEnabled: z.boolean(),
    idleThresholdMinutes: z.number().int().min(1).max(120),
    launchAtStartup: z.boolean(),
    minimizeToTray: z.boolean(),
    confirmBeforeDeletingEntry: z.boolean(),
    dailyGoalMinutes: z.number().int().positive().nullable(),
    weeklyGoalMinutes: z.number().int().positive().nullable(),
    notificationsEnabled: z.boolean(),
    quickSwitchBehavior: z.enum(['atomic_switch', 'ask_to_stop']),
    streakThresholdMinutes: z.number().int().positive(),
    autoBackupEnabled: z.boolean(),
    autoBackupFrequency: z.enum(['daily', 'weekly']),
    autoBackupKeepCount: z.number().int().positive(),
    pomodoroEnabled: z.boolean(),
    pomodoroFocusMinutes: z.number().int().positive(),
    pomodoroBreakMinutes: z.number().int().positive(),
    pomodoroLongBreakMinutes: z.number().int().positive(),
    globalShortcutToggleTimer: z.string().min(1),
    showMiniTimer: z.boolean(),
    miniTimerAlwaysOnTop: z.boolean()
  })
  .partial()

export const startTimerSchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1).nullable().optional(),
  description: z.string().max(2000).nullable().optional()
})

export const reportFilterSchema = z.object({
  startDate: isoDate,
  endDate: isoDate,
  projectIds: z.array(z.string()).optional(),
  taskIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
  onlyWithoutTask: z.boolean().optional()
})

export const reportGroupBySchema = z.enum(['project', 'task', 'day', 'week', 'month', 'tag'])

export const idleResolutionSchema = z.enum(['discard', 'keep', 'split'])
