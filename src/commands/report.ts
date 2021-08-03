import { EmbedFieldData, Role, Util } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import cache, { database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import isValidDate from '../utils/isValidDate'

const commandReport: CommandProps = async ({ message, guildId, args }) => {
  if (!isAdmin(message.member)) {
    return {
      content: ':lock: 這個指令限「管理員」使用',
      errorType: 'noAdmin',
    }
  }

  if (args.length < 3) {
    return {
      content: ':question: 請輸入開始日期與結束日期，格式為 `c!report YYYYMMDD YYYYMMDD`（西元年月日）',
      errorType: 'syntax',
    }
  }

  if (!isValidDate(args[1]) || !isValidDate(args[2])) {
    return {
      content: ':x: 請輸入正確的日期格式 `YYYYMMDD`（西元年月日）',
      embed: {
        description: `錯誤格式：\n${[args[1], args[2]]
          .filter(date => !isValidDate(date))
          .map(date => Util.escapeMarkdown(date))
          .join('\n')}`,
      },
      errorType: 'syntax',
    }
  }
  const startDate = args[1] < args[2] ? args[1] : args[2]
  const endDate = args[1] > args[2] ? args[1] : args[2]
  if (moment(endDate).diff(moment(startDate), 'days') > 31) {
    return {
      content: ':x: 查詢區間限一個月內',
      errorType: 'syntax',
    }
  }

  const rawData: { [Date: string]: string } =
    (await database.ref(`/records/${guildId}`).orderByKey().startAt(startDate).endAt(endDate).once('value')).val() || {}

  if (Object.keys(rawData).length === 0) {
    return {
      content: ':triangular_flag_on_post: **GUILD_NAME** 在 `START_DATE` ~ `END_DATE` 這段時間內沒有紀錄'
        .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
        .replace('START_DATE', startDate)
        .replace('END_DATE', endDate),
      errorType: 'syntax',
    }
  }

  const attendedMembers: {
    [MemberID: string]: {
      name: string
      count: number
    }
  } = {}

  const guildRoles = await message.guild?.roles.fetch()
  const targetRoles: Role[] = []
  const missingRoleIds: string[] = []
  cache.settings[guildId]?.roles?.split(' ').forEach(roleId => {
    const targetRole = guildRoles?.cache.get(roleId)
    if (targetRole) {
      targetRoles.push(targetRole)
    } else {
      missingRoleIds.push(roleId)
    }
  })
  const isEveryone = targetRoles.length === 0

  if (isEveryone) {
    Object.values(rawData).forEach(record => {
      record.split(' ').forEach(memberId => {
        if (attendedMembers[memberId]) {
          attendedMembers[memberId].count += 1
        } else {
          attendedMembers[memberId] = {
            name: cache.names[memberId] || cache.displayNames[guildId]?.[memberId] || '',
            count: 1,
          }
        }
      })
    })
  } else {
    targetRoles.forEach(role => {
      role.members
        .filter(member => !member.user.bot)
        .forEach(member => {
          attendedMembers[member.id] = {
            name: cache.names[member.id] || cache.displayNames[guildId]?.[member.id] || member.displayName,
            count: 0,
          }
        })
    })
    Object.values(rawData).forEach(record => {
      record
        .split(' ')
        .filter(memberId => !!attendedMembers[memberId])
        .forEach(memberId => {
          attendedMembers[memberId].count += 1
        })
    })
  }

  const recordDates = Object.keys(rawData)
  const fields: EmbedFieldData[] = []
  new Array(recordDates.length).fill(0).forEach((_, i) => {
    const filteredMemberIds = Object.keys(attendedMembers)
      .filter(memberId => memberId && attendedMembers[memberId].count === recordDates.length - i)
      .sort((a, b) => attendedMembers[a].name.localeCompare(attendedMembers[b].name) || a.localeCompare(b))
    const memberCount = filteredMemberIds.length
    while (filteredMemberIds.length) {
      fields.push({
        name: filteredMemberIds.length === memberCount ? `出席 ${recordDates.length - i} 次：${memberCount} 人` : '.',
        value: filteredMemberIds
          .splice(0, 50)
          .map(memberId => Util.escapeMarkdown(attendedMembers[memberId].name.slice(0, 16)) || `<@${memberId}>`)
          .join('、'),
      })
    }
  })

  return {
    content: ':triangular_flag_on_post: **GUILD_NAME** 出席統計 `START_DATE` ~ `END_DATE`'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('START_DATE', startDate)
      .replace('END_DATE', endDate),
    embed: {
      description: '點名日期：DATES（共 COUNT 次）\n點名對象：ROLES'
        .replace('DATES', recordDates.map(date => `\`${date}\``).join(' '))
        .replace('COUNT', `${recordDates.length}`)
        .replace('ROLES', isEveryone ? '所有人' : targetRoles.map(role => Util.escapeMarkdown(role.name)).join('、')),
      fields,
    },
  }
}

export default commandReport
