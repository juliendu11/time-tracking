import { join } from 'node:path'
import { app } from 'electron'
import { moduleDir } from './dirname'

/**
 * Resolves a file under the project's `resources/` folder in both dev
 * (unpacked, relative to the build output) and packaged builds (copied
 * next to the executable via electron-builder's extraResources).
 */
export function resourcePath(...segments: string[]): string {
  const base = app.isPackaged ? process.resourcesPath : join(moduleDir, '../..')
  return join(base, 'resources', ...segments)
}
