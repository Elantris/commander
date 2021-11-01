import { EmbedFieldData, GuildMemberManager, Role, Util } from 'discord.js'
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
    const targetRole = guildRoles?.get(roleId)
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
            name: cache.names[memberId] || cache.displayNames[guildId]?.[memberId] || memberId,
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
  for (let i = recordDates.length; i > 0; i--) {
    const targetMembers = Object.values(attendedMembers)
      .filter(member => member.count === i)
      .map(member => Util.escapeMarkdown(member.name.slice(0, 16)))
      .sort()
    if (targetMembers.length === 0) {
      continue
    }
    Util.splitMessage(targetMembers.join('\n'), { maxLength: 1024 }).forEach((content, index) => {
      fields.push({
        name: index === 0 ? `出席 ${i} 次：${targetMembers.length} 人` : '.',
        value: content.replace(/\n/g, '、'),
      })
    })
  }

  return {
    content: ':triangular_flag_on_post: **GUILD_NAME** 出席統計 `START_DATE` ~ `END_DATE`'
      .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
      .replace('START_DATE', startDate)
      .replace('END_DATE', endDate),
    embed: {
      description: '點名日期：DATES（共 COUNT 次）\n點名對象：ROLES'
        .replace('DATES', recordDates.map(date => `\`${date}\``).join(' '))
        .replace('COUNT', `${recordDates.length}`)
        .replace('ROLES', isEveryone ? '@everyone' : targetRoles.map(role => `<@&${role.id}>`).join(' ')),
      fields,
    },
  }
}

export default commandReport
