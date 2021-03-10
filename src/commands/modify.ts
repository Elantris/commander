import { Util } from 'discord.js'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import isValidDate from '../utils/isValidDate'
import searchMembers from '../utils/searchMembers'

const commandModify: CommandProps = async ({ message, guildId, args }) => {
  if (!message.member?.hasPermission('ADMINISTRATOR')) {
    return {
      content: ':x: 這個指令限「管理員」使用',
      isSyntaxError: true,
    }
  }

  if (args.length < 3) {
    return {
      content: ':x: 需要選擇日期、目標成員，`c!modify YYYYMMDD members`',
      isSyntaxError: true,
    }
  }

  const date = args[1]
  if (!isValidDate(date)) {
    return {
      content: ':x: 第一個參數要指定日期 YYYYMMDD',
      isSyntaxError: true,
    }
  }

  const members = await searchMembers(message, args.slice(1))
  if (members.length === 0) {
    return {
      content: ':x: 找不到指定的成員',
    }
  }

  const record: string | undefined = await (await database.ref(`/records/${guildId}/${date}`).once('value')).val()
  if (!record) {
    return {
      content: `:x: ${date} 這天沒有點名紀錄`,
    }
  }

  const recordedMemberIds = record.split(' ')
  const addedMembers = members.filter(member => record.includes(member.id))
  const removedMembers = members.filter(member => !record.includes(member.id))

  await database
    .ref(`/records/${guildId}/${date}`)
    .set(
      [
        ...recordedMemberIds.filter(id => removedMembers.some(member => member.id === id)),
        ...addedMembers.map(member => member.id),
      ]
        .sort()
        .join(' '),
    )

  return {
    content: ':triangular_flag_on_post: 點名紀錄 DATE\n新增成員：ADDED_MEMBERS\n移除成員：REMOVED_MEMBERS'
      .replace('DATE', date)
      .replace(
        'ADDED_MEMBERS',
        addedMembers
          .map(member => Util.escapeMarkdown(cache.names[member.id] || member.displayName).slice(0, 16))
          .join('、'),
      )
      .replace(
        'REMOVED_MEMBERS',
        removedMembers
          .map(member => Util.escapeMarkdown(cache.names[member.id] || member.displayName).slice(0, 16))
          .join('、'),
      ),
  }
}

export default commandModify
