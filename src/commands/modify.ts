import { SlashCommandBuilder } from 'discord.js'
import { CommandProps, database } from '../helper/cache.js'
import isAdmin from '../helper/isAdmin.js'
import translate from '../helper/translate.js'
import isDateValid from '../utils/isDateValid.js'
import notEmpty from '../utils/notEmpty.js'
import timeFormatter from '../utils/timeFormatter.js'

const todayDate = timeFormatter({ format: 'yyyyMMdd' })

const build = new SlashCommandBuilder()
  .setName('modify')
  .setDescription('修改指定日期的出席紀錄')
  .setDescriptionLocalizations({ 'en-US': 'Edit record of specific date.' })
  .addIntegerOption((option) =>
    option.setName('date').setDescription(`日期格式：YYYYMMDD，例如：${todayDate}`).setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName('action')
      .setDescription('新增或移除')
      .addChoices(
        { name: '新增', name_localizations: { 'en-US': 'Add' }, value: 'add' },
        { name: '移除', name_localizations: { 'en-US': 'Remove' }, value: 'remove' },
      )
      .setRequired(true),
  )
  .addStringOption((option) => option.setName('users').setDescription('標記成員').setRequired(true))
  .toJSON()

const exec: CommandProps['exec'] = async (interaction) => {
  const { guild, guildId } = interaction
  const date = interaction.options.getInteger('date', true)
  const action = interaction.options.getString('action', true) === 'add' ? 'add' : 'remove'
  const users = interaction.options.getString('users', true)

  if (!guild || !guildId || !date || !users) {
    return
  }

  if (!isAdmin(guild, interaction.user.id)) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  if (!isDateValid(`${date}`)) {
    return {
      content: translate('report.error.invalidDate', { guildId }),
    }
  }

  const targetMemberIds =
    users
      .match(/<@!?\d+>/gm)
      ?.map((v) => v.replace(/[<@!>]/g, ''))
      .filter(notEmpty) || []

  if (!targetMemberIds.length) {
    return {
      content: translate('modify.error.noMentionedUsers', { guildId }),
    }
  }

  const modifiedMemberIds: string[] = []
  const record: string | undefined = (await database.ref(`/records/${guildId}/${date}`).once('value')).val()
  const newRecord: { [UserID: string]: number } = {}
  record?.split(' ').forEach((userId) => {
    newRecord[userId] = 1
  })

  if (action === 'add') {
    targetMemberIds.forEach((userId) => {
      if (!newRecord[userId]) {
        modifiedMemberIds.push(userId)
      }
      newRecord[userId] = 1
    })
  } else {
    targetMemberIds.forEach((userId) => {
      if (newRecord[userId]) {
        modifiedMemberIds.push(userId)
      }
      delete newRecord[userId]
    })
  }

  await database.ref(`/records/${guildId}/${date}`).set(Object.keys(newRecord).sort().join(' '))

  return {
    content: translate(action === 'add' ? 'modify.text.resultAdd' : 'modify.text.resultRemove', { guildId })
      .replace('{GUILD_NAME}', guild.name)
      .replace('{DATE}', `${date}`)
      .replace('{COUNT}', `${modifiedMemberIds.length}`),
    embed: {
      description: translate('modify.text.resultDescription', { guildId })
        .replace('{DATE}', `${date}`)
        .replace(
          '{MEMBERS}',
          modifiedMemberIds
            .map((memberId) => guild.members.cache.get(memberId)?.displayName || `<@!${memberId}>`)
            .join(' '),
        ),
    },
    isFinished: true,
  }
}

export default {
  build,
  exec,
}
