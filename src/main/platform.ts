import { app } from 'electron'

export const is = {
  get dev(): boolean {
    return !app.isPackaged
  }
}

export const platform = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
}
