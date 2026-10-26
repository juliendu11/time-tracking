import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { moduleDir } from '../dirname'
import { is } from '../platform'

let miniWindow: BrowserWindow | null = null

export function getMiniTimerWindow(): BrowserWindow | null {
  return miniWindow
}

export function toggleMiniTimerWindow(show: boolean, alwaysOnTop: boolean): void {
  if (!show) {
    miniWindow?.close()
    return
  }
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.setAlwaysOnTop(alwaysOnTop)
    miniWindow.show()
    return
  }

  const win = new BrowserWindow({
    width: 260,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    alwaysOnTop,
    skipTaskbar: true,
    backgroundColor: '#131417',
    webPreferences: {
      preload: join(moduleDir, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('closed', () => {
    miniWindow = null
  })

  const hash = '#/mini-timer'
  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash}`)
  } else {
    void win.loadFile(join(moduleDir, '../renderer/index.html'), { hash: '/mini-timer' })
  }

  miniWindow = win
}
