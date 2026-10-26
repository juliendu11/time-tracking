import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestEnvironment, type TestEnvironment } from '../helpers/setupDb'

describe('task folders', () => {
  let env: TestEnvironment

  beforeEach(() => {
    env = setupTestEnvironment()
  })

  it('creates project folders and assigns a task to multiple folders', () => {
    const project = env.projects.create({ name: 'Website' })
    const backlog = env.taskFolders.create({ projectId: project.id, name: 'Backlog' })
    const design = env.taskFolders.create({ projectId: project.id, name: 'Design' })
    const task = env.tasks.create({
      projectId: project.id,
      folderIds: [backlog.id, design.id, backlog.id],
      name: 'Improve navigation'
    })

    expect(env.taskFolders.listByProject(project.id)).toEqual([backlog, design])
    expect(task.folderIds).toEqual([backlog.id, design.id])
    expect(env.tasks.findById(task.id)?.folderIds).toEqual([backlog.id, design.id])
    expect(env.tasks.listByProject(project.id)[0]?.folderIds).toEqual([backlog.id, design.id])
  })

  it('moves tasks to no folder when their folder is deleted', () => {
    const project = env.projects.create({ name: 'Website' })
    const inProgress = env.taskFolders.create({ projectId: project.id, name: 'In progress' })
    const design = env.taskFolders.create({ projectId: project.id, name: 'Design' })
    const task = env.tasks.create({
      projectId: project.id,
      folderIds: [inProgress.id, design.id],
      name: 'Header'
    })

    env.taskFolders.delete(inProgress.id)

    expect(env.tasks.findById(task.id)?.folderIds).toEqual([design.id])
  })

  it('rejects folders from another project and duplicate folder names', () => {
    const firstProject = env.projects.create({ name: 'Website' })
    const secondProject = env.projects.create({ name: 'Mobile app' })
    const folder = env.taskFolders.create({ projectId: firstProject.id, name: 'Backlog' })

    expect(() =>
      env.tasks.create({ projectId: secondProject.id, folderIds: [folder.id], name: 'Invalid task' })
    ).toThrow('do not belong')
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

  it('replaces and clears a task folder selection', () => {
    const project = env.projects.create({ name: 'Website' })
    const backlog = env.taskFolders.create({ projectId: project.id, name: 'Backlog' })
    const design = env.taskFolders.create({ projectId: project.id, name: 'Design' })
    const task = env.tasks.create({ projectId: project.id, folderIds: [backlog.id], name: 'Header' })

    expect(env.tasks.update(task.id, { folderIds: [design.id] }).folderIds).toEqual([design.id])
    expect(env.tasks.update(task.id, { folderIds: [] }).folderIds).toEqual([])
  })
})
