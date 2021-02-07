import { CommandProps } from '../types'
import database, { cache } from '../utils/database'

const commandName: CommandProps = async ({ message, args }) => {
  if (args.length === 0) {
    return {
      content: ':triangular_flag_on_post: USER_TAG 的顯示名稱為：NICKNAME'
        .replace('USER_TAG', message.author.tag)
        .replace('NICKNAME', cache.names[message.author.id] || message.member?.displayName || ''),
    }
  }

  const newName = args.join('')
  await database.ref(`/names/${message.author.id}`).set(newName)

  return {
    content: ':triangular_flag_on_post: USER_TAG 的顯示名稱已改為：NICKNAME'
      .replace('USER_TAG', message.author.tag)
      .replace('NICKNAME', newName),
  }
}

export default commandName
