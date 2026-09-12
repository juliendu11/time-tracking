<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AppSettingsUpdate, BackupFileInfo } from '@shared/types/domain'
import { useProjectsStore } from '../../stores/projects'
import { useSettingsStore } from '../../stores/settings'
import { useUiStore } from '../../stores/ui'

const settingsStore = useSettingsStore()
const projectsStore = useProjectsStore()
const uiStore = useUiStore()

type Tab = 'general' | 'appearance' | 'timer' | 'idle' | 'goals' | 'shortcuts' | 'backup' | 'advanced' | 'about'
const tab = ref<Tab>('general')

const tabs: { id: Tab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'timer', label: 'Timer' },
  { id: 'idle', label: 'Idle detection' },
  { id: 'goals', label: 'Goals' },
  { id: 'shortcuts', label: 'Shortcuts' },
  { id: 'backup', label: 'Backup & Data' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'about', label: 'About' }
]

const backups = ref<BackupFileInfo[]>([])
const appVersion = ref('')
const platform = ref('')

onMounted(async () => {
  if (!settingsStore.settings) await settingsStore.load()
  if (projectsStore.projects.length === 0) await projectsStore.load()
  backups.value = await window.desktop.backup.list()
  appVersion.value = await window.desktop.system.getVersion()
  platform.value = await window.desktop.system.getPlatform()
})

async function set(patch: AppSettingsUpdate): Promise<void> {
  await settingsStore.update(patch)
}

async function createBackup(): Promise<void> {
  await window.desktop.backup.createNow()
  backups.value = await window.desktop.backup.list()
  uiStore.pushToast({ message: 'Backup created' })
}

async function restoreBackup(filePath: string): Promise<void> {
  if (!window.confirm('Restore this backup? Your current data will be safety-backed-up first, then the app will restart.')) {
    return
  }
  await window.desktop.backup.restore(filePath)
}

async function pickAndRestore(): Promise<void> {
  const filePath = await window.desktop.backup.pickBackupFile()
  if (filePath) await restoreBackup(filePath)
}

async function exportJson(): Promise<void> {
  const path = await window.desktop.backup.exportJson()
  uiStore.pushToast({ message: `Exported to ${path}` })
}
async function exportCsv(): Promise<void> {
  const path = await window.desktop.backup.exportCsv()
  uiStore.pushToast({ message: `Exported to ${path}` })
}

async function openBackupFolder(): Promise<void> {
  await window.desktop.backup.openFolder()
}

