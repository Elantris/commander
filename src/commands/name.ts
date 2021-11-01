import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'

const commandName: CommandProps = async ({ message, guildId, args }) => {
  if (cache.displayNames[guildId]?.[message.author.id] !== message.member?.displayName) {
    cache.displayNames[guildId] = {
      ...(cache.displayNames[guildId] || {}),
      [message.author.id]: message.member?.displayName,
    }
    await database.ref(`/displayNames/${guildId}/${message.author.id}`).set(message.member?.displayName)
  }

  if (args.length === 1) {
    if (cache.names[message.author.id]) {
      await database.ref(`/names/${message.author.id}`).remove()
    }
    return {
      content: ':triangular_flag_on_post: 已重設 USER_TAG 的顯示名稱為 MEMBER_NAME'
        .replace('USER_TAG', message.author.tag)
        .replace('MEMBER_NAME', message.member?.displayName || ''),
    }
  }

  const newName = args[1].slice(0, 16)
  await database.ref(`/names/${message.author.id}`).set(newName)

  return {
    content: ':triangular_flag_on_post: USER_TAG 的顯示名稱已設定為：NICKNAME'
      .replace('USER_TAG', message.author.tag)
      .replace('NICKNAME', Util.escapeMarkdown(newName))
      .trim(),
  }
}

export default commandName
