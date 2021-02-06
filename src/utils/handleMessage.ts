import { DMChannel, Message, MessageEmbedOptions, NewsChannel } from 'discord.js'
import { readdirSync } from 'fs'
import { join } from 'path'
import { cache } from './database'
import { loggerHook } from './hooks'
import { CommandProps } from './types'

const guildStatus: { [GuildID: string]: 'processing' | 'cooling-down' | 'muted' } = {}
const commands: { [CommandName: string]: CommandProps } = {}

readdirSync(join(__dirname, '..', 'commands'))
  .filter(filename => filename.endsWith('.js') || filename.endsWith('.ts'))
  .forEach(filename => {
    const commandName = filename.slice(0, -3)
    commands[commandName] = require(join(__dirname, '..', 'commands', commandName)).default
  })

const handleMessage = async (message: Message) => {
  if (
    message.author.bot ||
    !message.guild ||
    !message.member ||
    message.channel instanceof DMChannel ||
    message.channel instanceof NewsChannel ||
    cache.bannedGuilds[message.author.id] ||
    cache.bannedGuilds[message.guild.id]
  ) {
    return
  }

  const guildId = message.guild.id
  const prefix = cache.settings[guildId]?.prefix || 'c!'
  const mentionBotPattern = new RegExp(`<@!{0,1}${message.client.user?.id}>`)
  if (mentionBotPattern.test(message.content)) {
    message.channel.send(':gear: 目前指令前綴：`PREFIX`'.replace('PREFIX', prefix))
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
      message.channel.send(':star2: 指令處理中，你需要再等一等...')
      guildStatus[guildId] = 'muted'
    } else if (guildStatus[guildId] === 'cooling-down') {
      message.channel.send(':ice_cube: 指令冷卻中，你需要再慢一點...')
      guildStatus[guildId] = 'muted'
    }
    return
  }

  try {
    guildStatus[guildId] = 'processing'
    const response = await commands[commandName]({ message, guildId, args: args.slice(1) })
    if (!response.content) {
      throw new Error('No result content.')
    }
    await sendResponse(message, response)
  } catch (error) {
    await sendResponse(message, { content: ':fire: 發生未知的錯誤，我們會盡快修復這個問題', error })
    delete guildStatus[guildId]
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
  const responseMessage = await message.channel.send(options)

  const embeds: MessageEmbedOptions[] = []
  options.embed &&
    embeds.push({
      ...options.embed,
      color: 0xcc5de8,
    })
  options.error &&
    embeds.push({
      color: 0xff6b6b,
      title: options.error.message,
      description: '```ERROR```'.replace('ERROR', options.error.stack || ''),
    })

  loggerHook.send(
    '[`TIME`] `GUILD_ID`: MESSAGE_CONTENT\n(**PROCESSING_TIME**ms) RESPONSE_CONTENT'
      .replace('TIME', `${message.createdTimestamp}`)
      .replace('GUILD_ID', `${message.guild?.id}`)
      .replace('MESSAGE_CONTENT', message.content)
      .replace('PROCESSING_TIME', `${responseMessage.createdTimestamp - message.createdTimestamp}`)
      .replace('RESPONSE_CONTENT', options.content),
    { embeds },
  )
}

export default handleMessage
