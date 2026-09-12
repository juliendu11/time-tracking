import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `__dirname` equivalent for ESM output (electron-vite builds main/preload as ESM). */
export const moduleDir = dirname(fileURLToPath(import.meta.url))
