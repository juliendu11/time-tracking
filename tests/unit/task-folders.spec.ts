import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestEnvironment, type TestEnvironment } from '../helpers/setupDb'

describe('task folders', () => {
  let env: TestEnvironment

  beforeEach(() => {
    env = setupTestEnvironment()
  })

  it('creates project folders and assigns tasks to them', () => {
    const project = env.projects.create({ name: 'Website' })
    const folder = env.taskFolders.create({ projectId: project.id, name: 'Backlog' })
    const task = env.tasks.create({
      projectId: project.id,
      folderId: folder.id,
      name: 'Improve navigation'
    })

    expect(env.taskFolders.listByProject(project.id)).toEqual([folder])
    expect(task.folderId).toBe(folder.id)
    expect(env.tasks.findById(task.id)?.folderId).toBe(folder.id)
  })

  it('moves tasks to no folder when their folder is deleted', () => {
    const project = env.projects.create({ name: 'Website' })
    const folder = env.taskFolders.create({ projectId: project.id, name: 'In progress' })
    const task = env.tasks.create({ projectId: project.id, folderId: folder.id, name: 'Header' })

    env.taskFolders.delete(folder.id)

    expect(env.tasks.findById(task.id)?.folderId).toBeNull()
  })

  it('rejects folders from another project and duplicate folder names', () => {
    const firstProject = env.projects.create({ name: 'Website' })
    const secondProject = env.projects.create({ name: 'Mobile app' })
    const folder = env.taskFolders.create({ projectId: firstProject.id, name: 'Backlog' })

    expect(() =>
      env.tasks.create({ projectId: secondProject.id, folderId: folder.id, name: 'Invalid task' })
    ).toThrow('does not belong')
    expect(() =>
      env.taskFolders.create({ projectId: firstProject.id, name: 'backlog' })
    ).toThrow('already exists')
  })

  it('renames folders', () => {
    const project = env.projects.create({ name: 'Website' })
    const folder = env.taskFolders.create({ projectId: project.id, name: 'Backlog' })

    const renamed = env.taskFolders.update(folder.id, { name: 'Next up' })

    expect(renamed.name).toBe('Next up')
  })
})
