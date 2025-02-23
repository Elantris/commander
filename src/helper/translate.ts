import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import cache, { LocaleType } from './cache.js'

export const translations: {
  [Locale in LocaleType]?: {
    [key: string]: string
  }
} = {
  'zh-TW': {},
  'en-US': {},
}

readdirSync(join(import.meta.dirname, '../../translations')).forEach((filename) => {
  if (!filename.endsWith('.json')) {
    return
  }
  const locale = filename.replace('.json', '') as LocaleType
  translations[locale] = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../translations', filename), { encoding: 'utf8' }),
  )
})

const translate: (
  key: string,
  options?: {
    guildId?: string
    locale?: LocaleType
  },
) => string = (key, options) => {
  const locale = options?.locale || cache.settings[options?.guildId || '']?.locale || 'zh-TW'

  return translations[locale]?.[key] || translations['zh-TW']?.[key] || key
}

export default translate
