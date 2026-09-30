import { computed, type ComputedRef } from 'vue'
import { locale as coreLocale, type SupportedLocale } from '@/i18n'
import { messages as common } from './common'
import { messages as feed } from './feed'
import { messages as play } from './play'
import { messages as lists } from './lists'
import { messages as local } from './local'
import { messages as notes } from './notes'
import { messages as secondary } from './secondary'

const appMessages = {
  fr: { ...common.fr, ...feed.fr, ...play.fr, ...lists.fr, ...local.fr, ...notes.fr, ...secondary.fr },
  en: { ...common.en, ...feed.en, ...play.en, ...lists.en, ...local.en, ...notes.en, ...secondary.en },
} as const

export type AppMessageKey = keyof typeof appMessages.fr

const moduleLocale: ComputedRef<SupportedLocale> = coreLocale

export function at(key: AppMessageKey, params: Record<string, string | number> = {}): string {
  let value: string = (appMessages[moduleLocale.value] as Record<string, string>)[key]
  if (value === undefined) value = key
  for (const [name, replacement] of Object.entries(params)) value = value.replace(`{${name}}`, String(replacement))
  return value
}

export function translateApp(key: AppMessageKey): string { return at(key) }

export const locale = moduleLocale

export function useAppI18n() {
  const activeLocale = computed(() => moduleLocale.value)
  return { t: at, locale: activeLocale }
}