async function openLogsFolder(): Promise<void> {
  await window.desktop.system.openLogsFolder()
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl gap-8 p-6">
    <nav class="w-40 shrink-0 space-y-0.5">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="block w-full rounded-lg px-3 py-1.5 text-left text-sm"
        :class="tab === t.id ? 'bg-primary/15 text-primary font-medium' : 'text-base-content/70 hover:bg-base-300/40'"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <div v-if="settingsStore.settings" class="min-w-0 flex-1 space-y-4">
      <section v-if="tab === 'general'" class="space-y-4">
        <h2 class="text-base font-semibold">General</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">Default project</span></label>
          <select
            class="select select-bordered select-sm w-64"
            :value="settingsStore.settings.defaultProjectId ?? ''"
            @change="set({ defaultProjectId: ($event.target as HTMLSelectElement).value || null })"
          >
            <option value="">None</option>
            <option v-for="p in projectsStore.activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.minimizeToTray"
            @change="set({ minimizeToTray: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Minimize to tray instead of quitting</span>
        </label>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.launchAtStartup"
            @change="set({ launchAtStartup: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Launch at startup</span>
        </label>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.confirmBeforeDeletingEntry"
            @change="set({ confirmBeforeDeletingEntry: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Confirm before deleting a time entry</span>
        </label>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.notificationsEnabled"
            @change="set({ notificationsEnabled: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Desktop notifications</span>
        </label>
      </section>

      <section v-else-if="tab === 'appearance'" class="space-y-4">
        <h2 class="text-base font-semibold">Appearance</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">Theme</span></label>
          <div class="flex gap-2">
            <button
              v-for="opt in (['system', 'light', 'dark'] as const)"
              :key="opt"
              class="btn btn-sm capitalize"
              :class="settingsStore.settings.theme === opt ? 'btn-primary' : 'btn-ghost border border-base-300'"
              @click="set({ theme: opt })"
            >
              {{ opt }}
            </button>
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Week starts on</span></label>
          <select
            class="select select-bordered select-sm w-40"
            :value="settingsStore.settings.weekStartsOn"
            @change="set({ weekStartsOn: Number(($event.target as HTMLSelectElement).value) as 0 | 1 })"
          >
            <option :value="1">Monday</option>
            <option :value="0">Sunday</option>
          </select>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Time format</span></label>
          <select
            class="select select-bordered select-sm w-40"
            :value="settingsStore.settings.timeFormat"
            @change="set({ timeFormat: ($event.target as HTMLSelectElement).value as '24h' | '12h' })"
          >
            <option value="24h">24-hour</option>
            <option value="12h">12-hour</option>
          </select>
        </div>
      </section>

      <section v-else-if="tab === 'timer'" class="space-y-4">
        <h2 class="text-base font-semibold">Timer</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">When starting a timer while one is already running</span></label>
          <select
            class="select select-bordered select-sm w-72"
            :value="settingsStore.settings.quickSwitchBehavior"
            @change="set({ quickSwitchBehavior: ($event.target as HTMLSelectElement).value as 'atomic_switch' | 'ask_to_stop' })"
          >
            <option value="atomic_switch">Switch immediately (stop old, start new)</option>
            <option value="ask_to_stop">Ask for confirmation first</option>
          </select>
        </div>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.showMiniTimer"
            @change="set({ showMiniTimer: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Show mini timer window</span>
        </label>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.miniTimerAlwaysOnTop"
            @change="set({ miniTimerAlwaysOnTop: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Mini timer always on top</span>
        </label>

        <div class="divider" />
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.pomodoroEnabled"
            @change="set({ pomodoroEnabled: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Enable Pomodoro</span>
        </label>
        <div v-if="settingsStore.settings.pomodoroEnabled" class="grid grid-cols-3 gap-3">
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">Focus (min)</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.pomodoroFocusMinutes"
              @change="set({ pomodoroFocusMinutes: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">Break (min)</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.pomodoroBreakMinutes"
              @change="set({ pomodoroBreakMinutes: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">Long break (min)</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.pomodoroLongBreakMinutes"
              @change="set({ pomodoroLongBreakMinutes: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>
      </section>

      <section v-else-if="tab === 'idle'" class="space-y-4">
        <h2 class="text-base font-semibold">Idle detection</h2>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.idleDetectionEnabled"
            @change="set({ idleDetectionEnabled: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Detect when I'm away from the keyboard</span>
        </label>
        <div class="form-control">
          <label class="label"><span class="label-text">Idle threshold (minutes)</span></label>
          <input
            type="number"
            min="1"
            class="input input-bordered input-sm w-32"
            :value="settingsStore.settings.idleThresholdMinutes"
            @change="set({ idleThresholdMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <p class="text-xs text-base-content/50">
          We never silently remove tracked time — you'll always be asked what to do when you return from being idle.
        </p>
      </section>

      <section v-else-if="tab === 'goals'" class="space-y-4">
        <h2 class="text-base font-semibold">Goals</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Daily goal (minutes)</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.dailyGoalMinutes ?? ''"
              @change="set({ dailyGoalMinutes: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Weekly goal (minutes)</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.weeklyGoalMinutes ?? ''"
              @change="set({ weeklyGoalMinutes: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
            />
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">Streak threshold (minutes/day)</span></label>
          <input
            type="number"
            class="input input-bordered input-sm w-40"
            :value="settingsStore.settings.streakThresholdMinutes"
            @change="set({ streakThresholdMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </section>

      <section v-else-if="tab === 'shortcuts'" class="space-y-4">
        <h2 class="text-base font-semibold">Shortcuts</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">Start/stop last timer (global)</span></label>
          <input
            type="text"
            class="input input-bordered input-sm w-64"
            :value="settingsStore.settings.globalShortcutToggleTimer"
            @change="set({ globalShortcutToggleTimer: ($event.target as HTMLInputElement).value })"
          />
          <p class="mt-1 text-xs text-base-content/50">
            Example: CommandOrControl+Shift+Space. If it doesn't apply, another app may already use it.
          </p>
        </div>
        <ul class="space-y-1 text-sm text-base-content/70">
          <li><kbd class="kbd kbd-sm">⌘/Ctrl</kbd> + <kbd class="kbd kbd-sm">K</kbd> — Command Palette</li>
          <li><kbd class="kbd kbd-sm">⌘/Ctrl</kbd> + <kbd class="kbd kbd-sm">P</kbd> — Quick switcher</li>
          <li><kbd class="kbd kbd-sm">Esc</kbd> — Close overlay</li>
        </ul>
      </section>

      <section v-else-if="tab === 'backup'" class="space-y-4">
        <h2 class="text-base font-semibold">Backup & Data</h2>
        <label class="label w-fit cursor-pointer gap-3">
          <input
            type="checkbox"
            class="toggle toggle-sm"
            :checked="settingsStore.settings.autoBackupEnabled"
            @change="set({ autoBackupEnabled: ($event.target as HTMLInputElement).checked })"
          />
          <span class="label-text">Automatic backups</span>
        </label>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">Frequency</span></label>
            <select
              class="select select-bordered select-sm"
              :value="settingsStore.settings.autoBackupFrequency"
              @change="set({ autoBackupFrequency: ($event.target as HTMLSelectElement).value as 'daily' | 'weekly' })"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">Keep</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.autoBackupKeepCount"
              @change="set({ autoBackupKeepCount: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm" @click="createBackup">Create backup now</button>
          <button class="btn btn-sm" @click="openBackupFolder">Open backup folder</button>
          <button class="btn btn-sm" @click="pickAndRestore">Restore backup…</button>
          <button class="btn btn-sm" @click="exportJson">Export JSON</button>
          <button class="btn btn-sm" @click="exportCsv">Export CSV</button>
        </div>

        <div v-if="backups.length > 0" class="rounded-lg border border-base-300">
          <div
            v-for="b in backups.slice(0, 8)"
            :key="b.filePath"
            class="flex items-center justify-between border-b border-base-300/60 px-3 py-2 text-sm last:border-0"
          >
            <span class="truncate">{{ b.fileName }}</span>
            <div class="flex items-center gap-2 text-xs text-base-content/50">
              <span>{{ new Date(b.createdAt).toLocaleString() }}</span>
              <button class="link" @click="restoreBackup(b.filePath)">Restore</button>
            </div>
          </div>
        </div>
      </section>

      <section v-else-if="tab === 'advanced'" class="space-y-4">
        <h2 class="text-base font-semibold">Advanced</h2>
        <button class="btn btn-sm" @click="openLogsFolder">Open logs folder</button>
      </section>

      <section v-else-if="tab === 'about'" class="space-y-2">
        <h2 class="text-base font-semibold">About</h2>
        <p class="text-sm text-base-content/70">TimeTracker v{{ appVersion }}</p>
        <p class="text-sm text-base-content/70">Platform: {{ platform }}</p>
        <p class="text-xs text-base-content/40">A local-first, offline time tracking desktop app. No account, no cloud.</p>
      </section>
    </div>
  </div>
</template>
