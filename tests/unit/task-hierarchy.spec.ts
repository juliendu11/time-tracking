import { beforeEach, describe, expect, it } from 'vitest'
import { setupTestEnvironment, type TestEnvironment } from '../helpers/setupDb'

describe('task hierarchy', () => {
  let env: TestEnvironment
  let projectId: string

  beforeEach(() => {
    env = setupTestEnvironment()
    projectId = env.projects.create({ name: 'Website' }).id
  })

  function task(name: string, parentTaskId: string | null = null): string {
    return env.tasks.create({ projectId, name, parentTaskId }).id
  }

  it('supports several children and unlimited depth', () => {
    const root = task('Release')
    const a = task('Backend', root)
    const b = task('Frontend', root)
    const deep = task('Endpoint tests', a)
    const deeper = task('Fixtures', deep)

    expect(env.tasks.findById(a)?.parentTaskId).toBe(root)
    expect(env.tasks.findById(b)?.parentTaskId).toBe(root)
    expect(env.tasks.findById(deeper)?.parentTaskId).toBe(deep)
    expect(env.tasks.findById(root)?.parentTaskId).toBeNull()
  })

  it('refuses to complete a parent until every child is done, at any depth', () => {
    const root = task('Release')
    const child = task('Backend', root)
    const grandchild = task('Tests', child)

    expect(() => env.tasks.update(root, { status: 'done' })).toThrow(/subtasks/)
    expect(() => env.tasks.update(child, { status: 'done' })).toThrow(/subtasks/)

    env.tasks.update(grandchild, { status: 'done' })
    expect(() => env.tasks.update(root, { status: 'done' })).toThrow(/subtasks/)
    env.tasks.update(child, { status: 'done' })
    const done = env.tasks.update(root, { status: 'done' })

    expect(done.status).toBe('done')
    expect(done.completedAt).not.toBeNull()
  })

  it('does not let archived children block their parent', () => {
    const root = task('Release')
    const child = task('Dropped idea', root)
    env.tasks.archive(child)

    expect(env.tasks.update(root, { status: 'done' }).status).toBe('done')
  })

  it('reopens done ancestors when a descendant is reopened or added', () => {
    const root = task('Release')
    const child = task('Backend', root)
    const grandchild = task('Tests', child)
    env.tasks.update(grandchild, { status: 'done' })
    env.tasks.update(child, { status: 'done' })
    env.tasks.update(root, { status: 'done' })

    env.tasks.update(grandchild, { status: 'todo' })
    expect(env.tasks.findById(child)?.status).toBe('todo')
    expect(env.tasks.findById(root)?.status).toBe('todo')
    expect(env.tasks.findById(root)?.completedAt).toBeNull()

    env.tasks.update(grandchild, { status: 'done' })
    env.tasks.update(child, { status: 'done' })
    env.tasks.update(root, { status: 'done' })
    task('Late addition', root)
    expect(env.tasks.findById(root)?.status).toBe('todo')
  })

  it('reopens the new parent when an open task is moved under a done one', () => {
    const done = task('Shipped')
    env.tasks.update(done, { status: 'done' })
    const open = task('Follow-up')

    env.tasks.update(open, { parentTaskId: done })

    expect(env.tasks.findById(done)?.status).toBe('todo')
  })

  it('rejects cycles and self-parenting', () => {
    const root = task('Release')
    const child = task('Backend', root)
    const grandchild = task('Tests', child)

    expect(() => env.tasks.update(root, { parentTaskId: root })).toThrow(/itself/)
    expect(() => env.tasks.update(root, { parentTaskId: grandchild })).toThrow(/itself/)
    expect(env.tasks.findById(root)?.parentTaskId).toBeNull()
  })

  it('rejects a parent from another project', () => {
    const other = env.projects.create({ name: 'Other' })
    const foreign = env.tasks.create({ projectId: other.id, name: 'Foreign' })

    expect(() => task('Local', foreign.id)).toThrow(/same project/)
  })

  it('detaches a task from its parent when moved to another project', () => {
    const other = env.projects.create({ name: 'Other' })
    const root = task('Release')
    const child = task('Backend', root)

    const moved = env.tasks.update(child, { projectId: other.id })

    expect(moved.parentTaskId).toBeNull()
    expect(() => env.tasks.update(root, { projectId: other.id })).not.toThrow()
  })

  it('refuses to move a task with subtasks to another project', () => {
    const other = env.projects.create({ name: 'Other' })
    const root = task('Release')
    task('Backend', root)

    expect(() => env.tasks.update(root, { projectId: other.id })).toThrow(/subtasks/)
  })

  it('promotes children to top-level tasks when their parent is deleted', () => {
    const root = task('Release')
    const child = task('Backend', root)

    env.tasks.delete(root)

    expect(env.tasks.findById(child)?.parentTaskId).toBeNull()
  })
})
