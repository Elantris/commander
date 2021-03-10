import { EmbedFieldData, Role, Util } from 'discord.js'
import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import isValidDate from '../utils/isValidDate'

const commandReport: CommandProps = async ({ message, guildId, args }) => {
  if (!message.member?.hasPermission('ADMINISTRATOR')) {
    return {
      content: ':x: 這個指令限「管理員」使用',
      isSyntaxError: true,
    }
  }

  const todayDate = moment(message.createdTimestamp).format('YYYYMMDD')
  const startDate = args[1] || moment(message.createdTimestamp).subtract(6, 'days').format('YYYYMMDD')
  const endDate = args[2] || todayDate

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return {
      content: ':x: 我只認得的日期格式為 `YYYYMMDD` （年/月/日）',
      isSyntaxError: true,
    }
  }
  if (endDate > todayDate) {
    return {
      content: ':x: 結束日期必須在今天以前，畢竟未來的事情我也不曉得',
      isSyntaxError: true,
    }
  }
  if (moment(endDate).diff(moment(startDate), 'days') > 30) {
    return {
      content: ':x: 查詢區間限一個月內',
      isSyntaxError: true,
    }
  }

  const loadingMessage = await message.channel.send({
    embed: {
      color: 0xda77f2,
      description: ':triangular_flag_on_post: 讀取紀錄中 . . .',
    },
  })
  const rawData: { [Date: string]: string } = (
    await database.ref(`/records/${guildId}`).orderByKey().startAt(startDate).endAt(endDate).once('value')
  ).val()
  await loadingMessage.delete()

  if (!rawData || Object.keys(rawData).length === 0) {
    return {
      content: ':x: `START_DATE` ~ `END_DATE` 這段時間內沒有紀錄'
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
      .split(' ')
      .map(roleId => roles?.cache.get(roleId))
      .reduce<Role[]>((accumulator, role) => (role ? [...accumulator, role] : accumulator), []) || []
  const isEveryone = targetRoles.length === 0
  if (isEveryone) {
    await message.guild?.members.fetch()
    message.guild?.members.cache
      .filter(member => !member.user.bot)
      .forEach(member => {
        attendedMembers[member.id] = {
          name: cache.names[member.id] || member.displayName,
          count: 0,
        }
      })
  } else {
    targetRoles.forEach(role => {
      role.members
        .filter(member => !member.user.bot && !attendedMembers[member.id])
        .forEach(member => {
          attendedMembers[member.id] = {
            name: cache.names[member.id] || member.displayName,
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
          .map(memberId => Util.escapeMarkdown(attendedMembers[memberId].name).slice(0, 16))
          .join('、'),
      })
    }
  })

  return {
    content: ':triangular_flag_on_post: 出席統計 `START_DATE` ~ `END_DATE`\n點名紀錄：DATES\n點名對象：ROLES'
      .replace('START_DATE', startDate)
      .replace('END_DATE', endDate)
      .replace('DATES', recordDates.map(date => `\`${date}\``).join(' '))
      .replace('ROLES', isEveryone ? '所有人' : targetRoles.map(role => role.name).join('、')),
    embed: {
      fields,
    },
  }
}

export default commandReport
