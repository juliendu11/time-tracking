import { app } from 'electron'

export function applyLaunchAtStartup(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled })
}
