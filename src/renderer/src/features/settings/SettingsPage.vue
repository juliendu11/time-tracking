<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {SUPPORTED_LANGUAGES, type AppSettingsUpdate, type BackupFileInfo, type Language} from '@shared/types/domain'
import {LANGUAGE_NAMES, weekdayName} from '../../i18n'
import {useProjectsStore} from '../../stores/projects'
import {useSettingsStore} from '../../stores/settings'
import {useUiStore} from '../../stores/ui'
import BaseCheckBox from "@renderer/components/BaseCheckBox.vue";

const settingsStore = useSettingsStore()
const projectsStore = useProjectsStore()
const uiStore = useUiStore()
const {t, locale} = useI18n()

type Tab = 'general' | 'appearance' | 'timer' | 'idle' | 'goals' | 'shortcuts' | 'backup' | 'advanced' | 'about'
const tab = ref<Tab>('general')

const tabs: Tab[] = ['general', 'appearance', 'timer', 'idle', 'goals', 'shortcuts', 'backup', 'advanced', 'about']

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
  uiStore.pushToast({message: t('settings.backup.created')})
}

async function restoreBackup(filePath: string): Promise<void> {
  if (!window.confirm(t('settings.backup.confirmRestore'))) {
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
  uiStore.pushToast({message: t('settings.backup.exported', {path})})
}

async function exportCsv(): Promise<void> {
  const path = await window.desktop.backup.exportCsv()
  uiStore.pushToast({message: t('settings.backup.exported', {path})})
}

async function openBackupFolder(): Promise<void> {
  await window.desktop.backup.openFolder()
}

async function openLogsFolder(): Promise<void> {
  await window.desktop.system.openLogsFolder()
}

async function resetAllData(): Promise<void> {
  if (
    !window.confirm(t('settings.backup.confirmReset'))
  ) {
    return
  }
  await window.desktop.backup.resetAllData()
}

async function sendTestNotification(): Promise<void> {
  const supported = await window.desktop.notifications.sendTest()
  uiStore.pushToast({
    message: supported ? t('settings.general.testSent') : t('settings.general.testUnsupported')
  })
}
</script>

<template>
  <div class="mx-auto flex max-w-4xl gap-8 p-6">
    <nav class="w-40 shrink-0 space-y-0.5">
      <button
        v-for="id in tabs"
        :key="id"
        class="block w-full rounded-lg px-3 py-1.5 text-left text-sm"
        :class="tab === id ? 'bg-primary/15 text-primary font-medium' : 'text-base-content/70 hover:bg-base-300/40'"
        @click="tab = id"
      >
        {{ t(`settings.tabs.${id}`) }}
      </button>
    </nav>

    <div v-if="settingsStore.settings" class="min-w-0 flex-1 space-y-4">
      <section v-if="tab === 'general'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.general') }}</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.general.defaultProject') }}</span></label>
          <select
            class="select select-bordered select-sm w-64 "
            :value="settingsStore.settings.defaultProjectId ?? ''"
            @change="set({ defaultProjectId: ($event.target as HTMLSelectElement).value || null })"
          >
            <option value="">{{ t('settings.general.none') }}</option>
            <option v-for="p in projectsStore.activeProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-5">
          <BaseCheckBox
            :label="t('settings.general.minimizeToTray')"
            :checked="settingsStore.settings.minimizeToTray"
            @change="set({ minimizeToTray: ($event.target as HTMLInputElement).checked })"
          />
          <BaseCheckBox
            :label="t('settings.general.launchAtStartup')"
            :checked="settingsStore.settings.launchAtStartup"
            @change="set({ launchAtStartup: ($event.target as HTMLInputElement).checked })"
          />
          <BaseCheckBox
            :label="t('settings.general.confirmDelete')"
            :checked="settingsStore.settings.confirmBeforeDeletingEntry"
            @change="set({ confirmBeforeDeletingEntry: ($event.target as HTMLInputElement).checked })"
          />
          <BaseCheckBox
            :label="t('settings.general.notifications')"
            :checked="settingsStore.settings.notificationsEnabled"
            @change="set({ notificationsEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </div>
        <button class="btn btn-sm" @click="sendTestNotification">{{ t('settings.general.sendTest') }}</button>
      </section>

      <section v-else-if="tab === 'appearance'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.appearance') }}</h2>
        <div class="form-control">
          <label class="label" for="settings-language"><span class="label-text">{{ t('settings.language.label') }}</span></label>
          <select
            id="settings-language"
            class="select select-bordered select-sm w-40"
            :value="settingsStore.settings.language"
            @change="set({ language: ($event.target as HTMLSelectElement).value as Language })"
          >
            <option v-for="language in SUPPORTED_LANGUAGES" :key="language" :value="language" :lang="language">
              {{ LANGUAGE_NAMES[language] }}
            </option>
          </select>
          <p class="mt-1 text-xs text-base-content/50">{{ t('settings.language.hint') }}</p>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.appearance.theme') }}</span></label>
          <div class="flex gap-2">
            <button
              v-for="opt in (['system', 'light', 'dark'] as const)"
              :key="opt"
              class="btn btn-sm"
              :class="settingsStore.settings.theme === opt ? 'btn-primary' : 'btn-ghost border border-base-300'"
              @click="set({ theme: opt })"
            >
              {{ t(`settings.appearance.themes.${opt}`) }}
            </button>
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.appearance.weekStartsOn') }}</span></label>
          <select
            class="select select-bordered select-sm w-40"
            :value="settingsStore.settings.weekStartsOn"
            @change="set({ weekStartsOn: Number(($event.target as HTMLSelectElement).value) as 0 | 1 })"
          >
            <option :value="1">{{ weekdayName(1, locale) }}</option>
            <option :value="0">{{ weekdayName(0, locale) }}</option>
          </select>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.appearance.timeFormat') }}</span></label>
          <select
            class="select select-bordered select-sm w-40"
            :value="settingsStore.settings.timeFormat"
            @change="set({ timeFormat: ($event.target as HTMLSelectElement).value as '24h' | '12h' })"
          >
            <option value="24h">{{ t('settings.appearance.hours24') }}</option>
            <option value="12h">{{ t('settings.appearance.hours12') }}</option>
          </select>
        </div>
      </section>

      <section v-else-if="tab === 'timer'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.timer') }}</h2>
        <div class="rounded-lg border border-base-300 bg-base-200/40 p-3">
          <p class="text-sm font-medium">{{ t('settings.timer.parallelTitle') }}</p>
          <p class="mt-1 text-xs text-base-content/60">
            {{ t('settings.timer.parallelBody') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-5">
          <BaseCheckBox
            :label="t('settings.timer.showMiniTimer')"
            :checked="settingsStore.settings.showMiniTimer"
            @change="set({ showMiniTimer: ($event.target as HTMLInputElement).checked })"
          />
          <BaseCheckBox
            :label="t('settings.timer.miniTimerOnTop')"
            :checked="settingsStore.settings.miniTimerAlwaysOnTop"
            @change="set({ miniTimerAlwaysOnTop: ($event.target as HTMLInputElement).checked })"
          />
        </div>

        <div class="divider" />
        <div class="grid grid-cols-2 gap-5">
          <BaseCheckBox
            :label="t('settings.timer.enablePomodoro')"
            :checked="settingsStore.settings.pomodoroEnabled"
            @change="set({ pomodoroEnabled: ($event.target as HTMLInputElement).checked })"
          />
        </div>
        <div v-if="settingsStore.settings.pomodoroEnabled" class="grid grid-cols-3 gap-3">
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">{{ t('settings.timer.focus') }}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.pomodoroFocusMinutes"
              @change="set({ pomodoroFocusMinutes: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">{{ t('settings.timer.break') }}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.pomodoroBreakMinutes"
              @change="set({ pomodoroBreakMinutes: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text text-xs">{{ t('settings.timer.longBreak') }}</span></label>
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
        <h2 class="text-base font-semibold">{{ t('settings.tabs.idle') }}</h2>
        <BaseCheckBox
          :label="t('settings.idle.detect')"
          :checked="settingsStore.settings.idleDetectionEnabled"
          @change="set({ idleDetectionEnabled: ($event.target as HTMLInputElement).checked })"
        />
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.idle.threshold') }}</span></label>
          <input
            type="number"
            min="1"
            class="input input-bordered input-sm w-32"
            :value="settingsStore.settings.idleThresholdMinutes"
            @change="set({ idleThresholdMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
        <p class="text-xs text-base-content/50">
          {{ t('settings.idle.hint') }}
        </p>
      </section>

      <section v-else-if="tab === 'goals'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.goals') }}</h2>
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">{{ t('settings.goals.daily') }}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.dailyGoalMinutes ?? ''"
              @change="set({ dailyGoalMinutes: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
            />
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">{{ t('settings.goals.weekly') }}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.weeklyGoalMinutes ?? ''"
              @change="set({ weeklyGoalMinutes: ($event.target as HTMLInputElement).value ? Number(($event.target as HTMLInputElement).value) : null })"
            />
          </div>
        </div>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.goals.streak') }}</span></label>
          <input
            type="number"
            class="input input-bordered input-sm w-40"
            :value="settingsStore.settings.streakThresholdMinutes"
            @change="set({ streakThresholdMinutes: Number(($event.target as HTMLInputElement).value) })"
          />
        </div>
      </section>

      <section v-else-if="tab === 'shortcuts'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.shortcuts') }}</h2>
        <div class="form-control">
          <label class="label"><span class="label-text">{{ t('settings.shortcuts.toggleTimer') }}</span></label>
          <input
            type="text"
            class="input input-bordered input-sm w-64"
            :value="settingsStore.settings.globalShortcutToggleTimer"
            @change="set({ globalShortcutToggleTimer: ($event.target as HTMLInputElement).value })"
          />
          <p class="mt-1 text-xs text-base-content/50">
            {{ t('settings.shortcuts.hint') }}
          </p>
        </div>
        <ul class="space-y-1 text-sm text-base-content/70">
          <li><kbd class="kbd kbd-sm">⌘/Ctrl</kbd> + <kbd class="kbd kbd-sm">K</kbd> — {{ t('settings.shortcuts.commandPalette') }}</li>
          <li><kbd class="kbd kbd-sm">⌘/Ctrl</kbd> + <kbd class="kbd kbd-sm">P</kbd> — {{ t('settings.shortcuts.quickSwitcher') }}</li>
          <li><kbd class="kbd kbd-sm">Esc</kbd> — {{ t('settings.shortcuts.closeOverlay') }}</li>
        </ul>
      </section>

      <section v-else-if="tab === 'backup'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.backup') }}</h2>
        <BaseCheckBox
          :label="t('settings.backup.auto')"
          :checked="settingsStore.settings.autoBackupEnabled"
          @change="set({ autoBackupEnabled: ($event.target as HTMLInputElement).checked })"
        />
        <div class="grid grid-cols-2 gap-4">
          <div class="form-control">
            <label class="label"><span class="label-text">{{ t('settings.backup.frequency') }}</span></label>
            <select
              class="select select-bordered select-sm"
              :value="settingsStore.settings.autoBackupFrequency"
              @change="set({ autoBackupFrequency: ($event.target as HTMLSelectElement).value as 'daily' | 'weekly' })"
            >
              <option value="daily">{{ t('settings.backup.daily') }}</option>
              <option value="weekly">{{ t('settings.backup.weekly') }}</option>
            </select>
          </div>
          <div class="form-control">
            <label class="label"><span class="label-text">{{ t('settings.backup.keep') }}</span></label>
            <input
              type="number"
              class="input input-bordered input-sm"
              :value="settingsStore.settings.autoBackupKeepCount"
              @change="set({ autoBackupKeepCount: Number(($event.target as HTMLInputElement).value) })"
            />
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button class="btn btn-sm" @click="createBackup">{{ t('settings.backup.createNow') }}</button>
          <button class="btn btn-sm" @click="openBackupFolder">{{ t('settings.backup.openFolder') }}</button>
          <button class="btn btn-sm" @click="pickAndRestore">{{ t('settings.backup.restoreFrom') }}</button>
          <button class="btn btn-sm" @click="exportJson">{{ t('settings.backup.exportJson') }}</button>
          <button class="btn btn-sm" @click="exportCsv">{{ t('settings.backup.exportCsv') }}</button>
        </div>

        <div v-if="backups.length > 0" class="rounded-lg border border-base-300">
          <div
            v-for="b in backups.slice(0, 8)"
            :key="b.filePath"
            class="flex items-center justify-between border-b border-base-300/60 px-3 py-2 text-sm last:border-0"
          >
            <span class="truncate">{{ b.fileName }}</span>
            <div class="flex items-center gap-2 text-xs text-base-content/50">
              <span>{{ new Date(b.createdAt).toLocaleString(locale) }}</span>
              <button class="link" @click="restoreBackup(b.filePath)">{{ t('settings.backup.restore') }}</button>
            </div>
          </div>
        </div>

        <div class="divider" />
        <div class="rounded-lg border border-error/40 bg-error/5 p-4 space-y-2">
          <h3 class="text-sm font-semibold text-error">{{ t('settings.backup.dangerZone') }}</h3>
          <p class="text-xs text-base-content/60">
            {{ t('settings.backup.resetBody') }}
          </p>
          <button class="btn btn-error btn-sm btn-outline" @click="resetAllData">
            {{ t('settings.backup.reset') }}
          </button>
        </div>
      </section>

      <section v-else-if="tab === 'advanced'" class="space-y-4">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.advanced') }}</h2>
        <button class="btn btn-sm" @click="openLogsFolder">{{ t('settings.advanced.openLogs') }}</button>
      </section>

      <section v-else-if="tab === 'about'" class="space-y-2">
        <h2 class="text-base font-semibold">{{ t('settings.tabs.about') }}</h2>
        <p class="text-sm text-base-content/70">{{ t('settings.about.version', { version: appVersion }) }}</p>
        <p class="text-sm text-base-content/70">{{ t('settings.about.platform', { platform }) }}</p>
        <p class="text-xs text-base-content/40">
          {{ t('settings.about.tagline') }}
        </p>
      </section>
    </div>
  </div>
</template>
