import { APIEmbed, escapeMarkdown, Role, SlashCommandBuilder } from 'discord.js'
import { DateTime } from 'luxon'
import cache, { CommandProps, database } from '../utils/cache'
import isAdmin from '../utils/isAdmin'
import isDateValid from '../utils/isDateValid'
import splitMessage from '../utils/splitMessage'
import translate from '../utils/translate'

const build = new SlashCommandBuilder()
  .setName('report')
  .setDescription('統計一段時間內的出席狀況')
  .setDescriptionLocalizations({
    'en-US': 'Count the attendances during the interval.',
  })
  .addIntegerOption(option =>
    option.setName('from').setDescription('日期格式：YYYYMMDD，例如：20220801').setRequired(true),
  )
  .addIntegerOption(option =>
    option.setName('to').setDescription('日期格式：YYYYMMDD，例如：20220801').setRequired(true),
  )
  .toJSON()

const exec: CommandProps['exec'] = async interaction => {
  const guildId = interaction.guildId
  const guild = interaction.guild
  const from = interaction.options.getInteger('from')
  const to = interaction.options.getInteger('to')

  if (!guildId || !guild || !from || !to) {
    return
  }

  if (!isAdmin(guild, interaction.user.id)) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  if (!isDateValid(`${from}`) || !isDateValid(`${to}`)) {
    return {
      content: translate('report.error.invalidDate', { guildId }),
    }
  }

  const startDate = DateTime.fromFormat(`${from < to ? from : to}`, 'yyyyMMdd')
  const endDate = DateTime.fromFormat(`${from > to ? from : to}`, 'yyyyMMdd')
  const diff = endDate.diff(startDate, 'days').toObject()

  if ((diff.days || 0) > 30) {
    return {
      content: translate('report.error.invalidInterval', { guildId }),
    }
  }

  const rawData: {
    [Date: string]: string
  } =
    (
      await database
        .ref(`/records/${guildId}`)
        .orderByKey()
        .startAt(startDate.toFormat('yyyyMMdd'))
        .endAt(endDate.toFormat('yyyyMMdd'))
        .once('value')
    ).val() || {}

  if (Object.keys(rawData).length === 0) {
    return {
      content: translate('report.error.noRecordData', { guildId })
        .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
        .replace('{START_DATE}', startDate.toFormat('yyyyMMdd'))
        .replace('{END_DATE}', endDate.toFormat('yyyyMMdd')),
    }
  }

  const attendedMembers: {
    [MemberID: string]: {
      name: string
      count: number
    }
  } = {}

  const targetRoles: Role[] = []
  const missingRoleIds: string[] = []
  cache.settings[guildId]?.roles?.split(' ').forEach(roleId => {
    if (!roleId) {
      return
    }
    const targetRole = guild.roles.cache?.get(roleId)
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
            name: guild.members.cache.get(memberId)?.displayName || memberId,
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
            name: member.displayName,
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
  const fields: APIEmbed['fields'] = []
  for (let i = recordDates.length; i > 0; i--) {
    const targetMembers = Object.values(attendedMembers)
      .filter(member => member.count === i)
      .map(member => escapeMarkdown(member.name.slice(0, 16)))
      .sort()
    if (targetMembers.length === 0) {
      continue
    }
    splitMessage(targetMembers.join('\n'), { length: 1000 }).forEach((content, index) => {
      fields.push({
        name:
          index === 0
            ? translate('report.text.fieldTitle', { guildId })
                .replace('{COUNT}', `${i}`)
                .replace('{PEOPLE}', `${targetMembers.length}`)
            : '.',
        value: content.replace(/\n/g, '、'),
      })
    })
  }

  return {
    content: translate('report.text.result', { guildId })
      .replace('{GUILD_NAME}', escapeMarkdown(guild.name))
      .replace('{START_DATE}', startDate.toFormat('yyyyMMdd'))
      .replace('{END_DATE}', endDate.toFormat('yyyyMMdd')),
    embed: {
      description: translate('report.text.resultDescription', { guildId })
        .replace('{DATES}', recordDates.map(date => `\`${date}\``).join(' '))
        .replace('{COUNT}', `${recordDates.length}`)
        .replace('{ROLES}', isEveryone ? '@everyone' : targetRoles.map(role => `<@&${role.id}>`).join(' ')),
      fields,
    },
  }
}

export default {
  build,
  exec,
}
