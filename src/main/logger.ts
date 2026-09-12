import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getLogsDir } from './paths'

type Level = 'info' | 'warn' | 'error' | 'debug'

const MAX_LOG_BYTES = 5 * 1024 * 1024 // 5MB before rotation

class Logger {
  private filePath: string | null = null

  private resolveFilePath(): string {
    if (this.filePath) return this.filePath
    const dir = getLogsDir()
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'app.log')
    return this.filePath
  }

  private rotateIfNeeded(path: string): void {
    if (!existsSync(path)) return
    if (statSync(path).size < MAX_LOG_BYTES) return
    const rotated = path.replace(/\.log$/, `.${Date.now()}.log`)
    renameSync(path, rotated)
  }

  private write(level: Level, message: string, meta?: unknown): void {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}${
      meta !== undefined ? ` ${safeStringify(meta)}` : ''
    }\n`

    // Console output is always available in dev tooling.
    if (level === 'error') console.error(line.trim())
    else if (level === 'warn') console.warn(line.trim())
    else console.log(line.trim())

    try {
      const path = this.resolveFilePath()
      this.rotateIfNeeded(path)
      appendFileSync(path, line)
    } catch {
      // Logging must never crash the app.
    }
  }

  info(message: string, meta?: unknown): void {
    this.write('info', message, meta)
  }

  warn(message: string, meta?: unknown): void {
    this.write('warn', message, meta)
  }

  error(message: string, meta?: unknown): void {
    this.write('error', message, meta)
  }

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV !== 'production') this.write('debug', message, meta)
  }
}

function safeStringify(value: unknown): string {
  try {
    if (value instanceof Error) return `${value.message}\n${value.stack ?? ''}`
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export const logger = new Logger()
