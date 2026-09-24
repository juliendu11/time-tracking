import { createI18n } from 'vue-i18n'
import type { Language } from '@shared/types/domain'
import en from './locales/en'
import fr from './locales/fr'

export type MessageSchema = typeof en

declare module 'vue-i18n' {
  // Types every `t('…')` key against the English catalog.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface DefineLocaleMessage extends MessageSchema {}
}

/** Native names, shown as-is in the language switcher regardless of the active locale. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français'
}

/**
 * vue-i18n's default two-form rule treats 0 as plural ("0 timers"), which is
 * right for English; French treats 0 and 1 as singular ("0 chronomètre").
 */
function frenchPluralRule(choice: number, choicesLength: number): number {
  const n = Math.abs(choice)
  if (choicesLength === 3) return n === 0 ? 0 : n === 1 ? 1 : 2
  return n > 1 ? 1 : 0
}

export const i18n = createI18n<[MessageSchema], Language, false>({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, fr },
  pluralRules: { fr: frenchPluralRule }
})

/** Localized weekday name for a JS `getDay()` index (0 = Sunday). */
export function weekdayName(weekday: number, locale: string, style: 'long' | 'short' = 'long'): string {
  // 2023-01-01 was a Sunday, so day (1 + weekday) has getDay() === weekday.
  return new Date(2023, 0, 1 + weekday).toLocaleDateString(locale, { weekday: style })
}
