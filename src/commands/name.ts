import { Util } from 'discord.js'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const commandName: CommandProps = async ({ message, args }) => {
  if (args.length === 1) {
    return {
      content: ':triangular_flag_on_post: USER_TAG 的顯示名稱為：NICKNAME'
        .replace('USER_TAG', message.author.tag)
        .replace(
          'NICKNAME',
          Util.escapeMarkdown(cache.names[message.author.id] || message.member?.displayName.slice(0, 16) || ''),
        ),
    }
  }

  const newName = args[1].slice(0, 16)
  await database.ref(`/names/${message.author.id}`).set(newName)

  return {
    content: ':triangular_flag_on_post: USER_TAG 的顯示名稱已改為：NICKNAME'
      .replace('USER_TAG', message.author.tag)
      .replace('NICKNAME', Util.escapeMarkdown(newName))
      .trim(),
  }
}

export default commandName
