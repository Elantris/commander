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
      isSyntaxError: true,
    }
  }

  if (args.length < 3) {
    return {
      content: ':question: 請輸入開始日期與結束日期，格式為 `c!report YYYYMMDD YYYYMMDD`（年/月/日）',
      isSyntaxError: true,
    }
  }

  if (!isValidDate(args[1]) || !isValidDate(args[2])) {
    return {
      content: ':x: 我只認識的日期格式為 `YYYYMMDD` （年/月/日）',
      isSyntaxError: true,
    }
  }
  const startDate = args[1] < args[2] ? args[1] : args[2]
  const endDate = args[1] > args[2] ? args[1] : args[2]
  if (moment(endDate).diff(moment(startDate), 'days') > 31) {
    return {
      content: ':x: 查詢區間限一個月內',
      isSyntaxError: true,
    }
  }

  const rawData: { [Date: string]: string } | undefined = (
    await database.ref(`/records/${guildId}`).orderByKey().startAt(startDate).endAt(endDate).once('value')
  ).val()

  if (!rawData || Object.keys(rawData).length === 0) {
    return {
      content: ':triangular_flag_on_post: **GUILD_NAME** 在 `START_DATE` ~ `END_DATE` 這段時間內沒有紀錄'
        .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
        .replace('START_DATE', startDate)
        .replace('END_DATE', endDate),
    }
  }

  const recordDates = Object.keys(rawData)
  const attendedMembers: {
    [MemberID: string]: {
      name: string
      count: number
    }
  } = {}

  const roles = await message.guild?.roles.fetch()
  const targetRoles =
    cache.settings[guildId]?.roles
      ?.split(' ')
      .map(roleId => roles?.cache.get(roleId))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), []) || []
  const isEveryone = targetRoles.length === 0
  if (isEveryone) {
    await message.guild?.members.fetch()
    message.guild?.members.cache
      .filter(member => !member.user.bot)
      .forEach(member => {
        attendedMembers[member.id] = {
          name: (cache.names[member.id] || member.displayName).slice(0, 16),
          count: 0,
        }
      })
  } else {
    targetRoles.forEach(role => {
      role.members
        .filter(member => !member.user.bot && !attendedMembers[member.id])
        .forEach(member => {
          attendedMembers[member.id] = {
            name: (cache.names[member.id] || member.displayName).slice(0, 16),
            count: 0,
          }
        })
    })
  }

  Object.values(rawData).forEach(v => {
    v.split(' ')
      .filter(memberId => !!attendedMembers[memberId])
      .forEach(memberId => {
        attendedMembers[memberId].count += 1
      })
  })

  const fields: EmbedFieldData[] = []
  new Array(recordDates.length).fill(0).forEach((_, i) => {
    const filteredMemberIds = Object.keys(attendedMembers)
      .filter(memberId => attendedMembers[memberId].count === recordDates.length - i)
      .sort()
    const memberCount = filteredMemberIds.length
    while (filteredMemberIds.length) {
      fields.push({
        name: filteredMemberIds.length === memberCount ? `出席 ${recordDates.length - i} 次：${memberCount} 人` : '.',
        value: filteredMemberIds
          .splice(0, 50)
          .map(memberId => Util.escapeMarkdown(attendedMembers[memberId].name))
          .join('、'),
      })
    }
  })

  return {
    content:
      ':triangular_flag_on_post: **GUILD_NAME**\n出席統計 `START_DATE` ~ `END_DATE`\n點名日期：DATES\n點名對象：ROLES'
        .replace('GUILD_NAME', Util.escapeMarkdown(message.guild?.name || ''))
        .replace('START_DATE', startDate)
        .replace('END_DATE', endDate)
        .replace('DATES', recordDates.map(date => `\`${date}\``).join(' '))
        .replace('ROLES', isEveryone ? '所有人' : targetRoles.map(role => Util.escapeMarkdown(role.name)).join('、')),
    embed: {
      fields,
    },
  }
}

export default commandReport
