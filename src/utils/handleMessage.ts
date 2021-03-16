import { DMChannel, Message } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps, CommandResultProps } from '../types'
import { cache } from './database'
import { loggerHook } from './hooks'

const guildStatus: { [GuildID: string]: 'processing' | 'cooling-down' | 'muted' } = {}
const commands: { [CommandName: string]: CommandProps } = {}

readdirSync(join(__dirname, '..', 'commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(async filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = (await import(join(__dirname, '..', 'commands', commandName))).default
  })

const handleMessage: (message: Message) => Promise<void> = async message => {
  if (
    message.author.bot ||
    cache.banned[message.author.id] ||
    !message.guild ||
    cache.banned[message.guild.id] ||
    message.channel instanceof DMChannel
  ) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'c!'
  if (!message.content.startsWith(prefix)) {
    return
  }

  const args = message.content.replace(/\s+/g, ' ').split(' ')
  const commandName = args[0].slice(prefix.length)
  if (!commandName || !commands[commandName]) {
    return
  }

  if (guildStatus[guildId]) {
    if (guildStatus[guildId] === 'processing') {
      sendResponse(message, { content: ':star2: 指令處理中，你需要再等一等...' })
      guildStatus[guildId] = 'muted'
    } else if (guildStatus[guildId] === 'cooling-down') {
      sendResponse(message, { content: ':ice_cube: 指令冷卻中，你需要再慢一點...' })
      guildStatus[guildId] = 'muted'
    }
    return
  }

  try {
    guildStatus[guildId] = 'processing'
    const commandResult = await commands[commandName]({ message, guildId, args })
    if (!commandResult.content && !commandResult.embed) {
      throw new Error('No result content.')
    }
    await sendResponse(message, commandResult)
    if (commandResult.isSyntaxError) {
      delete guildStatus[guildId]
      return
    }
  } catch (error) {
    await sendResponse(message, {
      content: ':fire: 發生未知的錯誤，歡迎加入開發群組回報問題\nhttps://discord.gg/Ctwz4BB',
      error,
    })
    delete guildStatus[guildId]
    return
  }

  guildStatus[guildId] = 'cooling-down'
  setTimeout(() => {
    delete guildStatus[guildId]
  }, 3000)
}

const sendResponse = async (message: Message, result: CommandResultProps) => {
  if (message.channel instanceof DMChannel) {
    return
  }

  const responseMessage: Message | null = await message.channel
    .send(result.content, {
      embed: result.embed
        ? {
            ...result.embed,
            color: 0xcc5de8,
            title: '加入 eeBots Support（公告、更新）',
            url: 'https://discord.gg/Ctwz4BB',
          }
        : undefined,
    })
    .catch()

  loggerHook
    .send(
      '[`TIME`] MESSAGE_CONTENT\nRESPONSE_CONTENT'
        .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
        .replace('MESSAGE_CONTENT', message.content)
        .replace('RESPONSE_CONTENT', responseMessage?.content || ''),
      {
        embeds: [
          ...(responseMessage?.embeds || []),
          {
            color: result.error ? 0xff6b6b : undefined,
            fields: [
              {
                name: 'Status',
                value: result.error ? '```ERROR```'.replace('ERROR', `${result.error.stack}`) : 'SUCCESS',
              },
              { name: 'Guild', value: `${message.guild?.id}\n${message.guild?.name}`, inline: true },
              { name: 'Channel', value: `${message.channel.id}\n${message.channel.name}`, inline: true },
              { name: 'User', value: `${message.author.id}\n${message.author.tag}`, inline: true },
            ],
            footer: { text: `${(responseMessage?.createdTimestamp || Date.now()) - message.createdTimestamp} ms` },
          },
        ],
      },
    )
    .catch()
}

export default handleMessage
