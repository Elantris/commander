import { Util } from 'discord.js'
import { unionWith } from 'ramda'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import isValidDate from '../utils/isValidDate'
import notEmpty from '../utils/notEmpty'
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
      content: ':x: 第一個參數要指定日期 YYYYMMDD（西元年月日）',
      errorType: 'syntax',
    }
  }

  const targetMembers = unionWith(
    (a, b) => a.id === b.id,
    await searchMembers(message, args.slice(2)),
    message.mentions.members?.array() || [],
  )
  if (targetMembers.length === 0) {
    return {
      content: ':x: 找不到指定的成員',
      errorType: 'syntax',
    }
  }

  const displayNamesUpdates: { [MemberID: string]: string } = {}

  for (const member of targetMembers) {
    if (cache.displayNames[guildId]?.[member.id] !== member.displayName) {
      displayNamesUpdates[member.id] = member.displayName
    }
  }

  if (Object.keys(displayNamesUpdates).length) {
    cache.displayNames[guildId] = {
      ...(cache.displayNames[guildId] || {}),
      ...displayNamesUpdates,
    }
    await database.ref(`/displayNames/${guildId}`).update(displayNamesUpdates)
  }

  const record: string | undefined = (await database.ref(`/records/${guildId}/${date}`).once('value')).val()

  const recordedMemberIds = record?.split(' ') || []
  const addedMembers = targetMembers.filter(member => !record?.includes(member.id))
  const removedMembers = targetMembers.filter(member => record?.includes(member.id))

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
    content: ':triangular_flag_on_post: **GUILD_NAME** 修改記錄 `DATE`'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('DATE', date),
    embed: {
      description: '點名日期：`DATE`'.replace('DATE', date),
      fields: [
        addedMembers.length
          ? {
              name: `新增成員 ${addedMembers.length} 人`,
              value: addedMembers
                .map(member =>
                  Util.escapeMarkdown(
                    (cache.names[member.id] || cache.displayNames[guildId]?.[member.id] || '').slice(0, 16),
                  ),
                )
                .sort()
                .join('、'),
            }
          : undefined,
        removedMembers.length
          ? {
              name: `移除成員 ${removedMembers.length} 人`,
              value: removedMembers
                .map(member =>
                  Util.escapeMarkdown(
                    (cache.names[member.id] || cache.displayNames[guildId]?.[member.id] || '').slice(0, 16),
                  ),
                )
                .sort()
                .join('、'),
            }
          : undefined,
      ].filter(notEmpty),
    },
  }
}

export default commandModify
