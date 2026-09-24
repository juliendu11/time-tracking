import type { Language } from '@shared/types/domain'

/**
 * Strings the main process shows directly to the user (tray menu, desktop
 * notifications). The renderer has its own, much larger catalog under
 * src/renderer/src/i18n — these two never share keys.
 */
const en = {
  trayNoTask: 'No task',
  trayUnknownProject: 'Unknown',
  trayPause: 'Pause timer',
  trayResume: 'Resume timer',
  trayStop: 'Stop timer',
  trayNoTimer: 'No timer running',
  trayRecentTasks: 'Recent tasks',
  trayOpen: 'Open TimeTracker',
  trayQuit: 'Quit',
  trayTooltipActive: (count: number) => `TimeTracker — ${count} active timer${count === 1 ? '' : 's'}`,
  notifyTestTitle: 'Test notification',
  notifyTestBody: 'Notifications are working correctly.',
  notifyDailyGoalTitle: 'Daily goal reached 🎯',
  notifyDailyGoalBody: (duration: string) => `You've tracked ${duration} today.`,
  notifyLongSessionTitle: 'Still tracking',
  notifyLongSessionBody: (project: string, duration: string) =>
    `${project} has been running for ${duration}.`
}

type MainMessages = typeof en

const fr: MainMessages = {
  trayNoTask: 'Aucune tâche',
  trayUnknownProject: 'Inconnu',
  trayPause: 'Mettre en pause',
  trayResume: 'Reprendre',
  trayStop: 'Arrêter le chronomètre',
  trayNoTimer: 'Aucun chronomètre en cours',
  trayRecentTasks: 'Tâches récentes',
  trayOpen: 'Ouvrir TimeTracker',
  trayQuit: 'Quitter',
  trayTooltipActive: (count: number) =>
    `TimeTracker — ${count} chronomètre${count > 1 ? 's' : ''} actif${count > 1 ? 's' : ''}`,
  notifyTestTitle: 'Notification de test',
  notifyTestBody: 'Les notifications fonctionnent correctement.',
  notifyDailyGoalTitle: 'Objectif du jour atteint 🎯',
  notifyDailyGoalBody: (duration: string) => `Vous avez suivi ${duration} aujourd’hui.`,
  notifyLongSessionTitle: 'Suivi toujours en cours',
  notifyLongSessionBody: (project: string, duration: string) =>
    `${project} tourne depuis ${duration}.`
}

const catalogs: Record<Language, MainMessages> = { en, fr }

export function mainMessages(language: Language): MainMessages {
  return catalogs[language] ?? en
}
