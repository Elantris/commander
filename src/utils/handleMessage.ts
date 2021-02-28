import { DMChannel, Message, MessageEmbedOptions } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps } from '../types'
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
    !message.guild ||
    !message.member ||
    message.channel instanceof DMChannel ||
    cache.bannedGuilds[message.author.id] ||
    cache.bannedGuilds[message.guild.id]
  ) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'c!'
  const mentionBotPattern = new RegExp(`<@!{0,1}${message.client.user?.id}>`)
  if (mentionBotPattern.test(message.content)) {
    sendResponse(message, {
      content: ':triangular_flag_on_post: Commander 點名機器人\n指令前綴：`PREFIX`\n說明文件：<MANUAL>\n邀請連結：DISCORD'
        .replace('PREFIX', prefix)
        .replace('MANUAL', 'https://hackmd.io/@eelayntris/commander')
        .replace('DISCORD', 'https://discord.gg/Ctwz4BB'),
    })
    return
  }
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
    const commandResult = await commands[commandName]({ message, guildId, args: args.slice(1) })
    if (!commandResult.content) {
      throw new Error('No result content.')
    }
    await sendResponse(message, commandResult)
    if (commandResult.isSyntaxError) {
      delete guildStatus[guildId]
      return
    }
  } catch (error) {
    await sendResponse(message, {
      content:
        ':fire: 發生未知的錯誤，我們會盡快修復這個問題，歡迎加入開發群組回報給開發者\nhttps://discord.gg/Ctwz4BB',
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

const sendResponse = async (
  message: Message,
  options: { content: string; embed?: MessageEmbedOptions; error?: Error },
) => {
  if (message.channel instanceof DMChannel) {
    return
  }

  const responseMessage = await message.channel.send({
    content: options.content,
    embed: options.embed
      ? {
          ...options.embed,
          title: '加入 eeBots Support（公告、更新）',
          url: 'https://discord.gg/Ctwz4BB',
          color: options.error ? 0xff6b6b : 0xcc5de8,
        }
      : undefined,
  })

  loggerHook.send(
    '[`TIME`] MESSAGE_CONTENT\n[`RESPONSE_TIME`] RESPONSE_CONTENT'
      .replace('TIME', moment(message.createdTimestamp).format('HH:mm:ss'))
      .replace('MESSAGE_CONTENT', message.content)
      .replace('RESPONSE_TIME', moment(responseMessage.createdTimestamp).format('HH:mm:ss'))
      .replace('RESPONSE_CONTENT', responseMessage.content),
    {
      embeds: [
        {
          ...options.embed,
          color: options.error ? 0xff6b6b : 0xcc5de8,
          fields: [
            ...(options.embed?.fields || []),
            {
              name: 'Status',
              value: options.error ? '```ERROR```'.replace('ERROR', `${options.error.stack}`) : 'SUCCESS',
            },
            { name: 'Guild', value: `${message.guild?.id}\n${message.guild?.name}`, inline: true },
            { name: 'Channel', value: `${message.channel.id}\n${message.channel.name}`, inline: true },
            { name: 'User', value: `${message.author.id}\n${message.author.tag}`, inline: true },
          ],
          footer: { text: `${responseMessage.createdTimestamp - message.createdTimestamp} ms` },
        },
      ],
    },
  )
}

export default handleMessage
