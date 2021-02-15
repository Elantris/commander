import moment from 'moment'
import { CommandProps } from '../types'
import database, { cache } from '../utils/database'
import isValidDate from '../utils/isValidDate'
import searchMembers from '../utils/searchMembers'

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

  const dates = Object.keys(rawData)
  if (dates.length === 0) {
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
  for (const i in rawData) {
    const v = rawData[i].split(' ')
    for (const memberId of v) {
      if (!attendedMembers[memberId]) {
        attendedMembers[memberId] = {
          name: cache.names[memberId] || (await searchMembers(message, [memberId]))[0]?.displayName || memberId,
          count: 1,
        }
      } else {
        attendedMembers[memberId].count += 1
      }
    }
  }

  return {
    content: ':triangular_flag_on_post: 出席統計 `START_DATE` ~ `END_DATE`'
      .replace('START_DATE', startDate)
      .replace('END_DATE', endDate),
    embed: {
      fields: [
        {
          name: `點名紀錄：${dates.length} 次`,
          value: dates.map(date => `\`${date}\``).join(' '),
        },
        ...new Array(dates.length).fill(0).map((_, i) => ({
          name: `出席 ${dates.length - i} 次`,
          value: Object.keys(attendedMembers)
            .filter(memberId => attendedMembers[memberId].count === dates.length - i)
            .map(memberId => attendedMembers[memberId].name)
            .join('、'),
        })),
      ],
    },
  }
}

export default commandReport
