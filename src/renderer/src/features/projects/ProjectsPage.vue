<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Archive, ArchiveRestore, Plus, Search, Star, Trash2 } from '@lucide/vue'
import type { Project } from '@shared/types/domain'
import { formatDurationSpaced } from '@shared/utils/duration'
import { useProjectsStore } from '../../stores/projects'
import { useUiStore } from '../../stores/ui'
import ProjectFormModal from './ProjectFormModal.vue'

const router = useRouter()
const projectsStore = useProjectsStore()
const uiStore = useUiStore()

const search = ref('')
const statusFilter = ref<'active' | 'archived' | 'favorites'>('active')
const editingProject = ref<Project | null>(null)
const projectStats = ref<Record<string, { today: number; week: number }>>({})

onMounted(async () => {
  projectsStore.includeArchived = true
  await projectsStore.load()
  await loadStats()
})

async function loadStats(): Promise<void> {
  const entries = await Promise.all(
    projectsStore.projects.map(async (p) => {
      const stats = await window.desktop.projects.getStats(p.id)
      return [p.id, { today: stats.today.durationSeconds, week: stats.week.durationSeconds }] as const
    })
  )
  projectStats.value = Object.fromEntries(entries)
}

watch(() => uiStore.dataVersion, loadStats)

const filteredProjects = computed(() => {
  let list = projectsStore.projects
  if (statusFilter.value === 'active') list = list.filter((p) => !p.isArchived)
  else if (statusFilter.value === 'archived') list = list.filter((p) => p.isArchived)
  else if (statusFilter.value === 'favorites') list = list.filter((p) => p.isFavorite && !p.isArchived)

  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q))

  return [...list].sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite) || a.name.localeCompare(b.name))
})

async function toggleFavorite(project: Project): Promise<void> {
  await projectsStore.setFavorite(project.id, !project.isFavorite)
}

async function archiveOrRestore(project: Project): Promise<void> {
  if (project.isArchived) await projectsStore.restore(project.id)
  else await projectsStore.archive(project.id)
}

async function remove(project: Project): Promise<void> {
  const stats = projectStats.value[project.id]
  const hasHistory = (stats?.week ?? 0) > 0
  const message = hasHistory
    ? `"${project.name}" has tracked time. This will permanently delete it and all its time entries. Continue?`
    : `Delete "${project.name}"? This cannot be undone.`
  if (!window.confirm(message)) return
  await projectsStore.remove(project.id)
}

function openProject(id: string): void {
  router.push({ name: 'project-detail', params: { id } })
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5 p-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Projects</h1>
      <button class="btn btn-primary btn-sm gap-1.5" @click="uiStore.newProjectOpen = true">
        <Plus :size="15" /> New project
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <div class="relative flex-1 min-w-[200px] max-w-xs">
        <Search :size="14" class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input v-model="search" placeholder="Search projects…" class="input input-bordered input-sm w-full pl-8" />
      </div>
      <div class="flex rounded-lg border border-base-300 p-0.5 text-xs">
        <button
          v-for="opt in (['active', 'favorites', 'archived'] as const)"
          :key="opt"
          class="rounded-md px-2.5 py-1 capitalize"
          :class="statusFilter === opt ? 'bg-primary/15 text-primary' : ''"
          @click="statusFilter = opt"
        >
          {{ opt }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="project in filteredProjects"
        :key="project.id"
        class="group cursor-pointer rounded-xl border border-base-300 bg-base-200/40 p-4 hover:border-primary/40"
        @click="openProject(project.id)"
      >
        <div class="flex items-start justify-between">
          <div class="flex min-w-0 items-center gap-2">
            <span class="h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: project.color }" />
            <h3 class="truncate font-medium">{{ project.name }}</h3>
          </div>
          <button class="btn btn-ghost btn-xs btn-square" @click.stop="toggleFavorite(project)">
            <Star :size="14" :fill="project.isFavorite ? 'currentColor' : 'none'" :class="project.isFavorite ? 'text-warning' : 'text-base-content/40'" />
          </button>
        </div>
        <p v-if="project.description" class="mt-1 truncate text-xs text-base-content/50">{{ project.description }}</p>

        <div class="mt-3 flex items-center gap-4 text-xs text-base-content/60">
          <span>Today: <span class="font-medium text-base-content">{{ formatDurationSpaced(projectStats[project.id]?.today ?? 0) }}</span></span>
          <span>Week: <span class="font-medium text-base-content">{{ formatDurationSpaced(projectStats[project.id]?.week ?? 0) }}</span></span>
        </div>

        <div
          v-if="project.weeklyTargetMinutes"
          class="mt-2"
        >
          <progress
            class="progress progress-primary w-full"
            :value="projectStats[project.id]?.week ?? 0"
            :max="project.weeklyTargetMinutes * 60"
          />
        </div>

        <div class="mt-3 hidden items-center gap-1 group-hover:flex">
          <button class="btn btn-ghost btn-xs" @click.stop="editingProject = project">Edit</button>
          <button class="btn btn-ghost btn-xs gap-1" @click.stop="archiveOrRestore(project)">
            <ArchiveRestore v-if="project.isArchived" :size="12" />
            <Archive v-else :size="12" />
            {{ project.isArchived ? 'Restore' : 'Archive' }}
          </button>
          <button class="btn btn-ghost btn-xs text-error" @click.stop="remove(project)">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>

      <div v-if="filteredProjects.length === 0" class="col-span-full py-16 text-center text-sm text-base-content/40">
        No projects found
      </div>
    </div>

    <ProjectFormModal v-if="uiStore.newProjectOpen" @close="uiStore.newProjectOpen = false; loadStats()" />
    <ProjectFormModal
      v-if="editingProject"
      :project="editingProject"
      @close="editingProject = null; loadStats()"
    />
  </div>
</template>
