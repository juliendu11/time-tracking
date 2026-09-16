<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChartColumn,
  Clock,
  FolderKanban,
  LayoutDashboard,
  Moon,
  Plus,
  Settings as SettingsIcon,
  Square,
  Sun,
  Table2,
  Timer,
  type LucideIcon
} from '@lucide/vue'
import type { SearchResultItem, SmartSuggestion } from '@shared/types/domain'
import { useProjectsStore } from '../../stores/projects'
import { useSettingsStore } from '../../stores/settings'
import { useTimerStore } from '../../stores/timer'
import { useUiStore } from '../../stores/ui'

interface PaletteItem {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  run: () => void | Promise<void>
}

const router = useRouter()
const uiStore = useUiStore()
const projectsStore = useProjectsStore()
const timerStore = useTimerStore()
const settingsStore = useSettingsStore()

const query = ref('')
const activeIndex = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)
const suggestions = ref<SmartSuggestion[]>([])
const searchResults = ref<SearchResultItem[]>([])

watch(
  () => uiStore.commandPaletteOpen,
  async (open) => {
    if (!open) {
      query.value = ''
      searchResults.value = []
      return
    }
    activeIndex.value = 0
    suggestions.value = await window.desktop.suggestions.get(projectsStore.currentProjectId, 5)
    await nextTick()
    inputRef.value?.focus()
  }
)

let searchTimeout: number | undefined
watch(query, (value) => {
  activeIndex.value = 0
  window.clearTimeout(searchTimeout)
  if (!value.trim()) {
    searchResults.value = []
    return
  }
  searchTimeout = window.setTimeout(async () => {
    searchResults.value = await window.desktop.search.query(value)
  }, 120)
})

function close(): void {
  uiStore.closeCommandPalette()
}

async function goTo(name: string): Promise<void> {
  await router.push({ name })
  close()
}

const staticActions = computed<PaletteItem[]>(() => {
  const items: Array<PaletteItem | null> = [
  { id: 'nav-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, run: () => goTo('dashboard') },
  { id: 'nav-timers', label: 'Go to Timers', icon: Timer, run: () => goTo('timers') },
  { id: 'nav-timeline', label: 'Go to Timeline', icon: Clock, run: () => goTo('timeline') },
  { id: 'nav-timesheet', label: 'Go to Timesheet', icon: Table2, run: () => goTo('timesheet') },
  { id: 'nav-reports', label: 'Go to Reports', icon: ChartColumn, run: () => goTo('reports') },
  { id: 'nav-projects', label: 'Go to Projects', icon: FolderKanban, run: () => goTo('projects') },
  { id: 'nav-settings', label: 'Go to Settings', icon: SettingsIcon, run: () => goTo('settings') },
  {
    id: 'create-project',
    label: 'Create project',
    icon: Plus,
    run: () => {
      uiStore.newProjectOpen = true
      close()
    }
  },
  {
    id: 'add-time',
    label: 'Add manual time',
    icon: Plus,
    run: () => {
      uiStore.manualEntryOpen = true
      close()
    }
  },
  timerStore.isRunning
    ? {
        id: 'stop-timer',
        label: `Stop all timers (${timerStore.snapshots.length})`,
        icon: Square,
        run: async () => {
          await Promise.all(timerStore.snapshots.map((snapshot) => timerStore.stop(snapshot.timer.id)))
          close()
        }
      }
    : null,
    {
      id: 'toggle-theme',
      label: 'Toggle theme',
      icon: settingsStore.effectiveTheme === 'dark' ? Sun : Moon,
      run: async () => {
        const next = settingsStore.effectiveTheme === 'dark' ? 'light' : 'dark'
        await settingsStore.update({ theme: next })
        close()
      }
    }
  ]
  return items.filter((item): item is PaletteItem => item !== null)
})

const filteredStaticActions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return staticActions.value
  return staticActions.value.filter((item) => item.label.toLowerCase().includes(q))
})

const suggestionItems = computed<PaletteItem[]>(() =>
  suggestions.value.map((s) => ({
    id: `sugg-${s.projectId}-${s.taskId ?? 'none'}`,
    label: s.taskId ? `${s.projectName} / ${s.taskName}` : s.projectName,
    hint: 'Start',
    icon: FolderKanban,
    run: async () => {
      await timerStore.start({ projectId: s.projectId, taskId: s.taskId })
      close()
    }
  }))
)

const searchItems = computed<PaletteItem[]>(() =>
  searchResults.value.map((r) => ({
    id: `search-${r.kind}-${r.id}`,
    label: r.title,
    hint: r.subtitle ?? r.kind,
    icon: FolderKanban,
    run: async () => {
      if (r.kind === 'project') {
        await projectsStore.setCurrent(r.id)
        await router.push({ name: 'project-detail', params: { id: r.id } })
      } else if (r.kind === 'task') {
        const task = await window.desktop.tasks.get(r.id)
        if (task) await timerStore.start({ projectId: task.projectId, taskId: task.id })
      }
      close()
    }
  }))
)

const items = computed<PaletteItem[]>(() => {
  if (query.value.trim()) return [...searchItems.value, ...filteredStaticActions.value]
  return [...suggestionItems.value, ...staticActions.value]
})

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, items.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    const item = items.value[activeIndex.value]
    item?.run()
  } else if (event.key === 'Escape') {
    close()
  }
}
</script>

<template>
  <div
    v-if="uiStore.commandPaletteOpen"
    class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
    @click.self="close"
  >
    <div class="w-full max-w-lg overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-2xl">
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Search projects, tasks, or type a command…"
        class="w-full border-b border-base-300 bg-transparent px-4 py-3 text-sm outline-none"
        @keydown="onKeydown"
      />
      <div class="max-h-80 overflow-y-auto p-1.5">
        <button
          v-for="(item, index) in items"
          :key="item.id"
          class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm"
          :class="index === activeIndex ? 'bg-primary/15 text-primary' : 'hover:bg-base-300/40'"
          @mouseenter="activeIndex = index"
          @click="item.run()"
        >
          <component :is="item.icon" :size="15" />
          <span class="flex-1 truncate">{{ item.label }}</span>
          <span v-if="item.hint" class="text-xs text-base-content/40">{{ item.hint }}</span>
        </button>
        <p v-if="items.length === 0" class="px-3 py-6 text-center text-sm text-base-content/40">
          No results
        </p>
      </div>
    </div>
  </div>
</template>
