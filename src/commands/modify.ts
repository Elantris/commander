import { Util } from 'discord.js'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import isValidDate from '../utils/isValidDate'
import searchMembers from '../utils/searchMembers'

const commandModify: CommandProps = async ({ message, guildId, args }) => {
  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 這個指令限「管理員」使用',
      errorType: 'noAdmin',
    }
  }

  if (args.length < 3) {
    return {
      content: ':x: 需要選擇日期、目標成員，`c!modify YYYYMMDD members`',
      errorType: 'syntax',
    }
  }

  const date = args[1]
  if (!isValidDate(date)) {
    return {
      content: ':x: 第一個參數要指定日期 YYYYMMDD',
      errorType: 'syntax',
    }
  }

  const members = await searchMembers(message, args.slice(2))
  if (members.length === 0) {
    return {
      content: ':x: 找不到指定的成員',
      errorType: 'syntax',
    }
  }

  const record: string = (await database.ref(`/records/${guildId}/${date}`).once('value')).val() || ''

  const recordedMemberIds = record.split(' ')
  const addedMembers = members.filter(member => !record.includes(member.id))
  const removedMembers = members.filter(member => record.includes(member.id))

  await database
    .ref(`/records/${guildId}/${date}`)
    .set(
      [
        ...recordedMemberIds.filter(id => !removedMembers.some(member => member.id === id)),
        ...addedMembers.map(member => member.id),
      ]
        .sort()
        .join(' '),
    )

  return {
    content:
      ':triangular_flag_on_post: **GUILD_NAME**\n點名日期：DATE\n新增成員：ADDED_MEMBERS\n移除成員：REMOVED_MEMBERS'
        .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
        .replace('DATE', date)
        .replace(
          'ADDED_MEMBERS',
          addedMembers
            .map(member => Util.escapeMarkdown((cache.names[member.id] || member.displayName).slice(0, 16)))
            .join('、') || '--',
        )
        .replace(
          'REMOVED_MEMBERS',
          removedMembers
            .map(member => Util.escapeMarkdown((cache.names[member.id] || member.displayName).slice(0, 16)))
            .join('、') || '--',
        ),
  }
}

export default commandModify
