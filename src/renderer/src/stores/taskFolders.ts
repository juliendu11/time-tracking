import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { TaskFolder, TaskFolderInput, TaskFolderUpdate } from '@shared/types/domain'

export const useTaskFoldersStore = defineStore('taskFolders', () => {
  const foldersByProject = ref<Record<string, TaskFolder[]>>({})

  async function loadForProject(projectId: string): Promise<TaskFolder[]> {
    const folders = await window.desktop.taskFolders.listByProject(projectId)
    foldersByProject.value = { ...foldersByProject.value, [projectId]: folders }
    return folders
  }

  async function create(input: TaskFolderInput): Promise<TaskFolder> {
    const folder = await window.desktop.taskFolders.create(input)
    const list = foldersByProject.value[input.projectId] ?? []
    foldersByProject.value = {
      ...foldersByProject.value,
      [input.projectId]: [...list, folder].sort((a, b) => a.position - b.position)
    }
    return folder
  }

  async function update(id: string, projectId: string, patch: TaskFolderUpdate): Promise<void> {
    const updated = await window.desktop.taskFolders.update(id, patch)
    const list = foldersByProject.value[projectId] ?? []
    foldersByProject.value = {
      ...foldersByProject.value,
      [projectId]: list.map((folder) => (folder.id === id ? updated : folder))
    }
  }

  async function remove(id: string, projectId: string): Promise<void> {
    await window.desktop.taskFolders.delete(id)
    const list = foldersByProject.value[projectId] ?? []
    foldersByProject.value = {
      ...foldersByProject.value,
      [projectId]: list.filter((folder) => folder.id !== id)
    }
  }

  function foldersFor(projectId: string): TaskFolder[] {
    return foldersByProject.value[projectId] ?? []
  }

  return { foldersByProject, loadForProject, create, update, remove, foldersFor }
})
