import { SlashCommandBuilder } from 'discord.js'
import { CommandProps } from '../helper/cache.js'
import isAdmin from '../helper/isAdmin.js'
import translate from '../helper/translate.js'
import timeFormatter from '../utils/timeFormatter.js'

const build = new SlashCommandBuilder()
  .setName('raffle')
  .setDescription('隨機抽選一名當前接聽語音頻道的成員')
  .setDescriptionLocalizations({ 'en-US': 'Random pick a member in voice channels.' })
  .toJSON()

const exec: CommandProps['exec'] = async (interaction) => {
  const { guildId, guild } = interaction

  if (!guildId || !guild) {
    return
  }

  if (!isAdmin(guild, interaction.user.id)) {
    return {
      content: translate('system.error.adminOnly', { guildId }),
    }
  }

  // channels
  const targetChannel: {
    id: string
    name: string
    memberIds: string[]
  } = {
    id: '',
    name: '',
    memberIds: [],
  }

  guild.channels.cache.forEach((channel) => {
    if (!channel.isVoiceBased() || channel.members.size === 0 || !channel.members.get(interaction.user.id)) {
      return
    }
    targetChannel.id = channel.id
    targetChannel.name = channel.name
    targetChannel.memberIds = channel.members.map((member) => member.id)
  })

  if (!targetChannel.id || !targetChannel.memberIds.length) {
    return {
      content: translate('record.error.notInVoiceChannel', { guildId }),
    }
  }

  const luck = Math.floor(Math.random() * targetChannel.memberIds.length)

  // response
  return {
    content: ':triangular_flag_on_post: 中獎人為：<@{MEMBER_ID}>'.replace('{MEMBER_ID}', targetChannel.memberIds[luck]),
    embed: {
      description: '抽獎時間：`{TIME}`\n抽獎頻道：{CHANNELS}\n參與人數：{ALL_COUNT}\n中獎機率：{LUCK}%'
        .replace('{TIME}', timeFormatter({ time: interaction.createdTimestamp }))
        .replace('{CHANNELS}', targetChannel.name)
        .replace('{ALL_COUNT}', `${targetChannel.memberIds.length}`)
        .replace('{LUCK}', `${((1 / targetChannel.memberIds.length) * 100).toFixed(2)}`),
    },
    isFinished: true,
  }
}

export default {
  build,
  exec,
}
