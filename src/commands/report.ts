import { EmbedFieldData } from 'discord.js'
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
  const startDate = args[0] || moment(message.createdTimestamp).subtract(6, 'days').format('YYYYMMDD')
  const endDate = args[1] || todayDate

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return {
      content: ':x: 請輸入正確日期格式 `YYYYMMDD`',
      isSyntaxError: true,
    }
  }
  if (endDate > todayDate) {
    return {
      content: ':x: 結束日期不可在未來',
      isSyntaxError: true,
    }
  }
  if (moment(endDate).diff(moment(startDate), 'days') > 30) {
    return {
      content: ':x: 查詢區間超過一個月',
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

  const recordDates = Object.keys(rawData)
  if (recordDates.length === 0) {
    return {
      content: ':x: 這段時間內沒有紀錄',
    }
  }

  const attendedMembers: {
    [MemberID: string]: {
      name: string
      count: number
    }
  } = {}

  await message.guild?.roles.fetch()
  const targetRoles = message.guild?.roles.cache.filter(role => cache.settings[guildId]?.roles.includes(role.id))
  const isEveryone = targetRoles?.size === 0
  if (isEveryone) {
    await message.guild?.members.fetch()
    message.guild?.members.cache
      .filter(member => !member.user.bot)
      .forEach(member => {
        attendedMembers[member.id] = {
          name: cache.names[member.id] || member.displayName.slice(0, 20),
          count: 0,
        }
      })
  } else {
    targetRoles?.forEach(role => {
      role.members
        .filter(member => !member.user.bot || !!attendedMembers[member.id])
        .forEach(member => {
          attendedMembers[member.id] = {
            name: cache.names[member.id] || member.displayName.slice(0, 20),
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
  new Array(isEveryone ? recordDates.length : recordDates.length + 1).fill(0).forEach((_, i) => {
    const filteredMemberIds = Object.keys(attendedMembers)
      .filter(memberId => attendedMembers[memberId].count === recordDates.length - i)
      .sort()
    const memberCount = filteredMemberIds.length
    while (filteredMemberIds.length) {
      fields.push({
        name: filteredMemberIds.length === memberCount ? `出席 ${recordDates.length - i} 次：${memberCount} 人` : '.',
        value: filteredMemberIds
          .splice(0, 30)
          .map(memberId => attendedMembers[memberId].name)
          .join('、'),
      })
    }
  })

  return {
    content: ':triangular_flag_on_post: 出席統計 `START_DATE` ~ `END_DATE`'
      .replace('START_DATE', startDate)
      .replace('END_DATE', endDate),
    embed: {
      description: '點名紀錄：DATES\n目標身份組：ROLES'
        .replace('DATES', recordDates.map(date => `\`${date}\``).join(' '))
        .replace(
          'ROLES',
          isEveryone
            ? '所有人'
            : message.guild?.roles.cache
                .filter(role => cache.settings[guildId].roles.includes(role.id))
                .map(role => role.name)
                .join(' ') || '',
        ),
      fields,
    },
  }
}

export default commandReport
