import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Project, ProjectInput, ProjectUpdate } from '@shared/types/domain'
import { useSettingsStore } from './settings'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const includeArchived = ref(false)
  const loaded = ref(false)

  async function load(): Promise<void> {
    projects.value = await window.desktop.projects.list(includeArchived.value)
    loaded.value = true
  }

  const settingsStore = useSettingsStore()
  const currentProjectId = computed(() => settingsStore.settings?.currentProjectId ?? null)
  const currentProject = computed(
    () => projects.value.find((p) => p.id === currentProjectId.value) ?? null
  )
  const activeProjects = computed(() => projects.value.filter((p) => !p.isArchived))
  const favoriteProjects = computed(() => activeProjects.value.filter((p) => p.isFavorite))

  async function create(input: ProjectInput): Promise<Project> {
    const project = await window.desktop.projects.create(input)
    projects.value.push(project)
    return project
  }

  async function update(id: string, patch: ProjectUpdate): Promise<void> {
    const updated = await window.desktop.projects.update(id, patch)
    replace(updated)
  }

  async function archive(id: string): Promise<void> {
    const updated = await window.desktop.projects.archive(id)
    replace(updated)
  }

  async function restore(id: string): Promise<void> {
    const updated = await window.desktop.projects.restore(id)
    replace(updated)
  }

  async function remove(id: string): Promise<void> {
    await window.desktop.projects.delete(id)
    projects.value = projects.value.filter((p) => p.id !== id)
  }

  async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
    const updated = await window.desktop.projects.setFavorite(id, isFavorite)
    replace(updated)
  }

  async function setCurrent(id: string): Promise<void> {
    await window.desktop.projects.setCurrent(id)
    await settingsStore.load()
  }

  function replace(project: Project): void {
    const index = projects.value.findIndex((p) => p.id === project.id)
    if (index >= 0) projects.value.splice(index, 1, project)
    else projects.value.push(project)
  }

  function byId(id: string | null): Project | null {
    if (!id) return null
    return projects.value.find((p) => p.id === id) ?? null
  }

  return {
    projects,
    includeArchived,
    loaded,
    load,
    currentProjectId,
    currentProject,
    activeProjects,
    favoriteProjects,
    create,
    update,
    archive,
    restore,
    remove,
    setFavorite,
    setCurrent,
    byId
  }
})
