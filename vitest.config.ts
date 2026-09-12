import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

const rootDir = import.meta.dirname

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(rootDir, 'src/shared'),
      '@main': resolve(rootDir, 'src/main')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts']
  }
})
