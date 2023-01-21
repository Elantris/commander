import { APIEmbed, ChatInputCommandInteraction, RESTPostAPIApplicationCommandsJSONBody, TextChannel } from 'discord.js'
import admin, { ServiceAccount } from 'firebase-admin'
import { readdirSync } from 'fs'
import { join } from 'path'
import appConfig from '../appConfig'

// type definitions
export type CommandProps = {
  build: RESTPostAPIApplicationCommandsJSONBody
  exec: (interaction: ChatInputCommandInteraction) => Promise<{
    content: string
    embed?: APIEmbed
  } | void>
}

export const locales = ['zh-TW', 'en-US'] as const
export type LocaleType = typeof locales[number]

export const isLocaleType = (target: LocaleType | string): target is LocaleType =>
  !!locales.find(locale => locale === target)

// load commands
export const commands: { [CommandName in string]?: CommandProps } = {}
export const commandBuilds: RESTPostAPIApplicationCommandsJSONBody[] = []

readdirSync(join(__dirname, '../commands')).forEach(async filename => {
  if (!filename.endsWith('.js') && !filename.endsWith('.ts')) {
    return
  }
  const commandName = filename.split('.')[0]
  const {
    default: command,
  }: {
    default: CommandProps
  } = await import(join(__dirname, '../commands', filename))

  commands[commandName] = command
  commandBuilds.push(command.build)
})

// firebase
admin.initializeApp({
  credential: admin.credential.cert(appConfig.FIREBASE.serviceAccount as ServiceAccount),
  databaseURL: appConfig.FIREBASE.databaseURL,
})

export const database = admin.database()
const cache: {
  [key: string]: any
  logChannel: TextChannel | null
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
} = {
  logChannel: null,
  banned: {},
  isInit: {},
  settings: {},
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
