import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Tag } from '@shared/types/domain'

export const useTagsStore = defineStore('tags', () => {
  const tags = ref<Tag[]>([])

  async function load(): Promise<void> {
    tags.value = await window.desktop.tags.list()
  }

  async function create(name: string, color?: string): Promise<Tag> {
    const tag = await window.desktop.tags.create({ name, color })
    tags.value.push(tag)
    return tag
  }

  async function remove(id: string): Promise<void> {
    await window.desktop.tags.delete(id)
    tags.value = tags.value.filter((t) => t.id !== id)
  }

  return { tags, load, create, remove }
})
