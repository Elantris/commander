import { APIEmbed, ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody, TextChannel } from 'discord.js'
import admin, { ServiceAccount } from 'firebase-admin'
import appConfig from '../appConfig.js'

// type definitions
export type CommandProps = {
  build: RESTPostAPIApplicationCommandsJSONBody
  exec: (interaction: ChatInputCommandInteraction) => Promise<{
    content: string
    embed?: APIEmbed
    isFinished?: boolean
  } | void>
}

export const locales = ['zh-TW', 'en-US'] as const
export type LocaleType = (typeof locales)[number]
export const isLocaleType = (target: LocaleType | string): target is LocaleType =>
  !!locales.find((locale) => locale === target)

// firebase
admin.initializeApp({
  credential: admin.credential.cert(appConfig.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: appConfig.FIREBASE.databaseURL,
})

export const database = admin.database()
const cache: {
  [key: string]: any
  logChannel: TextChannel | null
  isReady: boolean
  banned: {
    [GuildID in string]: any
  }
  isInit: {
    [GuildID in string]?: number
  }
  settings: {
    [GuildID in string]?: {
      locale?: LocaleType
      channels?: string
      roles?: string
      admin?: string
    }
  }
  records: Record<string, Record<string, string>>
} = {
  logChannel: null,
  isReady: false,
  banned: {},
  isInit: {},
  settings: {},
  records: {},
}

const updateCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    cache[key][snapshot.key] = snapshot.val()
  }
}
const removeCache = (snapshot: admin.database.DataSnapshot) => {
  const key = snapshot.ref.parent?.key
  if (key && cache[key] && snapshot.key) {
    delete cache[key][snapshot.key]
  }
}

database.ref('/banned').on('child_added', updateCache)
database.ref('/banned').on('child_changed', updateCache)
database.ref('/banned').on('child_removed', removeCache)

export default cache
