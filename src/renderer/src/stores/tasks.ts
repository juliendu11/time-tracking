import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Task, TaskInput, TaskUpdate } from '@shared/types/domain'

export const useTasksStore = defineStore('tasks', () => {
  const tasksByProject = ref<Record<string, Task[]>>({})

  async function loadForProject(projectId: string, includeArchived = false): Promise<Task[]> {
    const tasks = await window.desktop.tasks.listByProject(projectId, includeArchived)
    tasksByProject.value = { ...tasksByProject.value, [projectId]: tasks }
    return tasks
  }

  async function create(input: TaskInput): Promise<Task> {
    const task = await window.desktop.tasks.create(input)
    if (input.parentTaskId) {
      // Adding an open subtask may reopen done ancestors in the main process.
      await loadForProject(input.projectId, true)
      return task
    }
    const list = tasksByProject.value[input.projectId] ?? []
    tasksByProject.value = { ...tasksByProject.value, [input.projectId]: [...list, task] }
    return task
  }

  async function update(id: string, projectId: string, patch: TaskUpdate): Promise<void> {
    const updated = await window.desktop.tasks.update(id, patch)
    if (patch.status !== undefined || patch.parentTaskId !== undefined) {
      // Status and parent changes may reopen done ancestors in the main process.
      await loadForProject(projectId, true)
      return
    }
    const list = tasksByProject.value[projectId] ?? []
    const index = list.findIndex((t) => t.id === id)
    if (index >= 0) {
      const next = [...list]
      next.splice(index, 1, updated)
      tasksByProject.value = { ...tasksByProject.value, [projectId]: next }
    }
  }

  async function archive(id: string, projectId: string): Promise<void> {
    await update(id, projectId, { status: 'archived' })
  }

  async function remove(id: string, projectId: string): Promise<void> {
    await window.desktop.tasks.delete(id)
    // Subtasks of the deleted task are promoted to top-level tasks.
    const list = (tasksByProject.value[projectId] ?? [])
      .filter((t) => t.id !== id)
      .map((t) => (t.parentTaskId === id ? { ...t, parentTaskId: null } : t))
    tasksByProject.value = { ...tasksByProject.value, [projectId]: list }
  }

  function tasksFor(projectId: string): Task[] {
    return tasksByProject.value[projectId] ?? []
  }

  return { tasksByProject, loadForProject, create, update, archive, remove, tasksFor }
})
