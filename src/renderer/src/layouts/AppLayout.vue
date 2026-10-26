<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ChartColumn,
  ChevronDown,
  Clock,
  FolderKanban,
  LayoutDashboard,
  Pause,
  Play,
  Plus,
  Search,
  Settings as SettingsIcon,
  Square,
  Table2,
  Timer,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen
} from '@lucide/vue'
import { formatDurationClock, formatDurationSpaced } from '@shared/utils/duration'
import { useProjectsStore } from '../stores/projects'
import { useTagsStore } from '../stores/tags'
import { useTimerStore } from '../stores/timer'
import { useUiStore } from '../stores/ui'
import CommandPalette from '../features/command-palette/CommandPalette.vue'
import IdlePromptModal from '../features/timer/IdlePromptModal.vue'
import ManualEntryModal from '../features/timer/ManualEntryModal.vue'
import ToastContainer from '../components/ToastContainer.vue'
import ProjectFormModal from '../features/projects/ProjectFormModal.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'

const route = useRoute()
const router = useRouter()
const projectsStore = useProjectsStore()
const tagsStore = useTagsStore()
const timerStore = useTimerStore()
const uiStore = useUiStore()
const { t, te } = useI18n()

const showProjectSwitcher = ref(false)
const todaySeconds = ref(0)

onMounted(async () => {
  await Promise.all([projectsStore.load(), tagsStore.load()])
  await refreshTodayForCurrentProject()

  window.addEventListener('keydown', onKeydown)
})

async function refreshTodayForCurrentProject(): Promise<void> {
  if (!projectsStore.currentProjectId) return
  const stats = await window.desktop.projects.getStats(projectsStore.currentProjectId)
  todaySeconds.value = stats.today.durationSeconds
}

function onKeydown(event: KeyboardEvent): void {
  const isMod = event.metaKey || event.ctrlKey
  if (isMod && (event.key === 'k' || event.key === 'p')) {
    event.preventDefault()
    uiStore.openCommandPalette()
  }
  if (event.key === 'Escape') {
    uiStore.closeCommandPalette()
  }
}

const navItems = [
  { name: 'dashboard', icon: LayoutDashboard },
  { name: 'timers', icon: Timer },
  { name: 'timeline', icon: Clock },
  { name: 'calendar', icon: CalendarDays },
  { name: 'timesheet', icon: Table2 },
  { name: 'reports', icon: ChartColumn }
] as const

const pageTitle = computed(() => {
  const name = String(route.name ?? '')
  return te(`routes.${name}`) ? t(`routes.${name}`) : name
})

async function selectProject(id: string): Promise<void> {
  await projectsStore.setCurrent(id)
  showProjectSwitcher.value = false
  await refreshTodayForCurrentProject()
}

async function startFreeTimer(): Promise<void> {
  if (!projectsStore.currentProjectId) {
    uiStore.newProjectOpen = true
    return
  }
  await timerStore.start({ projectId: projectsStore.currentProjectId })
}

async function stopTimer(timerId: string): Promise<void> {
  const entry = await timerStore.stop(timerId)
  if (entry) {
    uiStore.pushToast({ message: t('timer.saved', { duration: formatDurationSpaced(entry.durationSeconds) }), timeoutMs: 4000 })
  }
  await refreshTodayForCurrentProject()
}

async function goToProject(id: string): Promise<void> {
  await projectsStore.setCurrent(id)
  await refreshTodayForCurrentProject()
  await router.push({ name: 'project-detail', params: { id } })
}

