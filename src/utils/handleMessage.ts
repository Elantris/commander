import { DMChannel, Message, Util } from 'discord.js'
import { readdirSync } from 'fs'
import moment from 'moment'
import { join } from 'path'
import { CommandProps, CommandResultProps } from '../types'
import cache, { database } from './cache'
import getHint from './getHint'
import { loggerHook } from './hooks'

const guildStatus: { [GuildID in string]?: 'processing' | 'cooling-down' | 'muted' } = {}
const commands: { [CommandName in string]?: CommandProps } = {}

readdirSync(join(__dirname, '..', 'commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(async filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = (await import(join(__dirname, '..', 'commands', commandName))).default
  })

const handleMessage = async (message: Message) => {
  if (message.author.bot || !message.guild || cache.banned[message.author.id] || cache.banned[message.guild.id]) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'c!'
  const isMentioned = new RegExp(`^<@!{0,1}${message.client.user?.id}>$`).test(message.content)
  if (!message.content.startsWith(prefix) && !isMentioned) {
    return
  }

  const args = message.content.replace(/[\s\n]+/g, ' ').split(' ')
  const commandName = isMentioned ? 'help' : args[0].slice(prefix.length)
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
    const commandResult = await commands[commandName]?.({ message, guildId, args })
    if (!commandResult || (!commandResult?.content && !commandResult.embed)) {
      throw new Error('No result content')
    }
    await sendResponse(message, commandResult)

    if (commandResult.errorType === 'syntax') {
      cache.syntaxErrorsCounts[message.author.id] = (cache.syntaxErrorsCounts[message.author.id] || 0) + 1
      if ((cache.syntaxErrorsCounts[message.author.id] || 0) > 16) {
        database
          .ref(`/banned/${message.author.id}`)
          .set(`[${moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm')}] too many syntax errors`)
        await sendResponse(message, {
          content: ':lock: 錯誤使用指令太多次，請加入客服群組說明原因以解鎖機器人使用權',
        })
      }
    } else if (commandResult.errorType === 'noAdmin') {
      cache.noAdminErrorsCounts[message.author.id] = (cache.noAdminErrorsCounts[message.author.id] || 0) + 1
      if ((cache.noAdminErrorsCounts[message.author.id] || 0) > 4) {
        database
          .ref(`/banned/${message.author.id}`)
          .set(`[${moment(message.createdTimestamp).format('YYYY-MM-DD HH:mm')}] no admin permission`)
        await sendResponse(message, {
          content: ':lock: 偵測到無管理員身份試圖竄改點名紀錄，如需解鎖請伺服器管理員到客服群組說明原因',
        })
      }
    } else {
      cache.syntaxErrorsCounts[message.author.id] = 0
      cache.noAdminErrorsCounts[message.author.id] = 0
    }
  } catch (error) {
    await sendResponse(message, {
      content: ':fire: 好像發生了點問題，請加入開發群組回報狀況\nhttps://discord.gg/Ctwz4BB',
      error,
    })
  }

  guildStatus[guildId] = 'cooling-down'
  setTimeout(() => {
    delete guildStatus[guildId]
  }, 3000)
}

const sendResponse = async (message: Message, result: CommandResultProps) => {
  if (!message.guild || message.channel instanceof DMChannel) {
    return
  }

  const responseMessage = await message.channel
    .send(result.content, {
      embed: {
        color: 0xcc5de8,
        title: '加入 eeBots Support（公告、更新）',
        url: 'https://discord.gg/Ctwz4BB',
        footer: { text: `💡 ${getHint()}` },
        ...result.embed,
      },
    })
    .catch(() => null)

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
                value: result.error ? '```ERROR```'.replace('ERROR', `${result.error}`) : 'SUCCESS',
              },
              {
                name: 'Guild',
                value: `${message.guild.id}\n${Util.escapeMarkdown(message.guild.name)}`,
                inline: true,
              },
              {
                name: 'Channel',
                value: `${message.channel.id}\n${Util.escapeMarkdown(message.channel.name)}`,
                inline: true,
              },
              {
                name: 'User',
                value: `${message.author.id}\n${Util.escapeMarkdown(message.author.tag)}`,
                inline: true,
              },
            ],
            footer: {
              text: responseMessage ? `${responseMessage.createdTimestamp - message.createdTimestamp} ms` : undefined,
            },
          },
        ],
      },
    )
    .catch(() => {})
}

export default handleMessage