const hasProjects = computed(() => projectsStore.activeProjects.length > 0)
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-base-100 text-base-content">
    <aside
      class="flex flex-col border-r border-base-300 bg-base-200/60 transition-all"
      :class="uiStore.sidebarCollapsed ? 'w-[68px]' : 'w-[264px]'"
    >
      <div class="flex items-center justify-between px-3 py-4">
        <div v-if="!uiStore.sidebarCollapsed" class="flex items-center gap-2 px-1">
          <div class="h-6 w-6 rounded-md bg-primary" />
          <span class="text-sm font-semibold tracking-tight">TimeTracker</span>
        </div>
        <button class="btn btn-ghost btn-xs btn-square" @click="uiStore.toggleSidebar()">
          <PanelLeftClose v-if="!uiStore.sidebarCollapsed" :size="16" />
          <PanelLeftOpen v-else :size="16" />
        </button>
      </div>

      <!-- Current project -->
      <div class="px-3 pb-3">
        <p v-if="!uiStore.sidebarCollapsed" class="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
          {{ t('layout.currentProject') }}
        </p>
        <div class="relative">
          <button
            class="flex w-full items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-2.5 py-2 text-left hover:bg-base-300/40"
            @click="showProjectSwitcher = !showProjectSwitcher"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: projectsStore.currentProject?.color ?? '#888' }"
            />
            <span v-if="!uiStore.sidebarCollapsed" class="flex-1 truncate">
              <span class="block truncate text-sm font-medium">
                {{ projectsStore.currentProject?.name ?? t('layout.noProject') }}
              </span>
              <span class="block text-[11px] text-base-content/50">
                {{ t('layout.today', { duration: formatDurationSpaced(todaySeconds) }) }}
              </span>
            </span>
            <ChevronDown v-if="!uiStore.sidebarCollapsed" :size="14" class="text-base-content/40" />
          </button>

          <div
            v-if="showProjectSwitcher"
            class="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-base-300 bg-base-100 p-1 shadow-xl"
          >
            <button
              v-for="project in projectsStore.activeProjects"
              :key="project.id"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-base-300/50"
              @click="selectProject(project.id)"
            >
              <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: project.color }" />
              <span class="truncate">{{ project.name }}</span>
            </button>
            <button
              class="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-base-300/50"
              @click="showProjectSwitcher = false; uiStore.newProjectOpen = true"
            >
              <Plus :size="14" /> {{ t('projects.new') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Active timers / start button -->
      <div class="px-3 pb-3">
        <p
          v-if="timerStore.isRunning && !uiStore.sidebarCollapsed"
          class="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-primary"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-primary tt-pulse" />
          {{ t('layout.activeTimers', timerStore.snapshots.length) }}
        </p>
        <div v-if="timerStore.isRunning" class="mt-2 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          <div
            v-for="snapshot in timerStore.snapshots"
            :key="snapshot.timer.id"
            class="rounded-lg border border-base-300 border-l-[3px] bg-base-100 p-3 shadow-sm"
            :class="snapshot.isPaused ? 'opacity-65' : ''"
            :style="{ borderLeftColor: snapshot.project.color }"
            :title="uiStore.sidebarCollapsed ? `${snapshot.project.name} — ${snapshot.task?.name ?? t('common.noTask')}` : undefined"
          >
            <template v-if="!uiStore.sidebarCollapsed">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: snapshot.project.color }" />
                <p class="truncate text-sm font-medium">{{ snapshot.project.name }}</p>
              </div>
              <p class="mt-0.5 truncate pl-4 text-xs text-base-content/60">
                {{ snapshot.task?.name ?? t('common.noTask') }}
              </p>
              <p class="mt-1 font-mono text-lg font-semibold tabular-nums">
                {{ formatDurationClock(timerStore.elapsedSeconds(snapshot.timer.id)) }}
              </p>
              <div class="mt-2 flex gap-1.5">
                <button
                  class="btn btn-xs flex-1"
                  @click="snapshot.isPaused ? timerStore.resume(snapshot.timer.id) : timerStore.pause(snapshot.timer.id)"
                >
                  <Pause v-if="!snapshot.isPaused" :size="12" />
                  <Play v-else :size="12" />
                  {{ snapshot.isPaused ? t('timer.resume') : t('timer.pause') }}
                </button>
                <button class="btn btn-xs btn-error flex-1" @click="stopTimer(snapshot.timer.id)">
                  <Square :size="12" /> {{ t('timer.stop') }}
                </button>
              </div>
            </template>
            <button v-else class="btn btn-xs btn-error btn-square" @click="stopTimer(snapshot.timer.id)">
              <Square :size="12" />
            </button>
          </div>
        </div>
        <button class="btn btn-primary btn-sm mt-2 w-full gap-1.5" @click="startFreeTimer">
          <Play :size="14" />
          <span v-if="!uiStore.sidebarCollapsed">{{ timerStore.isRunning ? t('timer.startAnother') : t('timer.start') }}</span>
        </button>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto px-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
          :class="
            route.name === item.name
              ? 'bg-primary/15 text-primary'
              : 'text-base-content/70 hover:bg-base-300/40 hover:text-base-content'
          "
        >
          <component :is="item.icon" :size="17" />
          <span v-if="!uiStore.sidebarCollapsed">{{ t(`routes.${item.name}`) }}</span>
        </RouterLink>

        <div class="pt-3">
          <div class="flex items-center justify-between px-2.5">
            <p v-if="!uiStore.sidebarCollapsed" class="text-[11px] font-semibold uppercase tracking-wider text-base-content/50">
              {{ t('routes.projects') }}
            </p>
            <button class="btn btn-ghost btn-xs btn-square" @click="uiStore.newProjectOpen = true">
              <Plus :size="13" />
            </button>
          </div>
          <RouterLink
            :to="{ name: 'projects' }"
            class="mt-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
            :class="
              route.name === 'projects'
                ? 'bg-primary/15 text-primary'
                : 'text-base-content/70 hover:bg-base-300/40 hover:text-base-content'
            "
          >
            <FolderKanban :size="17" />
            <span v-if="!uiStore.sidebarCollapsed">{{ t('layout.allProjects') }}</span>
          </RouterLink>
          <button
            v-for="project in projectsStore.activeProjects.slice(0, 8)"
            :key="project.id"
            class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-base-content/70 hover:bg-base-300/40 hover:text-base-content"
            @click="goToProject(project.id)"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: project.color }" />
            <span v-if="!uiStore.sidebarCollapsed" class="truncate">{{ project.name }}</span>
          </button>
          <p v-if="!hasProjects && !uiStore.sidebarCollapsed" class="px-2.5 py-1 text-xs text-base-content/40">
            {{ t('layout.noProjectsYet') }}
          </p>
        </div>
      </nav>

      <div class="border-t border-base-300 px-2 py-2">
        <RouterLink
          :to="{ name: 'settings' }"
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors"
          :class="
            route.name === 'settings'
              ? 'bg-primary/15 text-primary'
              : 'text-base-content/70 hover:bg-base-300/40 hover:text-base-content'
          "
        >
          <SettingsIcon :size="17" />
          <span v-if="!uiStore.sidebarCollapsed">{{ t('routes.settings') }}</span>
        </RouterLink>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-between border-b border-base-300 px-6 py-3">
        <h1 class="text-lg font-semibold">{{ pageTitle }}</h1>
        <div class="flex items-center gap-2">
          <button class="btn btn-ghost btn-sm gap-1.5" @click="uiStore.manualEntryOpen = true">
            <Plus :size="15" /> {{ t('layout.addTime') }}
          </button>
          <button class="btn btn-ghost btn-sm gap-1.5" @click="uiStore.openCommandPalette()">
            <Search :size="15" />
            <span class="text-base-content/50">⌘K</span>
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      <main class="min-w-0 flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>

    <CommandPalette />
    <IdlePromptModal />
    <ManualEntryModal v-if="uiStore.manualEntryOpen" @close="uiStore.manualEntryOpen = false" />
    <ProjectFormModal v-if="uiStore.newProjectOpen" @close="uiStore.newProjectOpen = false" />
    <ToastContainer />
  </div>
</template>
